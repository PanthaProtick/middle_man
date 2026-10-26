"""Validation and sanitization of courier outcomes and errors."""
import asyncio
from typing import Any

import httpx

from app.models.courier_submission import CourierAttemptView, CourierBookingSnapshot
from app.services import pathao_provider


def validate_booking_result(
    result: Any,
    attempt: CourierAttemptView,
    snapshot: CourierBookingSnapshot,
) -> tuple[bool, str | None]:
    """Validates provider response before recording success."""
    if not isinstance(result, pathao_provider.CourierBookingResult):
        return False, "Courier returned unexpected response structure."
    if not result.consignment_id or not result.consignment_id.strip():
        return False, "Courier returned empty consignment reference."
    if result.merchant_order_id != attempt.order_id:
        return False, "Courier returned mismatched merchant order reference."
    expected_simulation = attempt.environment == "offline"
    if result.is_simulated != expected_simulation:
        return False, "Courier returned inconsistent simulation flag."
    return True, None


def sanitize_definitive_error() -> str:
    """Return controlled seller text without inspecting untrusted provider details."""
    return "Courier rejected booking. Review delivery details before trying again."


def sanitize_unexpected_error(err: Exception) -> tuple[str, str]:
    """Sanitizes unexpected exceptions into safe classification codes and messages."""
    if isinstance(err, (asyncio.TimeoutError, TimeoutError, httpx.TimeoutException)):
        return (
            "COURIER_TIMEOUT",
            "Courier provider timed out before confirmation was received.",
        )
    return (
        "COURIER_OUTCOME_UNKNOWN",
        "Courier submission encountered an unexpected provider error.",
    )
