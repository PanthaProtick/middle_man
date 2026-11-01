"""Atomic creation and idempotent result persistence for awaiting-buyer orders."""
import datetime
import uuid
from typing import Optional, Tuple

from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.idempotency import check_idempotency_record, save_idempotency_record
from app.core.tokens import generate_portal_token_materials, get_utc_now
from app.models.entities import OrderTable, PaymentAccountTable
from app.models.order import OrderInput, SellerOrder
from app.services.order_mapping import to_seller_order as _to_seller_order
from app.services.order_mapping import to_seller_order_from_dict as _to_seller_order_from_dict
from app.services.order_store import memory_orders as _memory_orders
from app.services.order_store import memory_orders_by_digest as _memory_orders_by_digest
from app.services.order_submission import order_creation_lock
from app.services.seller_service import NotFoundError, SellerDomainException, compute_payload_hash


class InactiveAccountError(SellerDomainException):
    def __init__(self) -> None:
        super().__init__(422, "PAYMENT_ACCOUNT_INACTIVE", "Payment account is inactive and cannot be selected for new orders")


class OrderCreation:
    def __init__(self, db: Optional[AsyncSession] = None) -> None:
        self.db = db

    async def _get_account_snapshot(self, shop_id: str, account_id: str) -> tuple[str, str, str]:
        if self.db is not None:
            acc = (await self.db.execute(select(PaymentAccountTable).where(
                PaymentAccountTable.id == account_id, PaymentAccountTable.shop_id == shop_id
            ).with_for_update().execution_options(populate_existing=True))).scalar_one_or_none()
            if not acc:
                raise NotFoundError("Payment account not found")
            if not acc.is_active:
                raise InactiveAccountError()
            return str(acc.provider), str(acc.receiving_number), str(acc.label)
        from app.services.seller_service import _memory_accounts
        raw_acc = _memory_accounts.get(account_id)
        if not raw_acc or raw_acc["shop_id"] != shop_id:
            raise NotFoundError("Payment account not found")
        if not raw_acc.get("is_active", True):
            raise InactiveAccountError()
        return str(raw_acc["provider"]), str(raw_acc["receiving_number"]), str(raw_acc["label"])

    async def create_order(
        self, shop_id: str, owner_id: str, input_data: OrderInput, idempotency_key: Optional[str] = None
    ) -> Tuple[SellerOrder, int]:
        async with order_creation_lock(self.db, shop_id):
            return await self._create_locked(shop_id, owner_id, input_data, idempotency_key)

    async def _create_locked(
        self, shop_id: str, owner_id: str, input_data: OrderInput, idempotency_key: Optional[str]
    ) -> Tuple[SellerOrder, int]:
        payload_hash = compute_payload_hash(input_data.model_dump())
        cached = await check_idempotency_record(
            self.db, idempotency_key, owner_id, "create_order", payload_hash
        )
        if cached:
            order = SellerOrder.model_validate(cached[1])
            if order.shop_id != shop_id:
                raise NotFoundError("Submission not found in this shop")
            return order, cached[0]

        provider, receiving_number, label = await self._get_account_snapshot(
            shop_id, input_data.payment_account_id
        )

        order_id = str(uuid.uuid4())
        raw_token, digest, encrypted = generate_portal_token_materials()
        now = get_utc_now()
        expires_at = now + datetime.timedelta(hours=48)

        if self.db is not None:
            order_table = OrderTable(
                id=order_id,
                shop_id=shop_id,
                payment_account_id=input_data.payment_account_id,
                token_lookup_digest=digest,
                encrypted_portal_token=encrypted,
                product_name=input_data.product_name,
                total_minor=input_data.total_minor,
                required_advance_minor=input_data.required_advance_minor,
                account_provider=provider,
                account_receiving_number=receiving_number,
                account_label=label,
                parcel_weight_grams=input_data.parcel_weight_grams,
                parcel_quantity=input_data.parcel_quantity,
                lifecycle="awaiting_buyer",
                version=1,
                created_at=now,
                updated_at=now,
                expires_at=expires_at,
                completed_at=None,
            )
            self.db.add(order_table)
            await self.db.flush()
            order_obj = _to_seller_order(order_table)
        else:
            raw_dict = {
                "id": order_id,
                "shop_id": shop_id,
                "payment_account_id": input_data.payment_account_id,
                "token_lookup_digest": digest,
                "encrypted_portal_token": encrypted,
                "product_name": input_data.product_name,
                "total_minor": input_data.total_minor,
                "required_advance_minor": input_data.required_advance_minor,
                "expected_cod_minor": input_data.total_minor - input_data.required_advance_minor,
                "actual_cod_minor": None,
                "account_provider": provider,
                "account_receiving_number": receiving_number,
                "account_label": label,
                "parcel_weight_grams": input_data.parcel_weight_grams,
                "parcel_quantity": input_data.parcel_quantity,
                "lifecycle": "awaiting_buyer",
                "version": 1,
                "portal_token": raw_token,
                "portal_url": f"/orders/{raw_token}",
                "created_at": now,
                "updated_at": now,
                "expires_at": expires_at,
                "completed_at": None,
            }
            _memory_orders[order_id] = raw_dict
            _memory_orders_by_digest[digest] = order_id
            order_obj = _to_seller_order_from_dict(raw_dict)

        await save_idempotency_record(
            self.db, idempotency_key, owner_id, "create_order", payload_hash, status.HTTP_201_CREATED, order_obj.model_dump(), commit=False
        )
        if self.db is not None:
            await self.db.commit()
        return order_obj, status.HTTP_201_CREATED
