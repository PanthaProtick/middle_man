import datetime
import uuid

import pytest

from app.core.auth import get_seller_identity
from app.core.public_gate import allow_synthetic_buyer_demo, verify_public_access_gate
from app.main import app
from app.services.address_assistance import _memory as _memory_address
from app.services.address_assistance import reset_address_memory
from app.services.buyer_service import reset_buyer_memory_store
from app.services.order_service import reset_order_memory_store
from app.services.raw_evidence_cleanup import (
    get_retention_status,
    purge_raw_evidence,
    reset_cleanup_memory,
)
from app.services.seller_service import reset_memory_store
from app.services.sms_import import _memory_evidence as _memory_sms


@pytest.fixture(autouse=True)
def clean_stores():
    reset_memory_store()
    reset_order_memory_store()
    reset_buyer_memory_store()
    reset_cleanup_memory()
    _memory_sms.clear()
    reset_address_memory()
    app.dependency_overrides[verify_public_access_gate] = allow_synthetic_buyer_demo
    yield
    app.dependency_overrides.pop(verify_public_access_gate, None)
    app.dependency_overrides.pop(get_seller_identity, None)
    reset_memory_store()
    reset_order_memory_store()
    reset_buyer_memory_store()
    reset_cleanup_memory()
    _memory_sms.clear()
    reset_address_memory()




@pytest.mark.asyncio
async def test_ai_extractions_raw_cleanup_leaves_structured_results():
    shop_id = "test-shop-ai"
    order_id = "test-order-ai"
    now = datetime.datetime.now(datetime.timezone.utc)
    past = now - datetime.timedelta(days=31)

    from app.models.address_entities import AddressExtractionTable
    addr_rec = AddressExtractionTable(
        id=str(uuid.uuid4()),
        shop_id=shop_id,
        order_id=order_id,
        mutation_key="k-addr",
        payload_hash="h-addr",
        result_json='{"available": true, "suggestions": {"district": "Dhaka"}}',
        raw_request="Secret address input text",
        raw_response='{"district": "Dhaka"}',
        collected_at=past,
        delete_after=past + datetime.timedelta(days=30),
    )
    _memory_address[(order_id, "k-addr")] = addr_rec

    status = await get_retention_status(db=None, now=now, shop_id=shop_id)
    assert status.overdue_count == 1
    assert status.counts["ai_extractions_active"] == 1

    cleanup = await purge_raw_evidence(db=None, now=now, shop_id=shop_id)
    assert cleanup.items_purged == 1

    assert addr_rec.raw_request is None
    assert addr_rec.raw_response is None
    assert "Dhaka" in addr_rec.result_json


    status_after = await get_retention_status(db=None, now=now, shop_id=shop_id)
    assert status_after.overdue_count == 0
    assert status_after.counts["ai_extractions_purged"] == 1


@pytest.mark.asyncio
async def test_retention_deadline_and_shop_isolation_for_remaining_raw_data():
    from app.models.address_entities import AddressExtractionTable
    from app.models.sms_entities import SmsEvidenceTable

    deadline = datetime.datetime(2026, 10, 27, tzinfo=datetime.timezone.utc)
    for shop in ('shop-a', 'shop-b'):
        _memory_sms[shop] = SmsEvidenceTable(id=shop, shop_id=shop, raw_text='Private SMS',
            delete_after=deadline, collected_at=deadline - datetime.timedelta(days=30))
        _memory_address[(shop, 'key')] = AddressExtractionTable(id=shop, shop_id=shop,
            order_id='order-' + shop, raw_request='Private address', raw_response='Raw AI',
            result_json='{"available":true}', delete_after=deadline)
    early = await purge_raw_evidence(None, deadline - datetime.timedelta(microseconds=1), 'shop-a')
    assert early.items_purged == 0
    due = await get_retention_status(None, deadline, 'shop-a')
    assert due.overdue_count == 2
    assert {item.evidence_type for item in due.overdue_items} == {'sms', 'address_ai'}
    assert not any('screenshot' in key for key in due.counts)
    cleaned = await purge_raw_evidence(None, deadline, 'shop-a')
    assert cleaned.items_purged == 2
    assert cleaned.overdue_remaining == 0
    assert _memory_sms['shop-a'].raw_text is None
    assert _memory_address[('shop-a', 'key')].raw_response is None
    assert _memory_address[('shop-a', 'key')].result_json == '{"available":true}'
    assert _memory_sms['shop-b'].raw_text == 'Private SMS'
    assert _memory_address[('shop-b', 'key')].raw_response == 'Raw AI'
    assert (await get_retention_status(None, deadline, 'shop-b')).overdue_count == 2
    assert (await purge_raw_evidence(None, deadline, 'shop-a')).items_purged == 0
