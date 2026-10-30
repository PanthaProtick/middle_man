"""Localized explanation composition for advisory review assistance."""
from typing import Literal

from app.models.review_assistance import ConflictCategory, ReviewAction, ReviewFacts
from app.services.reconciliation_rules import (
    AMOUNT_MISMATCH,
    COMPETING_CLAIMS,
    CONFLICTING_RECEIPTS,
    PAYMENT_USED,
    SENDER_MISMATCH,
    TIME_UNCLEAR,
    WRONG_RECEIVING_ACCOUNT,
)
from app.services.review_assistance_context import ReviewDerivation

Language = Literal["en", "bn"]

_CONDITIONS_TEXT: dict[str, dict[str, str]] = {
    "NO_RECORDED_RECEIPT": {
        "en": (
            "No matching seller transaction record was found for this payment claim. "
            "This does not mean the buyer did not pay; the payment receipt may not have been imported or recorded yet."
        ),
        "bn": (
            "এই পেমেন্ট দাবির সাথে মিল থাকা কোনো বিক্রেতা লেনদেন রেকর্ড পাওয়া যায়নি। "
            "এর মানে এই নয় যে ক্রেতা অর্থ প্রদান করেননি; পেমেন্ট রসিদটি এখনও আমদানি বা রেকর্ড করা নাও হতে পারে।"
        ),
    },
    "UNKNOWN_CAUSE": {
        "en": (
            "This order is pending review for an unknown reason. "
            "No specific review reason code or missing receipt condition was detected."
        ),
        "bn": (
            "এই অর্ডারটি একটি অজানা কারণে পর্যালোচনার জন্য অপেক্ষমাণ রয়েছে। "
            "কোনো সুনির্দিষ্ট পর্যালোচনা কারণ কোড বা অনুপস্থিত রসিদ শনাক্ত করা যায়নি।"
        ),
    },
    "UNSUPPORTED_REASON_CODE": {
        "en": (
            "This order has pending review reasons that require manual verification. "
            "Specific automated review assistance for these reasons is not available yet."
        ),
        "bn": (
            "এই অর্ডারে পর্যালোচনার জন্য অপেক্ষমাণ কারণ রয়েছে যা ম্যানুয়ালি যাচাই করা প্রয়োজন। "
            "এই কারণগুলির জন্য নির্দিষ্ট স্বয়ংক্রিয় সহায়তা এখনও উপলব্ধ নেই।"
        ),
    },
}

_MULTIPLE_INTRO: dict[str, str] = {
    "en": "This submission has several review reasons.",
    "bn": "এই জমাদানে একাধিক পর্যালোচনা কারণ রয়েছে।",
}

_UNKNOWN_NOTE: dict[str, str] = {
    "en": (
        "Some stored review reasons are not recognized by this version and still require manual verification."
    ),
    "bn": (
        "কিছু সংরক্ষিত পর্যালোচনা কারণ এই সংস্করণে শনাক্ত করা যায় না এবং সেগুলি এখনও ম্যানুয়ালি যাচাই করা প্রয়োজন।"
    ),
}

_CONFLICT_LABELS: dict[ConflictCategory, dict[str, str]] = {
    "amount": {"en": "amount", "bn": "পরিমাণ"},
    "receiving_account": {"en": "receiving account", "bn": "গ্রহণকারী অ্যাকাউন্ট"},
    "sender": {"en": "sender", "bn": "প্রেরক"},
    "time": {"en": "time", "bn": "সময়"},
}

_ACTIONS_TEXT: dict[str, dict[str, str]] = {
    "CHECK_TRANSACTIONS": {"en": "Check transactions", "bn": "লেনদেন পরীক্ষা করুন"},
    "CORRECT_BUYER_DETAILS": {"en": "Correct buyer details", "bn": "ক্রেতার তথ্য সংশোধন করুন"},
}


def format_bdt(amount_minor: int) -> str:
    taka, paisa = divmod(amount_minor, 100)
    return f"BDT {taka:,}.{paisa:02d}"


def action_label(action_id: ReviewAction, language: Language) -> str:
    return _ACTIONS_TEXT[action_id][language]


def build_explanation(derivation: ReviewDerivation, language: Language) -> str:
    if not derivation.reason_codes:
        return _CONDITIONS_TEXT[derivation.condition][language]
    sentences = [_reason_sentence(reason, derivation.facts, language) for reason in derivation.reason_codes]
    if derivation.condition == "MULTIPLE_REVIEW_REASONS":
        sentences.insert(0, _MULTIPLE_INTRO[language])
    if derivation.unknown_reason_present:
        sentences.append(_UNKNOWN_NOTE[language])
    return " ".join(sentence for sentence in sentences if sentence)


def _reason_sentence(reason: str, facts: ReviewFacts, language: Language) -> str:
    if reason == SENDER_MISMATCH:
        return _sender_sentence(facts, language)
    if reason == AMOUNT_MISMATCH:
        return _amount_sentence(facts, language)
    if reason == TIME_UNCLEAR:
        return _time_sentence(facts, language)
    if reason == WRONG_RECEIVING_ACCOUNT:
        if language == "bn":
            return "রেকর্ড করা পেমেন্ট এই অর্ডারের অ্যাকাউন্টের পরিবর্তে অন্য একটি পেমেন্ট অ্যাকাউন্টে গৃহীত হয়েছে।"
        return "The recorded payment was received into a different payment account than the one on this order."
    if reason == CONFLICTING_RECEIPTS:
        return _conflict_sentence(facts, language)
    if reason == COMPETING_CLAIMS:
        return _competing_sentence(facts, language)
    if reason == PAYMENT_USED:
        return _payment_used_sentence(facts, language)
    return ""


def _sender_sentence(facts: ReviewFacts, language: Language) -> str:
    if language == "bn":
        if facts.sender_status == "missing":
            return "রেকর্ড করা পেমেন্টে কোনো প্রেরকের নম্বর নেই, তাই এটি ক্রেতার দাবি করা প্রেরকের নম্বরের সঙ্গে মেলানো যাচ্ছে না।"
        return "রেকর্ড করা পেমেন্টের প্রেরকের নম্বর ক্রেতা যে নম্বর জমা দিয়েছেন তার থেকে আলাদা।"
    if facts.sender_status == "missing":
        return "The recorded payment has no sender number, so it cannot be matched to the buyer's claimed sender number."
    return "The sender number on the recorded payment is different from the sender number the buyer submitted."


def _amount_sentence(facts: ReviewFacts, language: Language) -> str:
    required = format_bdt(facts.required_advance_minor or 0)
    claimed = format_bdt(facts.claimed_amount_minor or 0)
    received = format_bdt(facts.received_amount_minor or 0)
    if language == "bn":
        return f"অর্ডারটিতে {required} অগ্রিম প্রয়োজন, ক্রেতা {claimed} দাবি করেছেন এবং রেকর্ড করা পেমেন্ট {received}।"
    return f"The order requires an advance of {required}, the buyer claimed {claimed}, and the recorded payment is {received}."


def _time_sentence(facts: ReviewFacts, language: Language) -> str:
    if language == "bn":
        if facts.time_status == "before_order_creation":
            return "রেকর্ড করা পেমেন্টের সময় এই অর্ডার তৈরির আগের।"
        if facts.time_status == "after_claim_submission":
            return "রেকর্ড করা পেমেন্টের সময় ক্রেতা এই দাবি জমা দেওয়ার পরের।"
        return "রেকর্ড করা পেমেন্টের কোনো সময় নেই, তাই এটি অর্ডার তৈরির ও দাবি জমার সময়ের সঙ্গে যাচাই করা যাচ্ছে না।"
    if facts.time_status == "before_order_creation":
        return "The recorded payment time is before this order was created."
    if facts.time_status == "after_claim_submission":
        return "The recorded payment time is after the buyer submitted this claim."
    return "The recorded payment has no time, so it cannot be checked against the order creation and claim submission times."


def _conflict_sentence(facts: ReviewFacts, language: Language) -> str:
    categories = [(_CONFLICT_LABELS[category][language]) for category in (facts.conflict_categories or [])]
    if language == "bn":
        if categories:
            return (
                "একই লেনদেন আইডির জন্য পরস্পরবিরোধী রসিদ রেকর্ড করা হয়েছে। "
                f"বিরোধপূর্ণ তথ্যের ধরন: {', '.join(categories)}।"
            )
        return "একই লেনদেন আইডির জন্য পরস্পরবিরোধী রসিদ রেকর্ড করা হয়েছে।"
    if categories:
        return (
            "Conflicting receipts were recorded for the same transaction ID. "
            f"The conflicting details involve: {', '.join(categories)}."
        )
    return "Conflicting receipts were recorded for the same transaction ID."


def _competing_sentence(facts: ReviewFacts, language: Language) -> str:
    if facts.claim_held_by_prior_resolution:
        if language == "bn":
            return (
                "এই পেমেন্টের জন্য আগের একটি পর্যালোচনা সিদ্ধান্তে এই দাবিটি ধরে রাখা হয়েছে। "
                "এটি সক্রিয় প্রতিদ্বন্দ্বী দাবির অন্তর্ভুক্ত নয় এবং ম্যানুয়ালি নিষ্পত্তি প্রয়োজন।"
            )
        return (
            "This claim was held by an earlier review decision for this payment. "
            "It is not part of the active competing claims and requires manual resolution."
        )
    count = facts.active_claim_count or 0
    if language == "bn":
        return f"এই দোকানে {count}টি সক্রিয় দাবি একই পেমেন্ট লেনদেন ব্যবহার করছে।"
    return f"{count} active claims in this shop use the same payment transaction."


def _payment_used_sentence(facts: ReviewFacts, language: Language) -> str:
    used = bool(facts.payment_used)
    allocated = bool(facts.payment_allocated)
    if language == "bn":
        if used and allocated:
            return "রেকর্ড করা পেমেন্টটি ইতিমধ্যে ব্যবহৃত এবং অন্য একটি অর্ডারে বরাদ্দ করা হয়েছে।"
        if allocated:
            return "রেকর্ড করা পেমেন্টটি ইতিমধ্যে অন্য একটি অর্ডারে বরাদ্দ করা হয়েছে।"
        return "রেকর্ড করা পেমেন্টটি ইতিমধ্যে ব্যবহৃত হিসেবে চিহ্নিত।"
    if used and allocated:
        return "The recorded payment is already used and allocated to another order."
    if allocated:
        return "The recorded payment is already allocated to another order."
    return "The recorded payment is already marked as used."
