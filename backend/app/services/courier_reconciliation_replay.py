"""Durable resolution receipts, followed by a recoverable review snapshot."""
from dataclasses import dataclass
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.idempotency import (
    check_idempotency_record,
    finalize_idempotency_record,
    save_idempotency_record,
)
from app.models.courier_review import CourierReview
from app.services import courier_review

OPERATION = 'courier_reconciliation'


@dataclass(frozen=True)
class ReconciliationReplay:
    key: str
    scope: str
    payload_hash: str
    attempt_id: str

    @property
    def pending(self) -> dict[str, str]:
        return {'committed_resolution': self.attempt_id}

    async def read(self, db: AsyncSession | None) -> CourierReview | Literal[True] | None:
        cached = await check_idempotency_record(db, self.key, self.scope, OPERATION, self.payload_hash)
        if cached is None:
            return None
        if cached[1] == self.pending:
            return True
        return CourierReview.model_validate(cached[1])

    async def save(self, db: AsyncSession | None) -> None:
        await save_idempotency_record(
            db, self.key, self.scope, OPERATION, self.payload_hash, 200, self.pending, commit=False,
        )

    async def respond(self, db: AsyncSession | None, shop: str, order_id: str) -> CourierReview:
        # All resolution locks have been released before metadata/provider I/O.
        review = await courier_review.read(db, shop, order_id)
        result = await finalize_idempotency_record(
            db, self.key, self.scope, OPERATION, self.payload_hash,
            self.pending, review.model_dump(mode='json'),
        )
        return CourierReview.model_validate(result)
