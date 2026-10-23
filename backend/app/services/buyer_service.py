import datetime
import hashlib
from collections.abc import Callable
from typing import Any

from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.idempotency import check_idempotency_record, save_idempotency_record
from app.core.tokens import get_utc_now
from app.models.buyer import BuyerSubmission, PublicOrder
from app.models.entities import BuyerRevisionTable, OrderTable, ShopTable
from app.services.buyer_measurements import _memory_link_measurements, record_measurement
from app.services.buyer_projection import to_public_order
from app.services.buyer_revision import buyer_revision
from app.services.order_service import _check_and_apply_expiry, _memory_orders, _memory_orders_by_digest
from app.services.seller_service import NotFoundError, SellerDomainException, compute_payload_hash


class ExpiredSubmissionError(SellerDomainException):
    def __init__(self) -> None:
        super().__init__(status.HTTP_410_GONE, "EXPIRED_SUBMISSION", "Order link has expired. Please contact the seller for a new link.")


class OrderAlreadySubmittedError(SellerDomainException):
    def __init__(self) -> None:
        super().__init__(status.HTTP_409_CONFLICT, "ORDER_ALREADY_SUBMITTED", "This order has already been submitted. Refresh its status.")


_memory_buyer_revisions: dict[str, list[dict[str, Any]]] = {}


def reset_buyer_memory_store() -> None:
    _memory_buyer_revisions.clear()
    _memory_link_measurements.clear()


def _require_unsubmitted(lifecycle: str) -> None:
    if lifecycle == "expired":
        raise ExpiredSubmissionError()
    if lifecycle != "awaiting_buyer":
        raise OrderAlreadySubmittedError()


class BuyerService:
    def __init__(self, db: AsyncSession | None = None, clock: Callable[[], datetime.datetime] = get_utc_now) -> None:
        self.db = db
        self.clock = clock

    async def _shop_name(self, shop_id: str) -> str:
        if self.db is not None:
            shop = await self.db.get(ShopTable, shop_id)
            return shop.display_name if shop else "Seller Shop"
        from app.services.seller_service import _memory_shops
        return next((str(shop["display_name"]) for shop in _memory_shops.values() if shop["id"] == shop_id), "Seller Shop")

    async def get_public_order(self, portal_token: str, is_bot: bool = False) -> PublicOrder:
        digest = hashlib.sha256(portal_token.strip().encode("utf-8")).hexdigest()
        if self.db is not None:
            # Reads can transition expiry, so they participate in the same aggregate lock.
            order = await self.db.scalar(select(OrderTable).where(OrderTable.token_lookup_digest == digest).with_for_update())
            if order is None:
                raise NotFoundError("Order not found")
            now = self.clock()
            if order.first_submitted_at is None:
                await record_measurement(self.db, digest, "open", now, is_bot)
            _check_and_apply_expiry(order, now)
            public_order = to_public_order(order, await self._shop_name(order.shop_id))
            await self.db.commit()
            return public_order

        order_id = _memory_orders_by_digest.get(digest)
        if not order_id or order_id not in _memory_orders:
            raise NotFoundError("Order not found")
        raw = _memory_orders[order_id]
        now = self.clock()
        if raw.get("first_submitted_at") is None:
            await record_measurement(None, digest, "open", now, is_bot)
        _check_and_apply_expiry(raw, now)
        return to_public_order(raw, await self._shop_name(str(raw["shop_id"])))

    async def submit_buyer_details(self, portal_token: str, submission: BuyerSubmission, idempotency_key: str) -> tuple[PublicOrder, int]:
        # Hashing scopes avoids persisting the bearer token and bounds composite key length.
        digest = hashlib.sha256(portal_token.strip().encode("utf-8")).hexdigest()
        payload_hash = compute_payload_hash(submission.model_dump(mode="json"))
        if self.db is not None:
            order = await self.db.scalar(select(OrderTable).where(OrderTable.token_lookup_digest == digest).with_for_update())
            if order is None:
                raise NotFoundError("Order not found")
            # Recheck replay after acquiring the lock: another worker may have just committed.
            cached = await check_idempotency_record(self.db, idempotency_key, digest, "buyer_submission", payload_hash)
            if cached:
                return PublicOrder(**cached[1]), cached[0]
            now = self.clock()  # Sample server time after waiting for the aggregate lock.
            if _check_and_apply_expiry(order, now):
                await self.db.commit()
            _require_unsubmitted(order.lifecycle)
            self.db.add(BuyerRevisionTable(**buyer_revision(submission, order.id, now)))
            order.lifecycle = "pending"
            order.buyer_revision = 1
            order.first_submitted_at = now
            order.version += 1
            order.updated_at = now
            await record_measurement(self.db, digest, "submission", now)
            public_order = to_public_order(order, await self._shop_name(order.shop_id))
            await save_idempotency_record(self.db, idempotency_key, digest, "buyer_submission", payload_hash, 200, public_order.model_dump(mode="json"), commit=False)
            await self.db.commit()
            return public_order, 200

        cached = await check_idempotency_record(None, idempotency_key, digest, "buyer_submission", payload_hash)
        if cached:
            return PublicOrder(**cached[1]), cached[0]
        order_id = _memory_orders_by_digest.get(digest)
        if not order_id or order_id not in _memory_orders:
            raise NotFoundError("Order not found")
        raw = _memory_orders[order_id]
        now = self.clock()
        _check_and_apply_expiry(raw, now)
        _require_unsubmitted(str(raw["lifecycle"]))
        _memory_buyer_revisions[order_id] = [buyer_revision(submission, order_id, now)]
        raw.update(lifecycle="pending", buyer_revision=1, first_submitted_at=now, version=int(raw.get("version", 1)) + 1, updated_at=now)
        await record_measurement(None, digest, "submission", now)
        public_order = to_public_order(raw, await self._shop_name(str(raw["shop_id"])))
        await save_idempotency_record(None, idempotency_key, digest, "buyer_submission", payload_hash, 200, public_order.model_dump(mode="json"))
        return public_order, 200
