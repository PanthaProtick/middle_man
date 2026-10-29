import datetime

import pytest
from httpx import AsyncClient

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.public_gate import allow_synthetic_buyer_demo, verify_public_access_gate
from app.main import app
from app.models.sms import SmsImportInput
from app.services.buyer_service import reset_buyer_memory_store
from app.services.order_service import reset_order_memory_store
from app.services.raw_evidence_cleanup import (
    purge_raw_evidence,
    reset_cleanup_memory,
)
from app.services.seller_service import SellerService, reset_memory_store
from app.services.sms_import import SmsImportService
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
