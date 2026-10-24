"""Remove personal data from replay caches without re-enabling old mutations."""
import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import IdempotencyRecordTable
from app.models.sms import ImportResult
from app.models.sms_entities import SmsImportTable


def references_identity(value: object, identities: set[str]) -> bool:
    # Results predate explicit aggregate foreign keys. Match exact JSON values, never substrings.
    if isinstance(value, str):
        if value in identities:
            return True
        # Older receipt writers stored JSON inside the JSON replay envelope.
        if value.startswith(('{', '[')):
            try:
                return references_identity(json.loads(value), identities)
            except ValueError:
                return False
        return False
    if isinstance(value, list):
        return any(references_identity(v, identities) for v in value)
    if isinstance(value, dict):
        return any(references_identity(v, identities) for v in value.values())
    return False


async def redact_replays(db: AsyncSession, identities: set[str], shop_id: str) -> None:

    for record in (await db.scalars(select(IdempotencyRecordTable))).all():
        if references_identity(json.loads(record.response_json), identities):
            record.response_json = '{"record_unavailable": true}'
            record.payload_hash = ''
    for record_sms in (await db.scalars(select(SmsImportTable).where(SmsImportTable.shop_id == shop_id))).all():
        result = ImportResult.model_validate_json(record_sms.result_json)
        redact_import_result(result, identities)
        record_sms.result_json = result.model_dump_json()


def redact_import_result(result: ImportResult, identities: set[str]) -> None:
    for item in result.items:
        if item.receipt_id in identities:
            item.fields = None
            item.issues = ['record_unavailable']
            item.order_ids = []
        else:
            item.order_ids = [oid for oid in item.order_ids if oid not in identities]
