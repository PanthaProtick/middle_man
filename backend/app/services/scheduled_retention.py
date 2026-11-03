"""Run existing retention policies with independent durable phase transactions."""
import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.entities import ShopTable
from app.models.scheduled_retention import ScheduledRetentionResult
from app.services.raw_evidence_cleanup import purge_raw_evidence
from app.services.structured_retention import purge_completed_orders

logger = logging.getLogger(__name__)


async def run_scheduled_retention(
    sessions: async_sessionmaker[AsyncSession] | None, now: datetime,
) -> ScheduledRetentionResult:
    result = ScheduledRetentionResult(checked_at=now)
    if sessions is None:
        result.status = 'failed'
        result.phases_failed = 1
        return result
    try:
        async with sessions() as db:
            shops = list(await db.scalars(select(ShopTable.id).order_by(ShopTable.id)))
        for shop_id in shops:
            for phase in ('raw', 'structured'):
                try:
                    async with sessions() as db:
                        if phase == 'raw':
                            raw = await purge_raw_evidence(db, now, shop_id)
                            result.raw_purged += raw.items_purged
                            failed = raw.status != 'clean' or raw.overdue_remaining > 0
                        else:
                            structured = await purge_completed_orders(db, now, shop_id)
                            result.orders_removed += structured.removed
                            failed = structured.failed > 0 or structured.overdue > 0
                        result.phases_failed += int(failed)
                except Exception:
                    # Never log driver messages, credentials, or personal record values.
                    logger.error('Scheduled retention phase failed: %s', phase)
                    result.phases_failed += 1
            result.shops_checked += 1
        if result.phases_failed:
            result.status = 'partial_failure'
    except Exception:
        logger.error('Scheduled retention shop discovery failed')
        result.status = 'failed'
        result.phases_failed += 1
    return result
