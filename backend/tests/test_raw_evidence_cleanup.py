import datetime

import pytest

from app.models.sms_entities import SmsEvidenceTable
from app.services.legacy_sms_store import _memory_evidence
from app.services.raw_evidence_cleanup import purge_raw_evidence, reset_cleanup_memory


@pytest.mark.asyncio
async def test_historical_sms_cleanup_keeps_original_deadline_and_is_repeatable():
    _memory_evidence.clear()
    reset_cleanup_memory()
    collected = datetime.datetime(2026, 1, 1, 12, tzinfo=datetime.timezone.utc)
    deadline = collected + datetime.timedelta(days=30)
    record = SmsEvidenceTable(id='legacy-evidence', shop_id='legacy-shop', owner_id='legacy-owner',
        text_digest='a' * 64, raw_text='Private historical message',
        collected_at=collected, delete_after=deadline)
    _memory_evidence[('legacy-shop', 'a' * 64)] = record
    try:
        before = await purge_raw_evidence(None, deadline - datetime.timedelta(seconds=1), 'legacy-shop')
        assert before.items_purged == 0
        assert record.raw_text == 'Private historical message'
        at = await purge_raw_evidence(None, deadline, 'legacy-shop')
        assert at.items_purged == 1
        assert record.raw_text is None
        again = await purge_raw_evidence(None, deadline + datetime.timedelta(days=1), 'legacy-shop')
        assert again.items_purged == 0
        assert record.collected_at == collected
        assert record.delete_after == deadline
        assert record.text_digest == 'a' * 64
    finally:
        _memory_evidence.clear()
        reset_cleanup_memory()
