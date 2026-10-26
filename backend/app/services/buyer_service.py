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
from app.models.entities import BuyerRevisionTable, OrderTable, ReceivedTransactionTable, ShopTable
from app.services.buyer_measurements import _memory_link_measurements, record_measurement
from app.services.buyer_projection import to_public_order
from app.services.buyer_revision import buyer_revision
from app.services.evidence_service import EvidenceService, reset_memory_evidence
from app.services.evidence_store import reset_evidence_file_store
from app.services.order_service import _check_and_apply_expiry, _memory_orders, _memory_orders_by_digest
from app.services.public_order_access import require_public_order_access
from app.services.reconciliation import get_order_allocation, reconcile_order
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
    reset_memory_evidence()
    reset_evidence_file_store()


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
            order = await self.db.scalar(select(OrderTable).where(OrderTable.token_lookup_digest == digest).with_for_update().execution_options(populate_existing=True))
            if order is None:
                raise NotFoundError("Order not found")
            require_public_order_access(order)
            now = self.clock()
            if order.first_submitted_at is None:
                await record_measurement(self.db, digest, "open", now, is_bot)
            _check_and_apply_expiry(order, now)
            alloc = await get_order_allocation(self.db, order.id) if order.lifecycle == "confirmed" else None
            accepted_amount = alloc.accepted_amount_minor if alloc else None
            public_order = to_public_order(order, await self._shop_name(order.shop_id), accepted_amount_minor=accepted_amount)
            await self.db.commit()
            return public_order

        order_id = _memory_orders_by_digest.get(digest)
        if not order_id or order_id not in _memory_orders:
            raise NotFoundError("Order not found")
        raw = _memory_orders[order_id]
        require_public_order_access(raw)
        now = self.clock()
        if raw.get("first_submitted_at") is None:
            await record_measurement(None, digest, "open", now, is_bot)
        _check_and_apply_expiry(raw, now)
        alloc = await get_order_allocation(None, order_id) if raw.get("lifecycle") == "confirmed" else None
        accepted_amount = alloc.accepted_amount_minor if alloc else None
        return to_public_order(raw, await self._shop_name(str(raw["shop_id"])), accepted_amount_minor=accepted_amount)

    async def submit_buyer_details(self, portal_token: str, submission: BuyerSubmission, idempotency_key: str) -> tuple[PublicOrder, int]:
        # Hashing scopes avoids persisting the bearer token and bounds composite key length.
        digest = hashlib.sha256(portal_token.strip().encode("utf-8")).hexdigest()
        payload_hash = compute_payload_hash(submission.model_dump(mode="json"))
        from app.services.pathao_locations import link_shop, resolve, submission_window_open
        # Only the original client payload determines replay identity.
        await link_shop(self.db, portal_token)
        prior = await check_idempotency_record(self.db, idempotency_key, digest, 'buyer_submission', payload_hash)
        if self.db is not None:
            await self.db.commit()
        if prior is None and await submission_window_open(self.db, portal_token, self.clock):
            submission = submission.model_copy(update={'address': await resolve(self.db, portal_token, submission.address)})
        if self.db is not None:
            shop_id = await self.db.scalar(select(OrderTable.shop_id).where(OrderTable.token_lookup_digest == digest))
            if shop_id is not None:
                await self.db.execute(select(ShopTable).where(ShopTable.id == shop_id).with_for_update())
            order = await self.db.scalar(select(OrderTable).where(OrderTable.token_lookup_digest == digest).with_for_update().execution_options(populate_existing=True))
            if order is None:
                raise NotFoundError("Order not found")
            require_public_order_access(order)
            # Recheck replay after acquiring the lock: another worker may have just committed.
            cached = await check_idempotency_record(self.db, idempotency_key, digest, "buyer_submission", payload_hash)
            if cached:
                return PublicOrder(**cached[1]), cached[0]
            now = self.clock()  # Sample server time after waiting for the aggregate lock.
            if _check_and_apply_expiry(order, now):
                await self.db.commit()
            _require_unsubmitted(order.lifecycle)
            if submission.payment_claim.evidence_id:
                await EvidenceService(self.db, self.clock).attach_order_evidence(
                    order.id, order.shop_id, submission.payment_claim.evidence_id
                )
            self.db.add(BuyerRevisionTable(**buyer_revision(submission, order.id, now)))
            order.lifecycle = "pending"
            order.buyer_revision = 1
            order.first_submitted_at = now
            order.version += 1
            order.updated_at = now
            await record_measurement(self.db, digest, "submission", now)

            tx = await self.db.scalar(select(ReceivedTransactionTable).where(
                ReceivedTransactionTable.shop_id == order.shop_id,
                ReceivedTransactionTable.provider == submission.payment_claim.provider,
                ReceivedTransactionTable.trx_id == submission.payment_claim.trx_id))
            if tx is not None:
                tx.version += 1
                tx.updated_at = now
            # Trigger reconciliation against shop receipts
            await reconcile_order(self.db, order.id, clock=self.clock)

            alloc = await get_order_allocation(self.db, order.id) if order.lifecycle == "confirmed" else None
            accepted_amount = alloc.accepted_amount_minor if alloc else None
            public_order = to_public_order(order, await self._shop_name(order.shop_id), accepted_amount_minor=accepted_amount)
            await save_idempotency_record(self.db, idempotency_key, digest, "buyer_submission", payload_hash, 200, public_order.model_dump(mode="json"), commit=False)
            await self.db.commit()
            return public_order, 200

        order_id = _memory_orders_by_digest.get(digest)
        if not order_id or order_id not in _memory_orders:
            raise NotFoundError("Order not found")
        raw = _memory_orders[order_id]
        require_public_order_access(raw)
        cached = await check_idempotency_record(None, idempotency_key, digest, "buyer_submission", payload_hash)
        if cached:
            return PublicOrder(**cached[1]), cached[0]
        now = self.clock()
        _check_and_apply_expiry(raw, now)
        _require_unsubmitted(str(raw["lifecycle"]))
        if submission.payment_claim.evidence_id:
            await EvidenceService(None, self.clock).attach_order_evidence(
                order_id, str(raw["shop_id"]), submission.payment_claim.evidence_id
            )
        _memory_buyer_revisions[order_id] = [buyer_revision(submission, order_id, now)]
        raw.update(lifecycle="pending", buyer_revision=1, first_submitted_at=now, version=int(raw.get("version", 1)) + 1, updated_at=now)
        await record_measurement(None, digest, "submission", now)

        from app.services.transaction_store import _memory_transactions
        for tx_raw in _memory_transactions.values():
            if (tx_raw["shop_id"] == raw["shop_id"] and tx_raw["provider"] == submission.payment_claim.provider
                    and tx_raw["trx_id"] == submission.payment_claim.trx_id):
                tx_raw["version"] += 1
                tx_raw["updated_at"] = now
        # Trigger reconciliation against shop receipts
        await reconcile_order(None, order_id, clock=self.clock)

        alloc = await get_order_allocation(None, order_id) if raw.get("lifecycle") == "confirmed" else None
        accepted_amount = alloc.accepted_amount_minor if alloc else None
        public_order = to_public_order(raw, await self._shop_name(str(raw["shop_id"])), accepted_amount_minor=accepted_amount)
        await save_idempotency_record(None, idempotency_key, digest, "buyer_submission", payload_hash, 200, public_order.model_dump(mode="json"))
        return public_order, 200
