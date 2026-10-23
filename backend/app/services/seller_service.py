import datetime
import hashlib
import json
import uuid
from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.idempotency import (
    check_idempotency_record,
    reset_shared_idempotency_store,
    save_idempotency_record,
)
from app.models.entities import PaymentAccountTable, ShopTable
from app.models.seller import AccountInput, AccountUpdateInput, PaymentAccountResponse, ShopInput, ShopResponse


class SellerDomainException(HTTPException):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(status_code=status_code, detail={"code": code, "message": message})


class IdempotencyConflictError(SellerDomainException):
    def __init__(self, message: str = "Idempotency key reused with different payload") -> None:
        super().__init__(status.HTTP_409_CONFLICT, "IDEMPOTENCY_KEY_REUSED", message)


class StaleVersionError(SellerDomainException):
    def __init__(self, message: str = "Resource was modified by another transaction") -> None:
        super().__init__(status.HTTP_409_CONFLICT, "STALE_VERSION", message)


class NotFoundError(SellerDomainException):
    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(status.HTTP_404_NOT_FOUND, "NOT_FOUND", message)


def compute_payload_hash(data: Any) -> str:
    serialized = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


# Memory store for offline / standby operation without database
_memory_shops: dict[str, dict[str, Any]] = {}  # id -> dict
_memory_shops_by_owner: dict[str, str] = {}  # owner_id -> id
_memory_accounts: dict[str, dict[str, Any]] = {}  # id -> dict


def reset_memory_store() -> None:
    _memory_shops.clear()
    _memory_shops_by_owner.clear()
    _memory_accounts.clear()
    reset_shared_idempotency_store()


class SellerService:
    def __init__(self, db: Optional[AsyncSession] = None) -> None:
        self.db = db

    async def _check_idempotency(
        self, key: Optional[str], scope: str, operation: str, payload_hash: str
    ) -> Optional[tuple[int, Any]]:
        return await check_idempotency_record(self.db, key, scope, operation, payload_hash)

    async def _save_idempotency(
        self, key: Optional[str], scope: str, operation: str, payload_hash: str, status_code: int, data: Any
    ) -> None:
        await save_idempotency_record(self.db, key, scope, operation, payload_hash, status_code, data)

    async def get_shop_by_owner(self, owner_id: str) -> Optional[ShopResponse]:
        if self.db is not None:
            stmt = select(ShopTable).where(ShopTable.owner_id == owner_id)
            result = await self.db.execute(stmt)
            shop = result.scalar_one_or_none()
            if not shop:
                return None
            return ShopResponse(
                id=str(shop.id),
                owner_id=str(shop.owner_id),
                display_name=str(shop.display_name),
                created_at=shop.created_at,
                updated_at=shop.updated_at,
            )
        shop_id = _memory_shops_by_owner.get(owner_id)
        if not shop_id:
            return None
        raw = _memory_shops[shop_id]
        return ShopResponse(**raw)

    async def create_shop(
        self, owner_id: str, input_data: ShopInput, idempotency_key: Optional[str]
    ) -> tuple[ShopResponse, int]:
        payload_hash = compute_payload_hash(input_data.model_dump())
        cached = await self._check_idempotency(idempotency_key, owner_id, "create_shop", payload_hash)
        if cached:
            status_code, data = cached
            return ShopResponse(**data), status_code

        existing = await self.get_shop_by_owner(owner_id)
        if existing:
            # Idempotent: pilot shop already created for this owner
            await self._save_idempotency(
                idempotency_key, owner_id, "create_shop", payload_hash, status.HTTP_200_OK, existing.model_dump()
            )
            return existing, status.HTTP_200_OK

        now = datetime.datetime.now(datetime.timezone.utc)
        shop_id = str(uuid.uuid4())
        shop_resp = ShopResponse(
            id=shop_id,
            owner_id=owner_id,
            display_name=input_data.display_name,
            created_at=now,
            updated_at=now,
        )

        if self.db is not None:
            new_shop = ShopTable(
                id=shop_id,
                owner_id=owner_id,
                display_name=input_data.display_name,
                created_at=now,
                updated_at=now,
            )
            self.db.add(new_shop)
            await self.db.commit()
            await self.db.refresh(new_shop)
        else:
            _memory_shops[shop_id] = shop_resp.model_dump()
            _memory_shops_by_owner[owner_id] = shop_id

        await self._save_idempotency(
            idempotency_key, owner_id, "create_shop", payload_hash, status.HTTP_201_CREATED, shop_resp.model_dump()
        )
        return shop_resp, status.HTTP_201_CREATED

    async def list_payment_accounts(self, shop_id: str) -> list[PaymentAccountResponse]:
        if self.db is not None:
            stmt = select(PaymentAccountTable).where(PaymentAccountTable.shop_id == shop_id).order_by(PaymentAccountTable.created_at)
            result = await self.db.execute(stmt)
            accounts = result.scalars().all()
            return [
                PaymentAccountResponse(
                    id=str(a.id),
                    shop_id=str(a.shop_id),
                    provider=str(a.provider),
                    receiving_number=str(a.receiving_number),
                    label=str(a.label),
                    is_active=bool(a.is_active),
                    version=int(a.version),
                    created_at=a.created_at,
                    updated_at=a.updated_at,
                )
                for a in accounts
            ]
        return [
            PaymentAccountResponse(**a)
            for a in _memory_accounts.values()
            if a["shop_id"] == shop_id
        ]

    async def get_payment_account(self, shop_id: str, account_id: str) -> Optional[PaymentAccountResponse]:
        if self.db is not None:
            stmt = select(PaymentAccountTable).where(
                PaymentAccountTable.id == account_id,
                PaymentAccountTable.shop_id == shop_id,
            )
            result = await self.db.execute(stmt)
            acc = result.scalar_one_or_none()
            if not acc:
                return None
            return PaymentAccountResponse(
                id=str(acc.id),
                shop_id=str(acc.shop_id),
                provider=str(acc.provider),
                receiving_number=str(acc.receiving_number),
                label=str(acc.label),
                is_active=bool(acc.is_active),
                version=int(acc.version),
                created_at=acc.created_at,
                updated_at=acc.updated_at,
            )
        raw = _memory_accounts.get(account_id)
        if not raw or raw["shop_id"] != shop_id:
            return None
        return PaymentAccountResponse(**raw)

    async def create_payment_account(
        self, shop_id: str, owner_id: str, input_data: AccountInput, idempotency_key: Optional[str]
    ) -> tuple[PaymentAccountResponse, int]:
        payload_hash = compute_payload_hash(input_data.model_dump())
        cached = await self._check_idempotency(idempotency_key, owner_id, "create_account", payload_hash)
        if cached:
            status_code, data = cached
            return PaymentAccountResponse(**data), status_code

        now = datetime.datetime.now(datetime.timezone.utc)
        acc_id = str(uuid.uuid4())
        acc_resp = PaymentAccountResponse(
            id=acc_id,
            shop_id=shop_id,
            provider=input_data.provider,
            receiving_number=input_data.receiving_number,
            label=input_data.label,
            is_active=True,
            version=1,
            created_at=now,
            updated_at=now,
        )

        if self.db is not None:
            new_acc = PaymentAccountTable(
                id=acc_id,
                shop_id=shop_id,
                provider=input_data.provider,
                receiving_number=input_data.receiving_number,
                label=input_data.label,
                is_active=True,
                version=1,
                created_at=now,
                updated_at=now,
            )
            self.db.add(new_acc)
            await self.db.commit()
            await self.db.refresh(new_acc)
        else:
            _memory_accounts[acc_id] = acc_resp.model_dump()

        await self._save_idempotency(
            idempotency_key, owner_id, "create_account", payload_hash, status.HTTP_201_CREATED, acc_resp.model_dump()
        )
        return acc_resp, status.HTTP_201_CREATED

    async def update_payment_account(
        self, shop_id: str, account_id: str, update_data: AccountUpdateInput
    ) -> PaymentAccountResponse:
        now = datetime.datetime.now(datetime.timezone.utc)
        if self.db is not None:
            stmt = select(PaymentAccountTable).where(
                PaymentAccountTable.id == account_id,
                PaymentAccountTable.shop_id == shop_id,
            )
            result = await self.db.execute(stmt)
            acc = result.scalar_one_or_none()
            if not acc:
                raise NotFoundError("Payment account not found")

            if acc.version != update_data.expected_version:
                raise StaleVersionError()

            if update_data.label is not None:
                acc.label = update_data.label
            if update_data.is_active is not None:
                acc.is_active = update_data.is_active
            acc.version = int(acc.version) + 1
            acc.updated_at = now
            await self.db.commit()
            await self.db.refresh(acc)
            return PaymentAccountResponse(
                id=str(acc.id),
                shop_id=str(acc.shop_id),
                provider=str(acc.provider),
                receiving_number=str(acc.receiving_number),
                label=str(acc.label),
                is_active=bool(acc.is_active),
                version=int(acc.version),
                created_at=acc.created_at,
                updated_at=acc.updated_at,
            )

        raw = _memory_accounts.get(account_id)
        if not raw or raw["shop_id"] != shop_id:
            raise NotFoundError("Payment account not found")

        if raw["version"] != update_data.expected_version:
            raise StaleVersionError()

        if update_data.label is not None:
            raw["label"] = update_data.label
        if update_data.is_active is not None:
            raw["is_active"] = update_data.is_active
        raw["version"] += 1
        raw["updated_at"] = now
        return PaymentAccountResponse(**raw)
