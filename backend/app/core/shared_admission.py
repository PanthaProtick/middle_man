"""Deployment-wide PostgreSQL quota; no buyer identifiers are persisted."""

import asyncio
import math

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core import database
from app.core.config import settings


class AdmissionUnavailable(Exception):
    """The shared control could not confirm admission."""


async def reserve_public_request() -> int | None:
    """Commit one slot, or return conservative retry seconds when exhausted.

    The singleton key deliberately ignores tokens, IPs, processes and deployments:
    all instances using this database/schema consume the same quota. A timeout or
    ambiguous commit fails closed; it can waste a slot but cannot grant an extra.
    """
    factory = database.AsyncSessionLocal
    if factory is None:
        raise AdmissionUnavailable
    try:
        async with asyncio.timeout(3), factory() as session:
            result = await session.execute(text("""
                INSERT INTO public_admission AS quota (id, expires_at, requests)
                VALUES (1, statement_timestamp() + make_interval(secs => :seconds), 1)
                ON CONFLICT (id) DO UPDATE SET
                    requests = CASE WHEN quota.expires_at <= statement_timestamp()
                        THEN 1 ELSE quota.requests + 1 END,
                    expires_at = CASE WHEN quota.expires_at <= statement_timestamp()
                        THEN EXCLUDED.expires_at ELSE quota.expires_at END
                WHERE quota.expires_at <= statement_timestamp() OR quota.requests < :maximum
                RETURNING requests
            """), {"seconds": settings.PUBLIC_REQUEST_WINDOW_SECONDS,
                   "maximum": settings.PUBLIC_REQUESTS_PER_WINDOW})
            accepted = result.scalar_one_or_none() is not None
            await session.commit()
        return None if accepted else math.ceil(settings.PUBLIC_REQUEST_WINDOW_SECONDS)
    except (SQLAlchemyError, TimeoutError, OSError) as error:
        # Never expose driver errors, credentials, request paths or tokens.
        raise AdmissionUnavailable from error
