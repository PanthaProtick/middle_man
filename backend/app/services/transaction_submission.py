"""Confirmed received-payment actions with immutable payload identity."""
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.idempotency import check_idempotency_record
from app.models.transaction import ManualReceipt, ReceiptView
from app.models.transaction_submission import (
    RecordedTransactionResult,
    TransactionSubmissionLookup,
)
from app.services.order_submission import (
    order_creation_lock,
    validate_submission_key,
)
from app.services.receipt_comparison import compare_receipt
from app.services.seller_service import (
    NotFoundError,
    SellerDomainException,
    SellerService,
    compute_payload_hash,
)
from app.services.transaction_service import (
    AccountProviderMismatchError,
    TransactionService,
)

OPERATION = "record_manual_transaction"


def scope(owner_id: str) -> str:
    return f"seller:{owner_id}"


def _cached_receipt(data: object) -> ReceiptView:
    if isinstance(data, str):
        return ReceiptView.model_validate_json(data)
    return ReceiptView.model_validate(data)


async def _result(
    db: AsyncSession | None, shop_id: str, receipt_id: str
) -> RecordedTransactionResult:
    comparison = await compare_receipt(db, shop_id, receipt_id)
    allocated = [comparison.allocated_order_id] if comparison.allocated_order_id else []
    return RecordedTransactionResult(receipt=comparison.receipt, allocated_order_ids=allocated)


async def _require_active_account(
    db: AsyncSession | None, shop_id: str, payload: ManualReceipt
) -> None:
    account = await SellerService(db).get_payment_account(shop_id, payload.payment_account_id)
    if account is None:
        raise NotFoundError("Payment account not found")
    if not account.is_active:
        raise SellerDomainException(
            422, "PAYMENT_ACCOUNT_INACTIVE",
            "Payment account is inactive and cannot be used for a new guided recording",
        )
    if account.provider != payload.provider:
        raise AccountProviderMismatchError(
            f"Account provider '{account.provider}' does not match payload provider '{payload.provider}'"
        )


async def lookup_transaction_submission(
    db: AsyncSession | None, shop_id: str, owner_id: str, key: str
) -> TransactionSubmissionLookup:
    validate_submission_key(db, key)
    async with order_creation_lock(db, shop_id):
        cached = await check_idempotency_record(
            db, key, scope(owner_id), OPERATION, None
        )
        if cached is None:
            return TransactionSubmissionLookup(state="not_found")
        receipt = _cached_receipt(cached[1])
        if receipt.shop_id != shop_id:
            return TransactionSubmissionLookup(state="not_found")
        return TransactionSubmissionLookup(
            state="succeeded",
            result=await _result(db, shop_id, receipt.id),
        )


async def record_transaction_submission(
    db: AsyncSession | None,
    shop_id: str,
    owner_id: str,
    payload: ManualReceipt,
    key: str,
) -> tuple[RecordedTransactionResult, int]:
    validate_submission_key(db, key)
    payload_hash = compute_payload_hash(payload.model_dump())
    async with order_creation_lock(db, shop_id):
        cached = await check_idempotency_record(
            db, key, scope(owner_id), OPERATION, payload_hash
        )
        if cached is not None:
            receipt = _cached_receipt(cached[1])
            if receipt.shop_id != shop_id:
                raise NotFoundError("Submission not found in this shop")
            return await _result(db, shop_id, receipt.id), cached[0]

        await _require_active_account(db, shop_id, payload)
        receipt, status_code = await TransactionService(db).record_observation(
            shop_id, owner_id, payload, idempotency_key=key,
            source="manual", commit=False, reconcile=True,
        )
        if db is not None:
            await db.commit()
        return await _result(db, shop_id, receipt.id), status_code
