import datetime
from typing import Any, Optional

from app.core.idempotency import reset_shared_idempotency_store
from app.models.entities import ReceivedTransactionTable, TransactionObservationTable
from app.models.transaction import (
    ReceiptView,
    TransactionObservationView,
)

_memory_transactions: dict[str, dict[str, Any]] = {}
_memory_observations: dict[str, list[dict[str, Any]]] = {}


def reset_transaction_memory_store() -> None:
    _memory_transactions.clear()
    _memory_observations.clear()
    reset_shared_idempotency_store()


def is_observation_identical(
    account_id: str,
    amount_minor: int,
    sender_canonical: Optional[str],
    occurred_at: Optional[datetime.datetime],
    existing_account_id: str,
    existing_amount: int,
    existing_sender: Any,
    existing_occurred_at: Any,
) -> bool:
    return (
        account_id == existing_account_id
        and amount_minor == existing_amount
        and sender_canonical == existing_sender
        and occurred_at == existing_occurred_at
    )


def matches_transaction_filters(
    has_conflict: bool,
    sender_canonical: Optional[str],
    occurred_at: Optional[datetime.datetime],
    reconciliation_state: str,
    review_filter: Optional[str],
    used_filter: Optional[str],
    parse_filter: Optional[str],
) -> bool:
    if review_filter == "conflicted" and not has_conflict:
        return False
    if review_filter == "incomplete" and (sender_canonical is not None and occurred_at is not None):
        return False
    if used_filter and reconciliation_state != used_filter:
        return False
    if parse_filter == "incomplete" and (sender_canonical is not None and occurred_at is not None):
        return False
    if parse_filter == "valid" and (sender_canonical is None or occurred_at is None):
        return False
    return True


def to_observation_view(
    raw: dict[str, Any] | TransactionObservationTable,
) -> TransactionObservationView:
    if isinstance(raw, TransactionObservationTable):
        return TransactionObservationView(
            id=str(raw.id),
            transaction_id=str(raw.transaction_id),
            payment_account_id=str(raw.payment_account_id),
            source=raw.source,
            actor=raw.actor,
            amount_minor=int(raw.amount_minor),
            sender_number_raw=raw.sender_number_raw,
            sender_number_canonical=raw.sender_number_canonical,
            occurred_at=raw.occurred_at,
            parse_state=raw.parse_state,  # type: ignore[arg-type]
            conflict_state=raw.conflict_state,  # type: ignore[arg-type]
            created_at=raw.created_at,
        )
    return TransactionObservationView(**raw)


def to_receipt_view(
    raw: dict[str, Any] | ReceivedTransactionTable,
    obs_list: list[dict[str, Any]] | list[TransactionObservationTable],
) -> ReceiptView:
    observations = [to_observation_view(o) for o in obs_list]
    if isinstance(raw, ReceivedTransactionTable):
        return ReceiptView(
            id=str(raw.id),
            shop_id=str(raw.shop_id),
            payment_account_id=str(raw.payment_account_id),
            provider=raw.provider,
            trx_id=raw.trx_id,
            amount_minor=int(raw.amount_minor),
            sender_number_raw=raw.sender_number_raw,
            sender_number_canonical=raw.sender_number_canonical,
            occurred_at=raw.occurred_at,
            reconciliation_state=raw.reconciliation_state,  # type: ignore[arg-type]
            has_conflict=bool(raw.has_conflict),
            version=int(raw.version),
            created_at=raw.created_at,
            updated_at=raw.updated_at,
            observations=observations,
            related_claims_count=0,
        )
    return ReceiptView(**raw, observations=observations, related_claims_count=0)
