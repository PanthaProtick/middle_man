"""Bounded Gemini transport; no retries, tools, history, logging, or content cache."""
import asyncio
import hashlib
import json
import re
import threading

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.core.config import settings
from app.models.review_assistance import ReviewAction, ReviewAssistanceResponse, ReviewProviderContext


class GeneratedExplanation(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    explanation: str = Field(min_length=1, max_length=2000)
    action_ids: list[ReviewAction] = Field(max_length=2)


class RejectedGeneration(Exception):
    pass


def opaque_key(*parts: str) -> str:
    return hashlib.sha256("\0".join(parts).encode()).hexdigest()


class InFlightGuard:
    """Suppresses duplicate concurrent work; it is not a quota or throttle."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._active: set[str] = set()

    def reserve(self, key: str) -> bool:
        with self._lock:
            if key in self._active:
                return False
            self._active.add(key)
            return True

    def release(self, key: str) -> None:
        with self._lock:
            self._active.discard(key)


inflight = InFlightGuard()

# The application has not established these outcomes, so generated wording may
# not claim them. Negative statements ("payment is not confirmed") do not match.
_RESULT_SUBJECT = (
    r"(?:payments?|transactions?|orders?|reviews?|bookings?|claims?|refunds?)"
)
_RESULT_VERB = (
    r"(?:approved|confirmed|verified|completed|resolved|created|saved|placed|booked|accepted)"
)
_ENGLISH_SUCCESS_CLAIM = re.compile(
    rf"\b{_RESULT_SUBJECT}\b"
    r"(?:\s+(?:is|was|are|were|has|have|had|been|will\s+be|now|already|successfully|fully))*"
    rf"\s+{_RESULT_VERB}\b",
    re.IGNORECASE,
)
_BENGALI_SUCCESS_CLAIM = re.compile(
    r"(?:পেমেন্ট|লেনদেন|অর্ডার|রিভিউ|বুকিং|দাবি|রিফান্ড)[^।!?\n]{0,30}?"
    r"(?:অনুমোদিত|নিশ্চিত|সম্পন্ন|সমাধান\s+হয়েছে|তৈরি\s+হয়েছে|সংরক্ষিত|"
    r"বুক\s+হয়েছে|যাচাই\s+হয়েছে)"
    r"(?!\s*(?:করা\s+)?(?:হয়নি|নয়|না|নি|করুন|করো))"
)


def _claims_unsupported_success(text: str) -> bool:
    return bool(
        _ENGLISH_SUCCESS_CLAIM.search(text) or _BENGALI_SUCCESS_CLAIM.search(text)
    )


async def generate(context: ReviewProviderContext) -> str:
    instruction = (
        "Explain these authoritative review facts concisely in the specified locale. "
        "You cannot verify or approve payment or relax blockers. Do not invent facts. "
        "Return JSON with explanation (plain text, at most 2000 characters) and action_ids "
        "(only permitted_actions). No URLs, markup, identifiers, or additional fields."
    )
    model = settings.GEMINI_MODEL
    if not re.fullmatch(r"gemini-[a-zA-Z0-9.-]{1,80}", model):
        raise RejectedGeneration()
    async with httpx.AsyncClient(timeout=12, follow_redirects=False) as client:
        async with client.stream(
            "POST", f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            headers={"x-goog-api-key": settings.GEMINI_API_KEY},
            json={
                "systemInstruction": {"parts": [{"text": instruction}]},
                "contents": [{"role": "user", "parts": [{"text": context.model_dump_json()}]}],
                "generationConfig": {"responseMimeType": "application/json", "maxOutputTokens": 800},
            },
        ) as response:
            if response.status_code != 200:
                raise RejectedGeneration()
            body = bytearray()
            async for chunk in response.aiter_bytes():
                body.extend(chunk)
                if len(body) > 16384:
                    raise ValueError("Oversized response")
    document = json.loads(body)
    candidate = document["candidates"][0]
    if candidate.get("finishReason") != "STOP":
        raise RejectedGeneration()
    parts = candidate["content"]["parts"]
    if len(parts) != 1 or not isinstance(parts[0], dict):
        raise ValueError("Malformed response")
    part = parts[0]
    text = part.get("text")
    # Signatures are transport metadata, not generated advice or chat history.
    if (not set(part).issubset({"text", "thought", "thoughtSignature"}) or
            not isinstance(text, str) or part.get("thought", False) is not False or
            ("thoughtSignature" in part and not isinstance(part["thoughtSignature"], str))):
        raise ValueError("Malformed response")
    return text


async def generate_review(local: ReviewAssistanceResponse, shop_id: str) -> ReviewAssistanceResponse:
    if not settings.REVIEW_GEMINI_ENABLED or not settings.ai_enabled:
        return local.model_copy(update={"fallback_status": "disabled"})
    if not settings.is_gemini_configured:
        return local.model_copy(update={"fallback_status": "unconfigured"})
    review = opaque_key(shop_id, local.order_id, local.context_token, local.locale)
    if not inflight.reserve(review):
        return local.model_copy(update={"fallback_status": "busy"})
    try:
        async with asyncio.timeout(15):
            raw = await generate(local.context)
        if len(raw.encode()) > 8192:
            raise ValueError("Oversized response")
        result = GeneratedExplanation.model_validate_json(raw)
        if (not result.explanation.strip() or
                re.search(r"\b[a-z][a-z0-9+.-]*:\S|//|www\.|"
                          r"\b(?:[\w-]+\.)+[^\W\d_]{2,63}\b|\b(?:\d{1,3}\.){3}\d{1,3}\b|[<>\[\]]",
                          result.explanation, re.IGNORECASE) or
                len(set(result.action_ids)) != len(result.action_ids) or
                not set(result.action_ids).issubset(local.context.permitted_actions) or
                _claims_unsupported_success(result.explanation)):
            raise ValueError("Invalid advice")
        # Navigation and blockers always come from the backend, never generated text.
        return local.model_copy(update={"source": "generated", "explanation": result.explanation})
    except (TimeoutError, httpx.TimeoutException):
        status = "timeout"
    except RejectedGeneration:
        status = "rejected"
    except (ValueError, ValidationError, KeyError, IndexError, TypeError):
        status = "malformed"
    except Exception:
        # Provider exception bodies may contain request content or secrets.
        status = "unavailable"
    finally:
        inflight.release(review)
    return local.model_copy(update={"fallback_status": status})
