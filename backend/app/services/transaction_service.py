import uuid
from typing import Literal, Optional, Tuple

from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.idempotency import (
    check_idempotency_record,
    save_idempotency_record,
)
from app.core.tokens import get_utc_now
from app.models.entities import (
    ReceivedTransactionTable,
    ShopTable,
    TransactionObservationTable,
)
from app.models.transaction import (
    ConflictState,
    ManualReceipt,
    ParseState,
    ReceiptView,
)
from app.services.receipt_identity import find_receipt_identity
from app.services.reconciliation import reconcile_receipt
from app.services.seller_service import (
    NotFoundError,
    SellerDomainException,
    SellerService,
    compute_payload_hash,
)
from app.services.transaction_store import (
    _memory_observations,
    _memory_transactions,
    is_observation_identical,
    to_receipt_view,
)


class AccountProviderMismatchError(SellerDomainException):
    def __init__(self, message: str = "Account provider does not match payload provider") -> None:
        super().__init__(status.HTTP_422_UNPROCESSABLE_CONTENT, "PROVIDER_MISMATCH", message)


class TransactionService:
    def __init__(self, db: Optional[AsyncSession] = None) -> None:
        self.db = db

    async def verify_account(self, shop_id: str, account_id: str, provider: str) -> None:
        seller_svc = SellerService(self.db)
        acc = await seller_svc.get_payment_account(shop_id, account_id)
        if not acc:
            raise NotFoundError("Payment account not found")
        if acc.provider != provider:
            raise AccountProviderMismatchError(
                f"Account provider '{acc.provider}' does not match payload provider '{provider}'"
            )

    async def record_manual_transaction(
        self, shop_id: str, actor_id: str, payload: ManualReceipt, idempotency_key: Optional[str] = None
    ) -> Tuple[ReceiptView, int]:
        return await self.record_observation(shop_id, actor_id, payload, idempotency_key)

    async def record_observation(
        self, shop_id: str, actor_id: str, payload: ManualReceipt, idempotency_key: Optional[str] = None,
        *, source: Literal["manual", "sms"] = "manual", commit: bool = True, reconcile: bool = True,
    ) -> Tuple[ReceiptView, int]:
        if self.db is not None:
            await self.db.execute(select(ShopTable).where(ShopTable.id == shop_id).with_for_update())
        await self.verify_account(shop_id, payload.payment_account_id, payload.provider)

        payload_hash = compute_payload_hash(payload.model_dump())
        scope = f"seller:{actor_id}"
        operation = "record_manual_transaction"

        if idempotency_key:
            cached = await check_idempotency_record(
                self.db, idempotency_key, scope, operation, payload_hash
            )
            if cached:
                cached_status, cached_json = cached
                return ReceiptView.model_validate_json(cached_json), cached_status

        now = get_utc_now()
        trx_id_clean = payload.trx_id.strip()
        canonical_sender = payload.sender_number_canonical
        parse_state: ParseState = "incomplete" if (payload.sender_number is None or payload.occurred_at is None) else "valid"

        if self.db is not None:
            existing_id = await find_receipt_identity(self.db, shop_id, payload.provider, trx_id_clean)
            stmt = select(ReceivedTransactionTable).where(
                ReceivedTransactionTable.id == existing_id,
            ).with_for_update()
            res = await self.db.execute(stmt)
            existing = res.scalar_one_or_none()

            if not existing:
                existing = ReceivedTransactionTable(
                    id=str(uuid.uuid4()),
                    shop_id=shop_id,
                    payment_account_id=payload.payment_account_id,
                    provider=payload.provider,
                    trx_id=trx_id_clean,
                    amount_minor=payload.amount_minor,
                    sender_number_raw=payload.sender_number,
                    sender_number_canonical=canonical_sender,
                    occurred_at=payload.occurred_at,
                    reconciliation_state="unmatched",
                    has_conflict=False,
                    version=1,
                    created_at=now,
                    updated_at=now,
                )
                self.db.add(existing)
                status_code = 201
                conflict_state: ConflictState = "none"
            else:
                if (existing.provider, existing.trx_id) == (payload.provider, trx_id_clean) and is_observation_identical(
                    payload.payment_account_id, payload.amount_minor, canonical_sender, payload.occurred_at,
                    str(existing.payment_account_id), int(existing.amount_minor), existing.sender_number_canonical, existing.occurred_at
                ):
                    conflict_state = "identical"
                else:
                    conflict_state = "conflicting"
                    existing.has_conflict = True
                    if existing.reconciliation_state != "used":
                        existing.reconciliation_state = "conflicted"
                    existing.version = int(existing.version) + 1
                    existing.updated_at = now
                status_code = 200

            obs = TransactionObservationTable(
                id=str(uuid.uuid4()),
                shop_id=shop_id,
                transaction_id=existing.id,
                payment_account_id=payload.payment_account_id,
                source=source,
                provider=payload.provider,
                trx_id=trx_id_clean,
                actor=actor_id,
                amount_minor=payload.amount_minor,
                sender_number_raw=payload.sender_number,
                sender_number_canonical=canonical_sender,
                occurred_at=payload.occurred_at,
                parse_state=parse_state,
                conflict_state=conflict_state,
                created_at=now,
            )
            self.db.add(obs)
            await self.db.flush()
            if reconcile:
                await reconcile_receipt(self.db, existing.id)
            await self.db.flush()
            if commit:
                await self.db.commit()

            stmt_obs = select(TransactionObservationTable).where(
                TransactionObservationTable.transaction_id == existing.id
            ).order_by(TransactionObservationTable.created_at.asc())
            obs_res = await self.db.execute(stmt_obs)
            receipt_view = to_receipt_view(existing, list(obs_res.scalars().all()))

            if idempotency_key:
                await save_idempotency_record(
                    self.db, idempotency_key, scope, operation, payload_hash, status_code, receipt_view.model_dump_json()
                )
            return receipt_view, status_code

        # In-memory execution
        existing_id = await find_receipt_identity(None, shop_id, payload.provider, trx_id_clean)

        if not existing_id:
            tx_id = str(uuid.uuid4())
            tx_data = {
                "id": tx_id,
                "shop_id": shop_id,
                "payment_account_id": payload.payment_account_id,
                "provider": payload.provider,
                "trx_id": trx_id_clean,
                "amount_minor": payload.amount_minor,
                "sender_number_raw": payload.sender_number,
                "sender_number_canonical": canonical_sender,
                "occurred_at": payload.occurred_at,
                "reconciliation_state": "unmatched",
                "has_conflict": False,
                "version": 1,
                "created_at": now,
                "updated_at": now,
            }
            _memory_transactions[tx_id] = tx_data
            _memory_observations[tx_id] = []
            conflict_state = "none"
            status_code = 201
            target_id = tx_id
        else:
            tx_data = _memory_transactions[existing_id]
            if (tx_data['provider'], tx_data['trx_id']) == (payload.provider, trx_id_clean) and is_observation_identical(
                payload.payment_account_id, payload.amount_minor, canonical_sender, payload.occurred_at,
                str(tx_data["payment_account_id"]), int(str(tx_data["amount_minor"])),
                tx_data.get("sender_number_canonical"), tx_data.get("occurred_at")
            ):
                conflict_state = "identical"
            else:
                conflict_state = "conflicting"
                tx_data["has_conflict"] = True
                if tx_data["reconciliation_state"] != "used":
                    tx_data["reconciliation_state"] = "conflicted"
                current_v = int(str(tx_data["version"]))
                tx_data["version"] = current_v + 1
                tx_data["updated_at"] = now
            status_code = 200
            target_id = existing_id

        obs_dict = {
            "id": str(uuid.uuid4()),
            "transaction_id": target_id,
            "payment_account_id": payload.payment_account_id,
            "source": source,
            "provider": payload.provider,
            "trx_id": trx_id_clean,
            "actor": actor_id,
            "amount_minor": payload.amount_minor,
            "sender_number_raw": payload.sender_number,
            "sender_number_canonical": canonical_sender,
            "occurred_at": payload.occurred_at,
            "parse_state": parse_state,
            "conflict_state": conflict_state,
            "created_at": now,
        }
        _memory_observations[target_id].append(obs_dict)
        if reconcile:
            await reconcile_receipt(None, target_id)

        receipt_view = to_receipt_view(tx_data, _memory_observations[target_id])
        if idempotency_key:
            await save_idempotency_record(
                None, idempotency_key, scope, operation, payload_hash, status_code, receipt_view.model_dump_json()
            )
        return receipt_view, status_code

