import datetime
import uuid

import pytest
from httpx import AsyncClient

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.public_gate import allow_synthetic_buyer_demo, verify_public_access_gate
from app.main import app
from app.models.sms import SmsImportInput
from app.services.address_assistance import reset_address_memory
from app.services.buyer_service import reset_buyer_memory_store
from app.services.evidence_service import _memory_order_evidence, reset_memory_evidence
from app.services.evidence_store import (
    init_evidence_storage,
    inject_storage_outage,
    read_evidence_file,
    reset_evidence_file_store,
    save_evidence_file,
)
from app.services.order_service import reset_order_memory_store
from app.services.payment_extraction import reset_payment_memory
from app.services.raw_evidence_cleanup import (
    get_retention_status,
    purge_raw_evidence,
    reset_cleanup_memory,
)
from app.services.seller_service import SellerService, reset_memory_store
from app.services.sms_import import SmsImportService
from app.services.sms_import import _memory_evidence as _memory_sms
from tests.test_image_service import _create_minimal_png


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
async def test_sms_raw_cleanup_after_30_days(client: AsyncClient):
    seller = SellerIdentity(owner_id="seller_sms_cleanup")
    app.dependency_overrides[get_seller_identity] = lambda: seller

    await client.post("/api/seller/shop", json={"display_name": "SMS Cleanup Shop"}, headers={"Idempotency-Key": "k-shop"})
    acc = (await client.post("/api/seller/payment-accounts", json={"provider": "bkash", "receiving_number": "01712345678", "label": "bKash Primary"}, headers={"Idempotency-Key": "k-acc"})).json()

    t0 = datetime.datetime(2026, 1, 1, 12, 0, 0, tzinfo=datetime.timezone.utc)
    sms_text = "You have received Tk 1,500.00 from 01799999999. Ref: Test. TrxID: SMSCLEANUP1 at 01/01/2026 12:00"

    service = SmsImportService(None)
    shop = await SellerService().get_shop_by_owner("seller_sms_cleanup")
    assert shop is not None

    res = await service.ingest(
        shop_id=shop.id,
        owner_id=seller.owner_id,
        payload=SmsImportInput(payment_account_id=acc["id"], messages=[sms_text]),
        key="sms-import-k1",
    )
    assert len(res.items) == 1
    ev_id = res.items[0].evidence_id

    sms_records = list(_memory_sms.values())
    assert len(sms_records) == 1
    record = sms_records[0]
    assert record.raw_text == sms_text
    deadline = record.delete_after

    before_deadline = t0 + datetime.timedelta(days=29)
    result_before = await purge_raw_evidence(db=None, now=before_deadline, shop_id=shop.id)
    assert result_before.items_purged == 0
    assert record.raw_text == sms_text

    at_deadline = deadline + datetime.timedelta(seconds=1)
    result_at = await purge_raw_evidence(db=None, now=at_deadline, shop_id=shop.id)
    assert result_at.items_purged == 1
    assert record.raw_text is None
    assert record.text_digest is not None

    reimport_res = await service.ingest(
        shop_id=shop.id,
        owner_id=seller.owner_id,
        payload=SmsImportInput(payment_account_id=acc["id"], messages=[sms_text]),
        key="sms-import-k2",
    )
    assert len(reimport_res.items) == 1
    assert reimport_res.items[0].evidence_id == ev_id
    assert reimport_res.items[0].collected_at == record.collected_at
    assert reimport_res.items[0].delete_after == deadline
    assert record.raw_text is None
    assert len(list(_memory_sms.values())) == 1


@pytest.mark.asyncio
async def test_image_raw_cleanup_after_30_days_leaves_order_intact(client: AsyncClient, tmp_path):
    init_evidence_storage(tmp_path)
    seller = SellerIdentity(owner_id="seller_img_cleanup")
    app.dependency_overrides[get_seller_identity] = lambda: seller

    await client.post("/api/seller/shop", json={"display_name": "Image Cleanup Shop"}, headers={"Idempotency-Key": "k-shop-2"})
    acc = (await client.post("/api/seller/payment-accounts", json={"provider": "bkash", "receiving_number": "01712345678", "label": "bKash Primary"}, headers={"Idempotency-Key": "k-acc-2"})).json()
    order = (await client.post("/api/seller/orders", json={"product_name": "Handmade leather bag", "total_minor": 200000, "required_advance_minor": 50000, "payment_account_id": acc["id"]}, headers={"Idempotency-Key": "k-ord-2"})).json()
    token = order["portal_token"]

    png = _create_minimal_png(width=50, height=50)
    upload_res = await client.post(
        f"/api/public/orders/{token}/evidence",
        content=png,
        headers={"Content-Type": "image/png", "Idempotency-Key": "upload-img-1"},
    )
    assert upload_res.status_code == 201
    ev_id = upload_res.json()["evidence_id"]

    sub_res = await client.post(
        f"/api/public/orders/{token}/submission",
        json={
            "buyer_name": "Karim Mia",
            "contact_number": "01811111111",
            "address": {"raw_text": "House 12, Road 4, Banani"},
            "payment_claim": {
                "provider": "bkash",
                "trx_id": "TRXIMG12345",
                "sender_number": "01822222222",
                "amount_minor": 50000,
                "evidence_id": ev_id,
            },
        },
        headers={"Idempotency-Key": "sub-img-1"},
    )
    assert sub_res.status_code == 200

    storage_key = _memory_order_evidence[ev_id]["storage_key"]
    disk_file = tmp_path / storage_key
    assert disk_file.is_file()
    assert read_evidence_file(storage_key) is not None

    read_res = await client.get(f"/api/seller/evidence/{ev_id}")
    assert read_res.status_code == 200

    deadline = _memory_order_evidence[ev_id]["delete_after"]
    shop = await SellerService().get_shop_by_owner("seller_img_cleanup")
    assert shop is not None

    # Seller order correction does not reset evidence deadline
    patch_res = await client.patch(
        f"/api/seller/orders/{order['id']}/buyer-details",
        json={
            "expected_version": 2,
            "reason": "Correct address",
            "address": {"raw_text": "House 12, Road 4, Banani, Dhaka"},
        },
        headers={"Idempotency-Key": "sub-corr-1"},
    )
    assert patch_res.status_code == 200
    assert _memory_order_evidence[ev_id]["delete_after"] == deadline

    # Boundary timing: 1 hour before 30-day deadline, file remains
    before_deadline = deadline - datetime.timedelta(hours=1)
    cleanup_before = await purge_raw_evidence(db=None, now=before_deadline, shop_id=shop.id)
    assert cleanup_before.items_purged == 0
    assert disk_file.is_file()

    # Expired past 30 days: file is purged from disk
    now_expired = deadline + datetime.timedelta(minutes=5)
    cleanup_res = await purge_raw_evidence(db=None, now=now_expired, shop_id=shop.id)
    assert cleanup_res.items_purged == 1
    assert _memory_order_evidence[ev_id]["status"] == "deleted"
    assert _memory_order_evidence[ev_id]["deleted_at"] is not None
    assert not disk_file.is_file()
    assert read_evidence_file(storage_key) is None

    read_del = await client.get(f"/api/seller/evidence/{ev_id}")
    assert read_del.status_code == 410
    assert read_del.json()["error"]["code"] == "EVIDENCE_UNAVAILABLE"

    ord_check = await client.get(f"/api/seller/orders/{order['id']}")
    assert ord_check.status_code == 200
    ord_data = ord_check.json()
    assert ord_data["lifecycle"] == "pending"
    assert ord_data["buyer_revision"] == 2


@pytest.mark.asyncio
async def test_storage_outage_handling_and_safe_repeat_recovery(tmp_path):
    init_evidence_storage(tmp_path)
    shop_id = "test-shop-outage"
    now = datetime.datetime.now(datetime.timezone.utc)
    past = now - datetime.timedelta(days=31)

    ev_id = str(uuid.uuid4())
    storage_key = f"{shop_id}/orders/{ev_id}.png"
    save_evidence_file(storage_key, b"real-file-bytes-for-outage-test")
    disk_file = tmp_path / storage_key
    assert disk_file.is_file()

    _memory_order_evidence[ev_id] = {
        "id": ev_id,
        "shop_id": shop_id,
        "order_id": "ord-1",
        "storage_key": storage_key,
        "media_type": "image/png",
        "byte_size": 256,
        "width": 10,
        "height": 10,
        "sha256_digest": "digest",
        "status": "attached",
        "collected_at": past,
        "delete_after": past + datetime.timedelta(days=30),
        "deleted_at": None,
    }

    inject_storage_outage(True)
    try:
        cleanup = await purge_raw_evidence(db=None, now=now, shop_id=shop_id)
        assert cleanup.items_purged == 0
        assert cleanup.items_failed == 1
        assert cleanup.status == "partial_failure"
        assert len(cleanup.failures) == 1
        assert cleanup.failures[0].evidence_id == ev_id

        # Physical file is NOT unlinked and status is NOT marked deleted
        assert disk_file.is_file()
        assert _memory_order_evidence[ev_id]["status"] == "attached"
        assert _memory_order_evidence[ev_id]["deleted_at"] is None

        status = await get_retention_status(db=None, now=now, shop_id=shop_id)
        assert status.overdue_count == 1
        assert status.failed_count == 1
    finally:
        inject_storage_outage(False)

    # Safe retry removes the actual disk file and marks record deleted
    retry = await purge_raw_evidence(db=None, now=now, shop_id=shop_id)
    assert retry.items_purged == 1
    assert retry.items_failed == 0
    assert retry.status == "clean"
    assert not disk_file.is_file()
    assert _memory_order_evidence[ev_id]["status"] == "deleted"
    assert _memory_order_evidence[ev_id]["deleted_at"] is not None

    status_final = await get_retention_status(db=None, now=now, shop_id=shop_id)
    assert status_final.overdue_count == 0
    assert status_final.failed_count == 0
