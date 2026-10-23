import pytest
from pydantic import ValidationError

from app.models.buyer import (
    Address,
    BuyerSubmission,
    PaymentClaim,
    canonicalize_bd_phone,
    clean_trx_id,
)


def test_canonicalize_bd_phone_bangla_digits():
    raw = "০১৭১২৩৪৫৬৭৮"
    assert canonicalize_bd_phone(raw) == "01712345678"


def test_canonicalize_bd_phone_with_plus_880_and_spaces():
    raw = "+880 1812-345678"
    assert canonicalize_bd_phone(raw) == "01812345678"


def test_canonicalize_bd_phone_invalid():
    with pytest.raises(ValueError, match="Invalid Bangladeshi phone number"):
        canonicalize_bd_phone("01234567890")  # Invalid operator prefix

    with pytest.raises(ValueError, match="Invalid Bangladeshi phone number"):
        canonicalize_bd_phone("1712345678")  # Missing leading 0


def test_clean_trx_id_trims_boundaries_without_case_folding():
    raw = "  TX123abCD  "
    # Preserves casing, trims whitespace
    assert clean_trx_id(raw) == "TX123abCD"


def test_payment_claim_validates_and_preserves_raw_and_canonical():
    claim = PaymentClaim(
        provider="bkash",
        trx_id="  TRX987654  ",
        sender_number="০১৮১২-৩৪৫৬৭৮",
        amount_minor=10000,
    )
    assert claim.trx_id == "TRX987654"
    assert claim.sender_number_raw == "০১৮১২-৩৪৫৬৭৮"
    assert claim.sender_number_canonical == "01812345678"
    assert claim.amount_minor == 10000


def test_payment_claim_rejects_non_positive_or_unsafe_amount():
    with pytest.raises(ValidationError):
        PaymentClaim(
            provider="bkash",
            trx_id="TRX123",
            sender_number="01712345678",
            amount_minor=0,
        )

    with pytest.raises(ValidationError):
        PaymentClaim(
            provider="bkash",
            trx_id="TRX123",
            sender_number="01712345678",
            amount_minor=-500,
        )


def test_buyer_submission_accepts_different_contact_and_sender():
    sub = BuyerSubmission(
        buyer_name="Rahim Uddin",
        contact_number="01711111111",
        address=Address(raw_text="House 12, Road 5, Dhanmondi, Dhaka"),
        payment_claim=PaymentClaim(
            provider="nagad",
            trx_id="NAGAD123",
            sender_number="০১৮২২২২২২২২",
            amount_minor=20000,
        ),
    )
    assert sub.contact_number_raw == "01711111111"
    assert sub.contact_number_canonical == "01711111111"
    assert sub.payment_claim.sender_number_canonical == "01822222222"
    assert sub.contact_number_canonical != sub.payment_claim.sender_number_canonical


@pytest.mark.parametrize("amount", [True, "10000", 1.5, 9007199254740992])
def test_claim_rejects_coercion_and_unsafe_integer(amount):
    with pytest.raises(ValidationError):
        PaymentClaim(provider="bkash", trx_id="Synthetic", sender_number="01712345678", amount_minor=amount)


def test_claim_preserves_raw_phone_and_rejects_client_internal_fields():
    claim = {"provider": "bkash", "trx_id": "  Case Sensitive  ", "sender_number": " +880 1812-345678 ", "amount_minor": 10000}
    saved = PaymentClaim(**claim)
    assert saved.sender_number_raw == claim["sender_number"]
    assert saved.trx_id == "Case Sensitive"
    for override in ({"sender_number_canonical": "01712345678"}, {"lifecycle": "confirmed"}, {"evidence_id": "foreign-evidence"}, {"claimed_at": "2026-10-23T12:00:00"}):
        with pytest.raises(ValidationError):
            PaymentClaim(**{**claim, **override})
