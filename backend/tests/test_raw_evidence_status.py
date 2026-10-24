import datetime
import uuid

import pytest
from httpx import AsyncClient

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.public_gate import allow_synthetic_buyer_demo, verify_public_access_gate
from app.main import app
from app.services.address_assistance import _memory as _memory_address
from app.services.address_assistance import reset_address_memory
from app.services.buyer_service import reset_buyer_memory_store
from app.services.evidence_service import _memory_order_evidence, reset_memory_evidence
from app.services.evidence_store import inject_storage_outage, reset_evidence_file_store
from app.services.order_service import reset_order_memory_store
from app.services.payment_extraction import _memory as _memory_payment
from app.services.payment_extraction import reset_payment_memory
from app.services.raw_evidence_cleanup import (
    get_retention_status,
    purge_raw_evidence,
    reset_cleanup_memory,
)
from app.services.seller_service import SellerService, reset_memory_store
from app.services.sms_import import _memory_evidence as _memory_sms


@pytest.fixture(autouse=True)
def clean_stores():
    reset_memory_store()
    reset_order_memory_store()
    reset_buyer_memory_store()
    reset_memory_evidence()
    reset_evidence_file_store()
    reset_payment_memory()
    reset_cleanup_memory()
    _memory_sms.clear()
    reset_address_memory()
    inject_storage_outage(False)
    app.dependency_overrides[verify_public_access_gate] = allow_synthetic_buyer_demo
    yield
    app.dependency_overrides.pop(verify_public_access_gate, None)
    app.dependency_overrides.pop(get_seller_identity, None)
    reset_memory_store()
    reset_order_memory_store()
    reset_buyer_memory_store()
    reset_memory_evidence()
    reset_evidence_file_store()
    reset_payment_memory()
    reset_cleanup_memory()
    _memory_sms.clear()
    reset_address_memory()
    inject_storage_outage(False)


@pytest.mark.asyncio
async def test_retention_status_and_overdue_visibility(client: AsyncClient):
    seller = SellerIdentity(owner_id="seller_overdue_test")
    app.dependency_overrides[get_seller_identity] = lambda: seller

    await client.post("/api/seller/shop", json={"display_name": "Overdue Shop"}, headers={"Idempotency-Key": "k-shop-3"})
    shop = await SellerService().get_shop_by_owner("seller_overdue_test")
    assert shop is not None

    past = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)
    ev_id = str(uuid.uuid4())
    _memory_order_evidence[ev_id] = {
        "id": ev_id,
        "shop_id": shop.id,
        "order_id": str(uuid.uuid4()),
        "storage_key": f"{shop.id}/order/{ev_id}.png",
        "media_type": "image/png",
        "byte_size": 100,
        "width": 10,
        "height": 10,
        "sha256_digest": "dummy",
        "status": "attached",
        "collected_at": past - datetime.timedelta(days=30),
        "delete_after": past,
        "deleted_at": None,
    }

    now = datetime.datetime.now(datetime.timezone.utc)
    status = await get_retention_status(db=None, now=now, shop_id=shop.id)
    assert status.overdue_count == 1
    assert len(status.overdue_items) == 1
    assert status.overdue_items[0].evidence_id == ev_id

    cleanup = await purge_raw_evidence(db=None, now=now, shop_id=shop.id)
    assert cleanup.items_purged == 1

    status_after = await get_retention_status(db=None, now=now, shop_id=shop.id)
    assert status_after.overdue_count == 0


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

    from app.models.payment_entities import PaymentExtractionTable
    pay_rec = PaymentExtractionTable(
        id=str(uuid.uuid4()),
        shop_id=shop_id,
        order_id=order_id,
        mutation_key="k-pay",
        payload_hash="h-pay",
        state="complete",
        result_json='{"available": true, "suggestions": {"trx_id": "ABC"}}',
        evidence_id="ev-123",
        raw_response='{"trx_id": "ABC"}',
        collected_at=past,
        delete_after=past + datetime.timedelta(days=30),
    )
    _memory_payment[(order_id, "k-pay")] = pay_rec

    status = await get_retention_status(db=None, now=now, shop_id=shop_id)
    assert status.overdue_count == 2
    assert status.counts["ai_extractions_active"] == 2

    cleanup = await purge_raw_evidence(db=None, now=now, shop_id=shop_id)
    assert cleanup.items_purged == 2

    assert addr_rec.raw_request is None
    assert addr_rec.raw_response is None
    assert "Dhaka" in addr_rec.result_json

    assert pay_rec.raw_response is None
    assert "ABC" in pay_rec.result_json

    status_after = await get_retention_status(db=None, now=now, shop_id=shop_id)
    assert status_after.overdue_count == 0
    assert status_after.counts["ai_extractions_purged"] == 2


@pytest.mark.asyncio
async def test_cross_shop_cleanup_isolation():
    shop_a = "shop-a-iso"
    shop_b = "shop-b-iso"
    now = datetime.datetime.now(datetime.timezone.utc)
    past = now - datetime.timedelta(days=31)

    ev_a = str(uuid.uuid4())
    _memory_order_evidence[ev_a] = {
        "id": ev_a,
        "shop_id": shop_a,
        "order_id": "ord-a",
        "storage_key": f"{shop_a}/orders/{ev_a}.png",
        "media_type": "image/png",
        "byte_size": 256,
        "width": 10,
        "height": 10,
        "sha256_digest": "dig-a",
        "status": "attached",
        "collected_at": past,
        "delete_after": past + datetime.timedelta(days=30),
        "deleted_at": None,
    }

    ev_b = str(uuid.uuid4())
    _memory_order_evidence[ev_b] = {
        "id": ev_b,
        "shop_id": shop_b,
        "order_id": "ord-b",
        "storage_key": f"{shop_b}/orders/{ev_b}.png",
        "media_type": "image/png",
        "byte_size": 256,
        "width": 10,
        "height": 10,
        "sha256_digest": "dig-b",
        "status": "attached",
        "collected_at": past,
        "delete_after": past + datetime.timedelta(days=30),
        "deleted_at": None,
    }

    res_a = await purge_raw_evidence(db=None, now=now, shop_id=shop_a)
    assert res_a.items_purged == 1
    assert _memory_order_evidence[ev_a]["status"] == "deleted"
    assert _memory_order_evidence[ev_b]["status"] == "attached"

    stat_a = await get_retention_status(db=None, now=now, shop_id=shop_a)
    assert stat_a.overdue_count == 0
    assert stat_a.counts["screenshots_deleted"] == 1
    assert stat_a.counts["screenshots_active"] == 0

    stat_b = await get_retention_status(db=None, now=now, shop_id=shop_b)
    assert stat_b.overdue_count == 1
    assert stat_b.counts["screenshots_active"] == 1
