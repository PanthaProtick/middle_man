import hashlib
import json
from typing import Literal, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.review_assistance import (
    ReviewAction,
    ReviewAssistanceResponse,
    ReviewProviderContext,
    SuggestedAction,
)
from app.services.review_assistance_context import derive_review
from app.services.review_assistance_preview import explain_preview
from app.services.review_assistance_snapshot import (
    AssistanceSnapshot,
    IneligibleLifecycleError,
    load_assistance_snapshot,
)
from app.services.review_assistance_text import action_label, build_explanation
from app.services.seller_service import NotFoundError, SellerDomainException


def _make_actions(action_ids: list[ReviewAction], language: Literal["en", "bn"]) -> list[SuggestedAction]:
    actions: list[SuggestedAction] = []
    for action_id in action_ids:
        target: Literal["transactions", "buyer_tab"] = (
            "transactions" if action_id == "CHECK_TRANSACTIONS" else "buyer_tab"
        )
        actions.append(SuggestedAction(
            action_id=action_id,
            label=action_label(action_id, language),
            target=target,
        ))
    return actions


def _context_token(snapshot: AssistanceSnapshot, derivation) -> str:  # type: ignore[no-untyped-def]
    # Opaque and content-free; locale is deliberately excluded so translation needs no new token.
    payload = [
        snapshot.freshness,
        derivation.condition,
        derivation.reason_codes,
        derivation.unknown_reason_present,
        derivation.facts.model_dump(),
        derivation.action_ids,
    ]
    return hashlib.sha256(json.dumps(payload, default=str).encode()).hexdigest()


async def get_review_assistance(
    db: Optional[AsyncSession],
    shop_id: str,
    order_id: str,
    language: Literal["en", "bn"] = "en",
    receipt_id: Optional[str] = None,
) -> ReviewAssistanceResponse:
    snapshot = await load_assistance_snapshot(db, shop_id, order_id, receipt_id)
    derivation = derive_review(
        order_id=snapshot.order_id,
        order=snapshot.order,
        claim=snapshot.claim,
        claim_identity_present=snapshot.claim_identity_present,
        receipt=snapshot.receipt,
        claims=snapshot.claims,
        allocated=snapshot.allocated,
        used_marker_present=snapshot.used_marker_present,
        stored_reasons=snapshot.stored_reasons,
    )
    explanation = build_explanation(derivation, language)
    selected_preview = None
    if snapshot.preview:
        selected_preview, preview_text = explain_preview(snapshot.preview, derivation, language)
        explanation = preview_text + (" " + explanation if derivation.reason_codes else "")
    suggested_actions = _make_actions(derivation.action_ids, language)
    context = ReviewProviderContext(
        condition=derivation.condition,
        reason_codes=derivation.reason_codes,
        unknown_reason_present=derivation.unknown_reason_present,
        locale=language,
        facts=derivation.facts,
        permitted_actions=derivation.action_ids,
        selected_preview=selected_preview,
    )
    context_token = _context_token(snapshot, derivation)

    # The local builder has await points: reject concurrent changes to the order,
    # receipt, resolution history, allocations, or related claims instead of
    # returning facts bound to obsolete records.
    try:
        recheck = await load_assistance_snapshot(db, shop_id, order_id, receipt_id)
    except (IneligibleLifecycleError, NotFoundError):
        raise SellerDomainException(409, "REVIEW_CHANGED", "Review changed. Refresh the order.") from None
    if recheck.freshness != snapshot.freshness:
        raise SellerDomainException(409, "REVIEW_CHANGED", "Review changed. Refresh the order.")

    return ReviewAssistanceResponse(
        order_id=snapshot.order_id,
        order_version=snapshot.order_version,
        buyer_revision=snapshot.buyer_revision,
        lifecycle="pending",
        source="local",
        condition=derivation.condition,
        context_token=context_token,
        reason_codes=derivation.reason_codes,
        unknown_reason_present=derivation.unknown_reason_present,
        explanation=explanation,
        suggested_actions=suggested_actions,
        facts=derivation.facts,
        context=context,
        locale=language,
        selected_receipt_id=receipt_id,
        selected_receipt_version=snapshot.selected_version,
        preview_conditions=selected_preview.conditions if selected_preview else [],
        preview_blockers=selected_preview.blockers if selected_preview else [],
    )
