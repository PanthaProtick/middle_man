"""Pure derivation of current review reasons, minimal facts, and allowed actions."""
import datetime
from dataclasses import dataclass
from typing import Optional, Sequence, cast

from app.models.review_assistance import (
    AutomaticReviewReason,
    ConflictCategory,
    ReviewAction,
    ReviewCondition,
    ReviewFacts,
    TimeStatus,
)
from app.services.reconciliation_rules import (
    AMOUNT_MISMATCH,
    COMPETING_CLAIMS,
    CONFLICTING_RECEIPTS,
    PAYMENT_USED,
    SENDER_MISMATCH,
    TIME_UNCLEAR,
    WRONG_RECEIVING_ACCOUNT,
    evaluate_candidate_match,
)

AUTOMATIC_REVIEW_REASONS: tuple[str, ...] = (
    SENDER_MISMATCH,
    AMOUNT_MISMATCH,
    TIME_UNCLEAR,
    WRONG_RECEIVING_ACCOUNT,
    CONFLICTING_RECEIPTS,
    COMPETING_CLAIMS,
    PAYMENT_USED,
)
CANONICAL_REASON_ORDER: tuple[str, ...] = (
    PAYMENT_USED,
    COMPETING_CLAIMS,
    CONFLICTING_RECEIPTS,
    WRONG_RECEIVING_ACCOUNT,
    AMOUNT_MISMATCH,
    SENDER_MISMATCH,
    TIME_UNCLEAR,
)
_CONFLICT_CATEGORY_ORDER: tuple[ConflictCategory, ...] = ("amount", "receiving_account", "sender", "time")
_ACTION_ORDER: tuple[ReviewAction, ReviewAction] = ("CHECK_TRANSACTIONS", "CORRECT_BUYER_DETAILS")
_REASON_ACTIONS: dict[str, tuple[ReviewAction, ...]] = {
    SENDER_MISMATCH: _ACTION_ORDER,
    AMOUNT_MISMATCH: _ACTION_ORDER,
    TIME_UNCLEAR: _ACTION_ORDER,
    WRONG_RECEIVING_ACCOUNT: _ACTION_ORDER,
    CONFLICTING_RECEIPTS: ("CHECK_TRANSACTIONS",),
    COMPETING_CLAIMS: ("CHECK_TRANSACTIONS",),
    PAYMENT_USED: ("CHECK_TRANSACTIONS",),
}


@dataclass(frozen=True)
class OrderSnapshot:
    payment_account_id: str
    required_advance_minor: int
    created_at: datetime.datetime


@dataclass(frozen=True)
class ClaimPaymentSnapshot:
    amount_minor: int
    sender_canonical: Optional[str]
    submitted_at: datetime.datetime


@dataclass(frozen=True)
class ObservationSnapshot:
    id: str
    payment_account_id: str
    amount_minor: int
    sender_canonical: Optional[str]
    occurred_at: Optional[datetime.datetime]
    conflict_state: str


@dataclass(frozen=True)
class ReceiptSnapshot:
    payment_account_id: str
    amount_minor: int
    sender_canonical: Optional[str]
    occurred_at: Optional[datetime.datetime]
    has_conflict: bool
    reconciliation_state: str
    version: int
    observations: tuple[ObservationSnapshot, ...]


@dataclass(frozen=True)
class ClaimSnapshot:
    order_id: str
    revision_id: str
    lifecycle: str
    held_by_resolution: bool


@dataclass(frozen=True)
class ReviewDerivation:
    condition: ReviewCondition
    reason_codes: list[AutomaticReviewReason]
    unknown_reason_present: bool
    facts: ReviewFacts
    action_ids: list[ReviewAction]


def derive_review(
    *,
    order_id: str,
    order: OrderSnapshot,
    claim: ClaimPaymentSnapshot,
    claim_identity_present: bool,
    receipt: Optional[ReceiptSnapshot],
    claims: Sequence[ClaimSnapshot],
    allocated: bool,
    used_marker_present: bool,
    stored_reasons: Sequence[str],
) -> ReviewDerivation:
    unknown = any(code not in AUTOMATIC_REVIEW_REASONS for code in stored_reasons)
    if receipt is None:
        condition: ReviewCondition = (
            "UNSUPPORTED_REASON_CODE" if unknown
            else "NO_RECORDED_RECEIPT" if claim_identity_present
            else "UNKNOWN_CAUSE"
        )
        return ReviewDerivation(
            condition=condition,
            reason_codes=[],
            unknown_reason_present=unknown,
            facts=ReviewFacts(has_matching_receipt=False),
            action_ids=_actions_for(condition, [], unknown),
        )

    this_claim = next((item for item in claims if item.order_id == order_id), None)
    held = bool(this_claim and this_claim.held_by_resolution)
    active_claim_count = len([item for item in claims
                              if item.lifecycle == "pending" and not item.held_by_resolution])
    payment_used = used_marker_present or receipt.reconciliation_state in ("used", "allocated")
    payment_allocated = allocated or receipt.reconciliation_state == "allocated"

    if held:
        reasons = cast(list[AutomaticReviewReason], [COMPETING_CLAIMS])
    else:
        evaluated = evaluate_candidate_match(
            order_account_id=order.payment_account_id,
            order_advance_minor=order.required_advance_minor,
            order_created_at=order.created_at,
            claim_amount_minor=claim.amount_minor,
            claim_sender_canonical=claim.sender_canonical or "",
            claim_submission_time=claim.submitted_at,
            tx_account_id=receipt.payment_account_id,
            tx_amount_minor=receipt.amount_minor,
            tx_sender_canonical=receipt.sender_canonical,
            tx_occurred_at=receipt.occurred_at,
            tx_has_conflict=receipt.has_conflict,
            is_tx_allocated_or_used=payment_used or payment_allocated,
            competing_active_claims_count=active_claim_count,
        )
        evaluated_set = set(evaluated)
        reasons = cast(
            list[AutomaticReviewReason],
            [code for code in CANONICAL_REASON_ORDER if code in evaluated_set],
        )

    if reasons:
        condition = reasons[0] if len(reasons) == 1 else "MULTIPLE_REVIEW_REASONS"
    elif unknown:
        condition = "UNSUPPORTED_REASON_CODE"
    else:
        condition = "UNKNOWN_CAUSE"

    facts = _facts_for(
        reasons=reasons,
        order=order,
        claim=claim,
        receipt=receipt,
        active_claim_count=active_claim_count,
        held=held,
        payment_used=payment_used,
        payment_allocated=payment_allocated,
    )
    return ReviewDerivation(
        condition=condition,
        reason_codes=reasons,
        unknown_reason_present=unknown,
        facts=facts,
        action_ids=_actions_for(condition, reasons, unknown),
    )


def _facts_for(
    *,
    reasons: Sequence[str],
    order: OrderSnapshot,
    claim: ClaimPaymentSnapshot,
    receipt: ReceiptSnapshot,
    active_claim_count: int,
    held: bool,
    payment_used: bool,
    payment_allocated: bool,
) -> ReviewFacts:
    facts = ReviewFacts(has_matching_receipt=True)
    if AMOUNT_MISMATCH in reasons:
        facts.required_advance_minor = order.required_advance_minor
        facts.claimed_amount_minor = claim.amount_minor
        facts.received_amount_minor = receipt.amount_minor
        facts.currency = "BDT"
    if SENDER_MISMATCH in reasons:
        facts.sender_status = "missing" if not receipt.sender_canonical else "different"
    if TIME_UNCLEAR in reasons:
        facts.time_status = _time_status(receipt.occurred_at, order.created_at, claim.submitted_at)
    if WRONG_RECEIVING_ACCOUNT in reasons:
        facts.receiving_account_comparison = "different"
    if CONFLICTING_RECEIPTS in reasons:
        facts.conflict_categories = _conflict_categories(receipt)
    if COMPETING_CLAIMS in reasons:
        facts.active_claim_count = active_claim_count
        facts.claim_held_by_prior_resolution = held
    if PAYMENT_USED in reasons:
        facts.payment_used = payment_used
        facts.payment_allocated = payment_allocated
    return facts


def _time_status(
    occurred_at: Optional[datetime.datetime],
    order_created_at: datetime.datetime,
    claim_submitted_at: datetime.datetime,
) -> Optional[TimeStatus]:
    if occurred_at is None:
        return "missing"
    if occurred_at < order_created_at:
        return "before_order_creation"
    if occurred_at > claim_submitted_at:
        return "after_claim_submission"
    return None


def _conflict_categories(receipt: ReceiptSnapshot) -> list[ConflictCategory]:
    categories: set[ConflictCategory] = set()
    for observation in receipt.observations:
        if observation.conflict_state != "conflicting":
            continue
        if observation.amount_minor != receipt.amount_minor:
            categories.add("amount")
        if observation.payment_account_id != receipt.payment_account_id:
            categories.add("receiving_account")
        if observation.sender_canonical != receipt.sender_canonical:
            categories.add("sender")
        if observation.occurred_at != receipt.occurred_at:
            categories.add("time")
    return [category for category in _CONFLICT_CATEGORY_ORDER if category in categories]


def _actions_for(
    condition: ReviewCondition,
    reasons: Sequence[str],
    unknown: bool,
) -> list[ReviewAction]:
    if unknown or condition in ("NO_RECORDED_RECEIPT", "UNSUPPORTED_REASON_CODE"):
        return list(_ACTION_ORDER)
    if condition == "UNKNOWN_CAUSE":
        return ["CHECK_TRANSACTIONS"]
    selected: set[ReviewAction] = set()
    for reason in reasons:
        selected.update(_REASON_ACTIONS.get(reason, ()))
    return [action for action in _ACTION_ORDER if action in selected]
