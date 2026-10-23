import datetime
import hashlib
import json
from typing import Any, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import IdempotencyRecordTable

# Standby in-memory store for idempotency records when database is unconfigured
_memory_idempotency_store: dict[str, dict[str, Any]] = {}


def reset_shared_idempotency_store() -> None:
    _memory_idempotency_store.clear()


def _record_key(scope: str, operation: str, key: str) -> str:
    composite = f"{scope}:{operation}:{key}"
    return composite if len(composite) <= 128 else "sha256:" + hashlib.sha256(composite.encode()).hexdigest()


async def check_idempotency_record(
    db: Optional[AsyncSession],
    key: Optional[str],
    scope: str,
    operation: str,
    payload_hash: str,
) -> Optional[Tuple[int, Any]]:
    if not key:
        return None
    composite_key = _record_key(scope, operation, key)
    if db is not None:
        stmt = select(IdempotencyRecordTable).where(IdempotencyRecordTable.key == composite_key)
        result = await db.execute(stmt)
        record = result.scalar_one_or_none()
        if record:
            if record.payload_hash != payload_hash:
                from app.services.seller_service import IdempotencyConflictError
                raise IdempotencyConflictError()
            return int(record.status_code), json.loads(str(record.response_json))
    else:
        rec = _memory_idempotency_store.get(composite_key)
        if rec:
            if rec["payload_hash"] != payload_hash:
                from app.services.seller_service import IdempotencyConflictError
                raise IdempotencyConflictError()
            return int(rec["status_code"]), rec["data"]
    return None


async def save_idempotency_record(
    db: Optional[AsyncSession],
    key: Optional[str],
    scope: str,
    operation: str,
    payload_hash: str,
    status_code: int,
    data: Any,
    *,
    commit: bool = True,
) -> None:
    if not key:
        return
    composite_key = _record_key(scope, operation, key)
    if db is not None:
        record = IdempotencyRecordTable(
            key=composite_key,
            scope=scope,
            operation=operation,
            payload_hash=payload_hash,
            status_code=status_code,
            response_json=json.dumps(data, default=str),
            created_at=datetime.datetime.now(datetime.timezone.utc),
        )
        db.add(record)
        if commit:
            await db.commit()
        else:
            await db.flush()
    else:
        _memory_idempotency_store[composite_key] = {
            "payload_hash": payload_hash,
            "status_code": status_code,
            "data": data,
        }
