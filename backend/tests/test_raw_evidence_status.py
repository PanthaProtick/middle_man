"""Raw evidence retention is SMS-only after address AI retirement."""
import datetime

import pytest

from app.core.auth import get_seller_identity
from app.core.public_gate import allow_synthetic_buyer_demo, verify_public_access_gate
from app.main import app
from app.models.sms_entities import SmsEvidenceTable
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
    app.dependency_overrides[verify_public_access_gate] = allow_synthetic_buyer_demo
    yield
    app.dependency_overrides.pop(verify_public_access_gate, None)
    app.dependency_overrides.pop(get_seller_identity, None)
    reset_memory_store()
    reset_order_memory_store()
    reset_buyer_memory_store()
    reset_cleanup_memory()
    _memory_sms.clear()


@pytest.mark.asyncio
async def test_retention_counts_only_remaining_raw_evidence():
    shop_id = "test-shop-sms"
    now = datetime.datetime.now(datetime.timezone.utc)
    past = now - datetime.timedelta(days=31)
    _memory_sms["due"] = SmsEvidenceTable(
        id="due", shop_id=shop_id, raw_text="Private SMS",
        collected_at=past, delete_after=past + datetime.timedelta(days=30),
    )

    status = await get_retention_status(db=None, now=now, shop_id=shop_id)
    assert status.overdue_count == 1
    assert status.counts == {"sms_active": 1, "sms_purged": 0}
    assert {item.evidence_type for item in status.overdue_items} == {"sms"}

    cleanup = await purge_raw_evidence(db=None, now=now, shop_id=shop_id)
    assert cleanup.items_purged == 1

    status_after = await get_retention_status(db=None, now=now, shop_id=shop_id)
    assert status_after.overdue_count == 0
    assert status_after.counts == {"sms_active": 0, "sms_purged": 1}


@pytest.mark.asyncio
async def test_retention_deadline_and_shop_isolation():
    deadline = datetime.datetime(2026, 10, 27, tzinfo=datetime.timezone.utc)
    for shop in ("shop-a", "shop-b"):
        _memory_sms[shop] = SmsEvidenceTable(
            id=shop, shop_id=shop, raw_text="Private SMS",
            delete_after=deadline, collected_at=deadline - datetime.timedelta(days=30),
        )
    early = await purge_raw_evidence(None, deadline - datetime.timedelta(microseconds=1), "shop-a")
    assert early.items_purged == 0
    due = await get_retention_status(None, deadline, "shop-a")
    assert due.overdue_count == 1
    assert {item.evidence_type for item in due.overdue_items} == {"sms"}
    assert set(due.counts) == {"sms_active", "sms_purged"}
    cleaned = await purge_raw_evidence(None, deadline, "shop-a")
    assert cleaned.items_purged == 1
    assert cleaned.overdue_remaining == 0
    assert _memory_sms["shop-a"].raw_text is None
    assert _memory_sms["shop-b"].raw_text == "Private SMS"
    assert (await get_retention_status(None, deadline, "shop-b")).overdue_count == 1
    assert (await purge_raw_evidence(None, deadline, "shop-a")).items_purged == 0
