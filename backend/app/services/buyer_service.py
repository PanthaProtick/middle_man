import datetime
import hashlib
import uuid
from typing import Any, Optional, Tuple

from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.idempotency import (
    check_idempotency_record,
    save_idempotency_record,
)
from app.core.tokens import get_utc_now
from app.models.buyer import BuyerSubmission, PublicOrder
from app.models.entities import (
    BuyerRevisionTable,
    LinkMeasurementTable,
    OrderTable,
    ShopTable,
)
from app.services.buyer_projection import to_public_order
from app.services.order_service import (
    _check_and_apply_expiry,
    _memory_orders,
    _memory_orders_by_digest,
)
from app.services.seller_service import (
    NotFoundError,
    SellerDomainException,
    compute_payload_hash,
)


class ExpiredSubmissionError(SellerDomainException):
    def __init__(
        self,
        code: str = "EXPIRED_SUBMISSION",
        message: str = "Order link has expired. Initial submission must occur strictly before the 48-hour deadline.",
    ) -> None:
        super().__init__(status.HTTP_410_GONE, code, message)


class OrderAlreadySubmittedError(SellerDomainException):
    def __init__(
        self,
        code: str = "ORDER_ALREADY_SUBMITTED",
        message: str = "This order has already been submitted and cannot be resubmitted",
    ) -> None:
        super().__init__(status.HTTP_409_CONFLICT, code, message)


_memory_buyer_revisions: dict[str, list[dict[str, Any]]] = {}
_memory_link_measurements: list[dict[str, Any]] = []


def reset_buyer_memory_store() -> None:
    _memory_buyer_revisions.clear()
    _memory_link_measurements.clear()


class BuyerService:
    def __init__(self, db: Optional[AsyncSession] = None) -> None:
        self.db = db

    async def _record_link_measurement(
        self, token_lookup_digest: str, event_type: str, is_bot_or_repeat: bool, now: datetime.datetime
    ) -> None:
        if self.db is not None:
            measurement = LinkMeasurementTable(
                id=str(uuid.uuid4()),
                token_lookup_digest=token_lookup_digest,
                event_type=event_type,
                is_bot_or_repeat=is_bot_or_repeat,
                created_at=now,
            )
            self.db.add(measurement)
            await self.db.flush()
        else:
            _memory_link_measurements.append(
                {
                    "id": str(uuid.uuid4()),
                    "token_lookup_digest": token_lookup_digest,
                    "event_type": event_type,
                    "is_bot_or_repeat": is_bot_or_repeat,
                    "created_at": now,
                }
            )

    async def get_public_order(
        self,
        portal_token: str,
        now: Optional[datetime.datetime] = None,
        is_bot_or_repeat: bool = False,
    ) -> PublicOrder:
        if now is None:
            now = get_utc_now()
        digest = hashlib.sha256(portal_token.strip().encode("utf-8")).hexdigest()
        await self._record_link_measurement(digest, "open", is_bot_or_repeat, now)

        if self.db is not None:
            stmt = select(OrderTable).where(OrderTable.token_lookup_digest == digest)
            res = await self.db.execute(stmt)
            order = res.scalar_one_or_none()
            if not order:
                raise NotFoundError("Order not found")

            if _check_and_apply_expiry(order, now):
                await self.db.commit()
                await self.db.refresh(order)

            shop_stmt = select(ShopTable).where(ShopTable.id == order.shop_id)
            shop_res = await self.db.execute(shop_stmt)
            shop = shop_res.scalar_one_or_none()
            shop_name = shop.display_name if shop else "Seller Shop"
            return to_public_order(order, shop_name)

        order_id = _memory_orders_by_digest.get(digest)
        if not order_id or order_id not in _memory_orders:
            raise NotFoundError("Order not found")
        order_dict = _memory_orders[order_id]
        _check_and_apply_expiry(order_dict, now)

        from app.services.seller_service import _memory_shops
        shop_name = "Seller Shop"
        for shop_rec in _memory_shops.values():
            if shop_rec.get("id") == order_dict.get("shop_id"):
                shop_name = shop_rec.get("display_name", "Seller Shop")
                break

        return to_public_order(order_dict, shop_name)

    async def submit_buyer_details(
        self,
        portal_token: str,
        submission: BuyerSubmission,
        idempotency_key: Optional[str],
        now: Optional[datetime.datetime] = None,
    ) -> Tuple[PublicOrder, int]:
        if now is None:
            now = get_utc_now()
        token_clean = portal_token.strip()
        digest = hashlib.sha256(token_clean.encode("utf-8")).hexdigest()

        payload_dict = submission.model_dump(mode="json")
        payload_hash = compute_payload_hash(payload_dict)

        cached = await check_idempotency_record(
            self.db, idempotency_key, token_clean, "buyer_submission", payload_hash
        )
        if cached:
            status_code, data = cached
            return PublicOrder(**data), status_code

        if self.db is not None:
            stmt = select(OrderTable).where(OrderTable.token_lookup_digest == digest)
            res = await self.db.execute(stmt)
            order = res.scalar_one_or_none()
            if not order:
                raise NotFoundError("Order not found")

            if order.lifecycle != "awaiting_buyer":
                if order.lifecycle == "expired":
                    raise ExpiredSubmissionError("EXPIRED_SUBMISSION", "Order link has expired")
                raise OrderAlreadySubmittedError()

            if now >= order.expires_at:
                order.lifecycle = "expired"
                order.completed_at = order.expires_at
                order.updated_at = now
                order.version = int(order.version) + 1
                await self.db.commit()
                raise ExpiredSubmissionError("EXPIRED_SUBMISSION", "Order link has expired. Initial submission must occur strictly before the 48-hour deadline.")

            await self._record_link_measurement(digest, "submission", False, now)

            rev_id = str(uuid.uuid4())
            revision = BuyerRevisionTable(
                id=rev_id,
                order_id=order.id,
                revision_number=1,
                buyer_name=submission.buyer_name,
                contact_number_raw=submission.contact_number_raw,
                contact_number_canonical=submission.contact_number_canonical,
                address_raw=submission.address.raw_text,
                address_district=submission.address.district,
                address_thana=submission.address.thana,
                address_area=submission.address.area,
                address_street_line=submission.address.street_line,
                address_landmark=submission.address.landmark,
                payment_provider=submission.payment_claim.provider,
                payment_trx_id=submission.payment_claim.trx_id,
                payment_sender_raw=submission.payment_claim.sender_number_raw,
                payment_sender_canonical=submission.payment_claim.sender_number_canonical,
                payment_amount_minor=submission.payment_claim.amount_minor,
                payment_claimed_at=submission.payment_claim.claimed_at,
                payment_evidence_id=submission.payment_claim.evidence_id,
                source="buyer",
                actor="buyer",
                reason=None,
                created_at=now,
            )
            self.db.add(revision)

            order.lifecycle = "pending"
            order.buyer_revision = 1
            order.first_submitted_at = now
            order.version = int(order.version) + 1
            order.updated_at = now
            await self.db.commit()
            await self.db.refresh(order)

            shop_stmt = select(ShopTable).where(ShopTable.id == order.shop_id)
            shop_res = await self.db.execute(shop_stmt)
            shop = shop_res.scalar_one_or_none()
            shop_name = shop.display_name if shop else "Seller Shop"

            public_order = to_public_order(order, shop_name)
            await save_idempotency_record(
                self.db, idempotency_key, token_clean, "buyer_submission", payload_hash, 200, public_order.model_dump(mode="json")
            )
            return public_order, 200

        # In-memory store
        order_id = _memory_orders_by_digest.get(digest)
        if not order_id or order_id not in _memory_orders:
            raise NotFoundError("Order not found")
        order_dict = _memory_orders[order_id]

        if order_dict["lifecycle"] != "awaiting_buyer":
            if order_dict["lifecycle"] == "expired":
                raise ExpiredSubmissionError("EXPIRED_SUBMISSION", "Order link has expired")
            raise OrderAlreadySubmittedError()

        if now >= order_dict["expires_at"]:
            order_dict["lifecycle"] = "expired"
            order_dict["completed_at"] = order_dict["expires_at"]
            order_dict["updated_at"] = now
            order_dict["version"] = int(order_dict.get("version", 1)) + 1
            raise ExpiredSubmissionError("EXPIRED_SUBMISSION", "Order link has expired. Initial submission must occur strictly before the 48-hour deadline.")

        await self._record_link_measurement(digest, "submission", False, now)

        rev_id = str(uuid.uuid4())
        revision_dict = {
            "id": rev_id,
            "order_id": order_id,
            "revision_number": 1,
            "buyer_name": submission.buyer_name,
            "contact_number_raw": submission.contact_number_raw,
            "contact_number_canonical": submission.contact_number_canonical,
            "address_raw": submission.address.raw_text,
            "address_district": submission.address.district,
            "address_thana": submission.address.thana,
            "address_area": submission.address.area,
            "address_street_line": submission.address.street_line,
            "address_landmark": submission.address.landmark,
            "payment_provider": submission.payment_claim.provider,
            "payment_trx_id": submission.payment_claim.trx_id,
            "payment_sender_raw": submission.payment_claim.sender_number_raw,
            "payment_sender_canonical": submission.payment_claim.sender_number_canonical,
            "payment_amount_minor": submission.payment_claim.amount_minor,
            "payment_claimed_at": submission.payment_claim.claimed_at,
            "payment_evidence_id": submission.payment_claim.evidence_id,
            "source": "buyer",
            "actor": "buyer",
            "reason": None,
            "created_at": now,
        }
        if order_id not in _memory_buyer_revisions:
            _memory_buyer_revisions[order_id] = []
        _memory_buyer_revisions[order_id].append(revision_dict)

        order_dict["lifecycle"] = "pending"
        order_dict["buyer_revision"] = 1
        order_dict["first_submitted_at"] = now
        order_dict["version"] = int(order_dict.get("version", 1)) + 1
        order_dict["updated_at"] = now

        from app.services.seller_service import _memory_shops
        shop_name = "Seller Shop"
        for shop_rec in _memory_shops.values():
            if shop_rec.get("id") == order_dict.get("shop_id"):
                shop_name = shop_rec.get("display_name", "Seller Shop")
                break

        public_order = to_public_order(order_dict, shop_name)
        await save_idempotency_record(
            self.db, idempotency_key, token_clean, "buyer_submission", payload_hash, 200, public_order.model_dump(mode="json")
        )
        return public_order, 200
