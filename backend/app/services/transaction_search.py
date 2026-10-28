"""Shared received-payment search normalization and matching for the inbox list."""
from typing import Any, Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql.elements import ColumnElement

from app.models.seller import canonicalize_bd_phone


def normalize_transaction_search(term: Optional[str]) -> Optional[str]:
    """Trim one seller-entered term; blank means no search constraint."""
    if term is None:
        return None
    cleaned = term.strip()
    return cleaned or None


def transaction_search_phone(term: str) -> Optional[str]:
    """Return the canonical Bangladesh number only for a complete phone input."""
    try:
        return canonicalize_bd_phone(term)
    except ValueError:
        return None


def transaction_search_clause(
    term: Optional[str],
    *,
    receipt_id: InstrumentedAttribute[Any],
    trx_id: InstrumentedAttribute[Any],
    sender_number: InstrumentedAttribute[Any],
    receiving_number: InstrumentedAttribute[Any],
    account_label: InstrumentedAttribute[Any],
) -> Optional[ColumnElement[bool]]:
    """Build the OR predicate for the seller transaction list query."""
    cleaned = normalize_transaction_search(term)
    if cleaned is None:
        return None
    lowered = cleaned.lower()
    clauses: list[ColumnElement[bool]] = [
        func.lower(receipt_id) == lowered,
        func.lower(trx_id) == lowered,
        func.lower(account_label).contains(lowered, autoescape=True),
    ]
    phone = transaction_search_phone(cleaned)
    if phone is not None:
        clauses.append(sender_number == phone)
        clauses.append(receiving_number == phone)
    return or_(*clauses)


def matches_transaction_search(
    term: Optional[str],
    *,
    receipt_id: str,
    trx_id: str,
    sender_number_canonical: Optional[str],
    receiving_number: Optional[str],
    account_label: Optional[str],
) -> bool:
    """Offline equivalent of ``transaction_search_clause``."""
    cleaned = normalize_transaction_search(term)
    if cleaned is None:
        return True
    # Keep case and substring semantics aligned with the SQL clause above.
    lowered = cleaned.lower()
    if receipt_id.strip().lower() == lowered:
        return True
    if trx_id.strip().lower() == lowered:
        return True
    if account_label and lowered in account_label.lower():
        return True
    phone = transaction_search_phone(cleaned)
    return phone is not None and phone in (sender_number_canonical, receiving_number)
