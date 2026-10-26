import datetime
import uuid
from typing import Any

from app.models.buyer import BuyerSubmission


def buyer_revision(submission: BuyerSubmission, order_id: str, now: datetime.datetime) -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "revision_number": 1,
        "claim_accepted_at": now,
        "buyer_name": submission.buyer_name,
        "contact_number_raw": submission.contact_number_raw,
        "contact_number_canonical": submission.contact_number_canonical,
        "address_raw": submission.address.raw_text,
        "address_district": submission.address.district,
        "address_thana": submission.address.thana,
        "address_area": submission.address.area,
        "address_street_line": submission.address.street_line,
        "address_landmark": submission.address.landmark,
        "address_pathao": submission.address.pathao.model_dump_json() if submission.address.pathao else None,
        "payment_provider": submission.payment_claim.provider,
        "payment_trx_id": submission.payment_claim.trx_id,
        "payment_sender_raw": submission.payment_claim.sender_number_raw,
        "payment_sender_canonical": submission.payment_claim.sender_number_canonical,
        "payment_amount_minor": submission.payment_claim.amount_minor,
        "payment_claimed_at": submission.payment_claim.claimed_at,
        "payment_evidence_id": submission.payment_claim.evidence_id,
        "source": "buyer",
        "actor": "buyer",
        "reason": None,
        "created_at": now,
        }
