"""Fixtures representing records created before SMS ingestion was retired."""
import datetime
import uuid

from app.models.legacy_sms import ImportResult, SmsItemResult
from app.models.sms_entities import SmsEvidenceTable, SmsImportTable
from app.models.transaction import ManualReceipt


def historical_sms_rows(shop_id: str, owner_id: str, account_id: str, receipt_id: str):
    collected = datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc)
    evidence = SmsEvidenceTable(id=str(uuid.uuid4()), shop_id=shop_id, owner_id=owner_id,
        text_digest='a' * 64, raw_text='Historical OLDTEST001 payment message',
        collected_at=collected, delete_after=collected + datetime.timedelta(days=30))
    result = ImportResult(id=str(uuid.uuid4()), payment_account_id=account_id, created_at=collected,
        items=[SmsItemResult(index=0, state='imported', receipt_id=receipt_id,
            evidence_id=evidence.id, collected_at=collected, delete_after=evidence.delete_after,
            fields=ManualReceipt(payment_account_id=account_id, provider='bkash', trx_id='OLDTEST001',
                amount_minor=200000, sender_number='01822222222', occurred_at=collected))])
    imported = SmsImportTable(id=result.id, shop_id=shop_id, mutation_key='historical',
        payload_hash='b' * 64, result_json=result.model_dump_json(), created_at=collected)
    return evidence, imported
