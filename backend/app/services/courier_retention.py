"""Erase courier payloads while keeping nonpersonal duplicate-booking guards."""
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.courier_reconciliation import CourierReconciliationTable
from app.models.courier_submission import CourierAttemptTable


async def erase_courier_details(db: AsyncSession | None, shop_id: str, order_id: str) -> set[str]:
    """Called inside the existing shop/order retention transaction.

    IDs, outcome, environment and consignment association remain authoritative:
    erasure never means cancellation or permission to submit again.
    Return attempt IDs so even pending reconciliation receipts are redacted.
    """
    if db is not None:
        scope = (CourierAttemptTable.shop_id == shop_id, CourierAttemptTable.order_id == order_id)
        identities = set((await db.scalars(select(CourierAttemptTable.id).where(*scope))).all())
        await db.execute(update(CourierAttemptTable).where(*scope).values(
            booking_snapshot=None, reviewed_token='', error_code=None, error_message=None,
        ))
        await db.execute(delete(CourierReconciliationTable).where(
            CourierReconciliationTable.shop_id == shop_id,
            CourierReconciliationTable.order_id == order_id,
        ))
        return identities

    from app.services.courier_attempts import _memory_attempts
    from app.services.courier_reconciliation_resolution import _memory_reconciliations
    identities = set()
    for attempt in _memory_attempts.get(order_id, []):
        if attempt['shop_id'] != shop_id:
            continue
        identities.add(attempt['id'])
        attempt.update(booking_snapshot=None, reviewed_token='', error_code=None, error_message=None)
        _memory_reconciliations.pop(attempt['id'], None)
    return identities
