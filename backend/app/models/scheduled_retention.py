"""Aggregate scheduler results without exposing shop or evidence identifiers."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class SchedulerError(BaseModel):
    code: Literal['SCHEDULER_DISABLED', 'SCHEDULER_UNAUTHORIZED']


class ScheduledRetentionResult(BaseModel):
    checked_at: datetime
    status: Literal['clean', 'partial_failure', 'failed'] = 'clean'
    shops_checked: int = 0
    raw_purged: int = 0
    orders_removed: int = 0
    phases_failed: int = 0
