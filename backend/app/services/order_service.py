import datetime
import hashlib
import uuid
from typing import Any, List, Optional, Tuple

from fastapi import status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.idempotency import (
    check_idempotency_record,
    reset_shared_idempotency_store,
    save_idempotency_record,
)
from app.core.tokens import (
    decrypt_token,
    generate_portal_token_materials,
    get_utc_now,
)
from app.models.entities import OrderTable, PaymentAccountTable
from app.models.order import OrderInput, SellerOrder
from app.services.seller_service import (
    NotFoundError,
    SellerDomainException,
    compute_payload_hash,
)


class InactiveAccountError(SellerDomainException):
    def __init__(self, message: str = "Payment account is inactive and cannot be selected for new orders") -> None:
        super().__init__(status.HTTP_422_UNPROCESSABLE_CONTENT, "PAYMENT_ACCOUNT_INACTIVE", message)


_memory_orders: dict[str, dict[str, Any]] = {}
_memory_orders_by_digest: dict[str, str] = {}


def reset_order_memory_store() -> None:
    _memory_orders.clear()
    _memory_orders_by_digest.clear()
    reset_shared_idempotency_store()
    from app.services.buyer_service import reset_buyer_memory_store
    reset_buyer_memory_store()


def _check_and_apply_expiry(record: Any, now: datetime.datetime) -> bool:
    """Transitions awaiting_buyer order to expired if now >= expires_at, incrementing version."""
    if isinstance(record, OrderTable):
        if record.lifecycle == "awaiting_buyer" and now >= record.expires_at:
            record.lifecycle = "expired"
            record.completed_at = record.expires_at
            record.updated_at = now
            record.version = int(record.version) + 1
            return True
        return False

    # In-memory dict record
    if record["lifecycle"] == "awaiting_buyer" and now >= record["expires_at"]:
        record["lifecycle"] = "expired"
        record["completed_at"] = record["expires_at"]
        record["updated_at"] = now
        record["version"] = int(record.get("version", 1)) + 1
        return True
    return False


def _to_seller_order(row: OrderTable) -> SellerOrder:
    decrypted_token = decrypt_token(row.encrypted_portal_token)
    return SellerOrder(
        id=str(row.id),
        shop_id=str(row.shop_id),
        payment_account_id=str(row.payment_account_id),
        product_name=str(row.product_name),
        total_minor=int(row.total_minor),
        required_advance_minor=int(row.required_advance_minor),
        expected_cod_minor=int(row.total_minor) - int(row.required_advance_minor),
        actual_cod_minor=None,
        account_provider=str(row.account_provider),
        account_receiving_number=str(row.account_receiving_number),
        account_label=str(row.account_label),
        lifecycle=str(row.lifecycle),  # type: ignore[arg-type]
        version=int(row.version),
        review_reasons=[],
        buyer_revision=row.buyer_revision,
        allocation_basis=None,
        portal_token=decrypted_token,
        portal_url=f"/orders/{decrypted_token}",
        created_at=row.created_at,
        updated_at=row.updated_at,
        expires_at=row.expires_at,
        completed_at=row.completed_at,
    )


class OrderService:
    def __init__(self, db: Optional[AsyncSession] = None) -> None:
        self.db = db

    async def create_order(
        self, shop_id: str, owner_id: str, input_data: OrderInput, idempotency_key: Optional[str]
    ) -> Tuple[SellerOrder, int]:
        payload_hash = compute_payload_hash(input_data.model_dump())
        cached = await check_idempotency_record(self.db, idempotency_key, owner_id, "create_order", payload_hash)
        if cached:
            status_code, data = cached
            return SellerOrder(**data), status_code

        if self.db is not None:
            stmt = select(PaymentAccountTable).where(
                PaymentAccountTable.id == input_data.payment_account_id,
                PaymentAccountTable.shop_id == shop_id,
            )
            result = await self.db.execute(stmt)
            acc = result.scalar_one_or_none()
            if not acc:
                raise NotFoundError("Payment account not found")
            if not acc.is_active:
                raise InactiveAccountError()
            acc_provider, acc_number, acc_label = str(acc.provider), str(acc.receiving_number), str(acc.label)
        else:
            from app.services.seller_service import _memory_accounts
            raw_acc = _memory_accounts.get(input_data.payment_account_id)
            if not raw_acc or raw_acc["shop_id"] != shop_id:
                raise NotFoundError("Payment account not found")
            if not raw_acc.get("is_active", True):
                raise InactiveAccountError()
            acc_provider, acc_number, acc_label = str(raw_acc["provider"]), str(raw_acc["receiving_number"]), str(raw_acc["label"])

        now = get_utc_now()
        expires_at = now + datetime.timedelta(hours=48)
        order_id = str(uuid.uuid4())
        portal_token, digest, encrypted_token = generate_portal_token_materials()

        order_obj = SellerOrder(
            id=order_id,
            shop_id=shop_id,
            payment_account_id=input_data.payment_account_id,
            product_name=input_data.product_name,
            total_minor=input_data.total_minor,
            required_advance_minor=input_data.required_advance_minor,
            expected_cod_minor=input_data.total_minor - input_data.required_advance_minor,
            actual_cod_minor=None,
            account_provider=acc_provider,
            account_receiving_number=acc_number,
            account_label=acc_label,
            lifecycle="awaiting_buyer",
            version=1,
            review_reasons=[],
            buyer_revision=None,
            allocation_basis=None,
            portal_token=portal_token,
            portal_url=f"/orders/{portal_token}",
            created_at=now,
            updated_at=now,
            expires_at=expires_at,
            completed_at=None,
        )

        if self.db is not None:
            db_order = OrderTable(
                id=order_id,
                shop_id=shop_id,
                payment_account_id=input_data.payment_account_id,
                token_lookup_digest=digest,
                encrypted_portal_token=encrypted_token,
                product_name=input_data.product_name,
                total_minor=input_data.total_minor,
                required_advance_minor=input_data.required_advance_minor,
                account_provider=acc_provider,
                account_receiving_number=acc_number,
                account_label=acc_label,
                lifecycle="awaiting_buyer",
                version=1,
                created_at=now,
                updated_at=now,
                expires_at=expires_at,
                completed_at=None,
            )
            self.db.add(db_order)
            await self.db.commit()
        else:
            raw_record = order_obj.model_dump()
            raw_record["encrypted_portal_token"] = encrypted_token
            raw_record["token_lookup_digest"] = digest
            _memory_orders[order_id] = raw_record
            _memory_orders_by_digest[digest] = order_id

        await save_idempotency_record(
            self.db, idempotency_key, owner_id, "create_order", payload_hash, status.HTTP_201_CREATED, order_obj.model_dump()
        )
        return order_obj, status.HTTP_201_CREATED

    async def get_order(self, shop_id: str, order_id: str) -> SellerOrder:
        now = get_utc_now()
        if self.db is not None:
            stmt = select(OrderTable).where(OrderTable.id == order_id, OrderTable.shop_id == shop_id).with_for_update()
            result = await self.db.execute(stmt)
            order = result.scalar_one_or_none()
            if not order:
                raise NotFoundError("Order not found")

            if _check_and_apply_expiry(order, now):
                await self.db.commit()
                await self.db.refresh(order)
            return _to_seller_order(order)

        raw = _memory_orders.get(order_id)
        if not raw or raw["shop_id"] != shop_id:
            raise NotFoundError("Order not found")

        _check_and_apply_expiry(raw, now)
        return SellerOrder(**raw)

    async def list_orders(
        self,
        shop_id: str,
        cursor: Optional[str] = None,
        limit: int = 25,
        status_filter: Optional[str] = None,
        review_filter: Optional[str] = None,
    ) -> Tuple[List[SellerOrder], Optional[str]]:
        now = get_utc_now()
        limit = max(1, min(limit, 100))

        if self.db is not None:
            stmt = select(OrderTable).where(OrderTable.shop_id == shop_id).order_by(desc(OrderTable.created_at), desc(OrderTable.id)).with_for_update()
            result = await self.db.execute(stmt)
            all_orders = list(result.scalars().all())

            updated = False
            for order in all_orders:
                updated = _check_and_apply_expiry(order, now) or updated
            if updated:
                await self.db.commit()

            filtered = [o for o in all_orders if (status_filter is None or o.lifecycle == status_filter)]
            start_idx = 0
            if cursor:
                for idx, o in enumerate(filtered):
                    if o.id == cursor:
                        start_idx = idx + 1
                        break

            page = filtered[start_idx : start_idx + limit]
            next_cursor = page[-1].id if (start_idx + limit < len(filtered) and len(page) > 0) else None
            return [_to_seller_order(o) for o in page], next_cursor

        all_raw = [o for o in _memory_orders.values() if o["shop_id"] == shop_id]
        for raw in all_raw:
            _check_and_apply_expiry(raw, now)

        filtered_raw = [o for o in all_raw if (status_filter is None or o["lifecycle"] == status_filter)]
        filtered_raw.sort(key=lambda x: (x["created_at"], x["id"]), reverse=True)

        start_idx = 0
        if cursor:
            for idx, item_dict in enumerate(filtered_raw):
                if item_dict["id"] == cursor:
                    start_idx = idx + 1
                    break

        page_raw = filtered_raw[start_idx : start_idx + limit]
        next_cursor = page_raw[-1]["id"] if (start_idx + limit < len(filtered_raw) and len(page_raw) > 0) else None
        return [SellerOrder(**raw) for raw in page_raw], next_cursor

    async def resolve_portal_token(self, shop_id: str, portal_token: str) -> str:
        digest = hashlib.sha256(portal_token.encode("utf-8")).hexdigest()
        if self.db is not None:
            stmt = select(OrderTable).where(OrderTable.token_lookup_digest == digest, OrderTable.shop_id == shop_id)
            result = await self.db.execute(stmt)
            order = result.scalar_one_or_none()
            if not order:
                raise NotFoundError("Order not found")
            return str(order.id)

        order_id = _memory_orders_by_digest.get(digest)
        if not order_id:
            raise NotFoundError("Order not found")
        raw = _memory_orders.get(order_id)
        if not raw or raw["shop_id"] != shop_id:
            raise NotFoundError("Order not found")
        return order_id
