"""Minimized projection of the authoritative manual preview; never authorizes a decision."""
from typing import Literal

from app.models.payment_decision import PaymentPreview
from app.models.review_assistance import SelectedPreviewContext
from app.services.review_assistance_context import ReviewDerivation

_TEXT = {
    "PROVIDER_MISMATCH": {
        "en": "The selected receipt provider differs from the claim or order provider.",
        "bn": "নির্বাচিত রসিদের সেবাদাতা দাবি বা অর্ডারের সেবাদাতা থেকে আলাদা।",
    },
    "TRANSACTION_ID_MISMATCH": {
        "en": "The selected receipt transaction ID differs from the buyer claim. Correct the claim before acceptance.",
        "bn": "নির্বাচিত রসিদের লেনদেন আইডি ক্রেতার দাবি থেকে আলাদা। গ্রহণের আগে দাবি সংশোধন করুন।",
    },
    "PAYMENT_EXCEEDS_TOTAL": {
        "en": "The selected payment exceeds the order total. It cannot be accepted for this order.",
        "bn": "নির্বাচিত পেমেন্ট অর্ডারের মোট টাকার বেশি। এই অর্ডারে এটি গ্রহণ করা যাবে না।",
    },
    "PAYMENT_USED": {
        "en": "The receipt or this order already has used or allocated payment protection.",
        "bn": "রসিদ বা এই অর্ডারে ইতিমধ্যে ব্যবহৃত বা বরাদ্দ পেমেন্টের সুরক্ষা রয়েছে।",
    },
    "COMPETING_CLAIMS": {
        "en": "Other claims or an earlier resolution must be resolved before acceptance.",
        "bn": "গ্রহণের আগে অন্য দাবি বা আগের সিদ্ধান্তের বাধা সমাধান করতে হবে।",
    },
    "CONFLICTING_RECEIPTS": {
        "en": "Conflicting receipt evidence must be resolved before acceptance.",
        "bn": "গ্রহণের আগে বিরোধপূর্ণ রসিদের তথ্য সমাধান করতে হবে।",
    },
}


def explain_preview(
    preview: PaymentPreview, derivation: ReviewDerivation, language: Literal["en", "bn"],
) -> tuple[SelectedPreviewContext, str]:
    conditions = sorted(set(preview.exceptions + preview.blockers))
    facts = derivation.facts
    facts.provider_comparison = "different" if "PROVIDER_MISMATCH" in conditions else "same"
    facts.transaction_id_comparison = "different" if "TRANSACTION_ID_MISMATCH" in conditions else "same"
    facts.received_amount_minor = preview.accepted_amount_minor
    facts.total_minor = preview.total_minor
    facts.currency = "BDT"
    # Manual preview can block a single other active claim, or an order allocation,
    # even when automatic matching does not report those conditions.
    intro = ("Selected receipt acceptance preview." if language == "en"
             else "নির্বাচিত রসিদ গ্রহণের প্রাকদর্শন।")
    sentences = [intro] + [_TEXT[code][language] for code in conditions if code in _TEXT]
    if preview.blockers:
        sentences.append("Cannot accept: resolve all preview blockers first." if language == "en"
                         else "গ্রহণ করা যাবে না: আগে প্রাকদর্শনের সব বাধা সমাধান করুন।")
    else:
        sentences.append("Existing acceptance checks and a separate seller decision still apply." if language == "en"
                         else "বিদ্যমান গ্রহণের যাচাই ও বিক্রেতার পৃথক সিদ্ধান্ত এখনও প্রযোজ্য।")
    return SelectedPreviewContext(conditions=conditions, blockers=preview.blockers), " ".join(sentences)
