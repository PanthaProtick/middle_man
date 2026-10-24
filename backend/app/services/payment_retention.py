"""Retention worker seam: remove raw AI text without changing structured outcomes."""

import datetime

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment_entities import PaymentExtractionTable


async def purge_payment_raw_evidence(db: AsyncSession, now: datetime.datetime) -> None:
    await db.execute(
        update(PaymentExtractionTable)
        .where(
            PaymentExtractionTable.delete_after <= now,
            PaymentExtractionTable.raw_response.is_not(None),
        )
        .values(raw_response=None)
    )
    # Caller owns the retention transaction and scheduling (ticket 16).
