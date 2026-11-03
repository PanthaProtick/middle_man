"""Dedicated scheduler capability; never resolves or impersonates a seller."""
import logging
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

from app.core import database
from app.core.config import settings
from app.models.scheduled_retention import ScheduledRetentionResult, SchedulerError
from app.services.scheduled_retention import run_scheduled_retention

router = APIRouter(prefix='/maintenance', tags=['maintenance'])
logger = logging.getLogger(__name__)


@router.get('/retention', response_model=ScheduledRetentionResult, responses={
    401: {'model': SchedulerError},
    503: {'model': ScheduledRetentionResult | SchedulerError},
})
async def scheduled_retention(request: Request, response: Response) -> ScheduledRetentionResult | JSONResponse:
    headers = {'Cache-Control': 'no-store'}
    if not settings.CRON_SECRET.strip():
        return JSONResponse({'code': 'SCHEDULER_DISABLED'}, status_code=503, headers=headers)
    expected = ('Bearer ' + settings.CRON_SECRET).encode()
    if not secrets.compare_digest(request.headers.get('authorization', '').encode(), expected):
        return JSONResponse({'code': 'SCHEDULER_UNAUTHORIZED'}, status_code=401, headers=headers)
    result = await run_scheduled_retention(database.AsyncSessionLocal, datetime.now(timezone.utc))
    logger.warning('Scheduled retention result: %s', result.model_dump_json())
    response.status_code = 200 if result.status == 'clean' else 503
    response.headers.update(headers)
    return result
