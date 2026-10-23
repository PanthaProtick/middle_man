import datetime
from dataclasses import dataclass
from typing import List, Optional

# Typed seller-visible review reasons
SENDER_MISMATCH = "SENDER_MISMATCH"
AMOUNT_MISMATCH = "AMOUNT_MISMATCH"
TIME_UNCLEAR = "TIME_UNCLEAR"
WRONG_RECEIVING_ACCOUNT = "WRONG_RECEIVING_ACCOUNT"
CONFLICTING_RECEIPTS = "CONFLICTING_RECEIPTS"
COMPETING_CLAIMS = "COMPETING_CLAIMS"
PAYMENT_USED = "PAYMENT_USED"


@dataclass(frozen=True)
class AllocationRecord:
    id: str
    shop_id: str
    order_id: str
    transaction_id: str
    accepted_amount_minor: int
    basis: str
    actor: str
    reason: Optional[str]
    created_at: datetime.datetime


def evaluate_candidate_match(
    order_account_id: str,
    order_advance_minor: int,
    order_created_at: datetime.datetime,
    claim_amount_minor: int,
    claim_sender_canonical: str,
    claim_submission_time: datetime.datetime,
    tx_account_id: str,
    tx_amount_minor: int,
    tx_sender_canonical: Optional[str],
    tx_occurred_at: Optional[datetime.datetime],
    tx_has_conflict: bool,
    is_tx_allocated_or_used: bool,
    competing_active_claims_count: int,
) -> List[str]:
    """
    Pure evaluation rule checklist. Shared between in-memory and database reconciliation.
    Returns list of review reasons. If empty, the match qualifies for automatic confirmation.
    """
    reasons: List[str] = []

    if is_tx_allocated_or_used:
        reasons.append(PAYMENT_USED)

    if competing_active_claims_count > 1:
        reasons.append(COMPETING_CLAIMS)

    if tx_has_conflict:
        reasons.append(CONFLICTING_RECEIPTS)

    if tx_account_id != order_account_id:
        reasons.append(WRONG_RECEIVING_ACCOUNT)

    if tx_amount_minor != order_advance_minor or claim_amount_minor != order_advance_minor:
        reasons.append(AMOUNT_MISMATCH)

    if not tx_sender_canonical or tx_sender_canonical != claim_sender_canonical:
        reasons.append(SENDER_MISMATCH)

    if tx_occurred_at is None:
        reasons.append(TIME_UNCLEAR)
    elif tx_occurred_at < order_created_at or tx_occurred_at > claim_submission_time:
        reasons.append(TIME_UNCLEAR)

    return sorted(list(set(reasons)))
