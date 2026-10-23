import datetime
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import LinkMeasurementTable

_memory_link_measurements: list[dict[str, Any]] = []


async def record_measurement(db: AsyncSession | None, digest: str, event: str, now: datetime.datetime, is_bot: bool = False) -> None:
    """Counts requests, never unique buyers. Polls after submission are not link opens.

    A previous open of this token marks repeat-or-bot; user-agent bot detection is
    advisory. Shared links, undetected bots and retries cannot establish identity.
    Submission events exist only in the same transaction as accepted submissions.
    """
    if db is None:
        repeated = any(row["token_lookup_digest"] == digest and row["event_type"] == event for row in _memory_link_measurements)
    else:
        previous = await db.scalar(select(LinkMeasurementTable.id).where(
            LinkMeasurementTable.token_lookup_digest == digest, LinkMeasurementTable.event_type == event,
        ).limit(1))
        repeated = previous is not None
    data = dict(id=str(uuid.uuid4()), token_lookup_digest=digest, event_type=event, is_bot_or_repeat=is_bot or repeated, created_at=now)
    if db is None:
        _memory_link_measurements.append(data)
    else:
        db.add(LinkMeasurementTable(**data))
        await db.flush()
