import datetime

import pytest
from httpx import AsyncClient

from app.api.public_orders import get_buyer_clock
from app.core.auth import SellerIdentity, get_seller_identity
from app.core.public_gate import allow_synthetic_buyer_demo, verify_public_access_gate
from app.main import app
from app.services.buyer_service import reset_buyer_memory_store
from app.services.evidence_store import inject_storage_outage
from app.services.order_service import reset_order_memory_store
from app.services.seller_service import reset_memory_store
from tests.test_image_service import _create_minimal_jpeg, _create_minimal_png


@pytest.fixture(autouse=True)
def clean_memory_stores():
    reset_memory_store()
    reset_order_memory_store()
    reset_buyer_memory_store()
    inject_storage_outage(False)
    app.dependency_overrides[verify_public_access_gate] = allow_synthetic_buyer_demo
    yield
    app.dependency_overrides.pop(verify_public_access_gate, None)
    app.dependency_overrides.pop(get_buyer_clock, None)
    app.dependency_overrides.pop(get_seller_identity, None)
    reset_memory_store()
    reset_order_memory_store()
    reset_buyer_memory_store()
    inject_storage_outage(False)


@pytest.fixture
def seller_identity():
    seller = SellerIdentity(owner_id="seller_evidence_test_1")
    app.dependency_overrides[get_seller_identity] = lambda: seller
    yield seller
    app.dependency_overrides.pop(get_seller_identity, None)


async def _create_test_order(client: AsyncClient) -> dict:
    await client.post(
        "/api/seller/shop",
        json={"display_name": "Evidence Test Shop"},
        headers={"Idempotency-Key": "setup-shop-ev"},
    )
    acc_res = await client.post(
        "/api/seller/payment-accounts",
        json={
            "provider": "bkash",
            "receiving_number": "01712345678",
            "label": "Merchant Primary",
        },
        headers={"Idempotency-Key": "setup-acc-ev"},
    )
    account_id = acc_res.json()["id"]

    order_res = await client.post(
        "/api/seller/orders",
        json={
            "product_name": "Premium mechanical watch",
            "total_minor": 500000,
            "required_advance_minor": 100000,
            "payment_account_id": account_id,
        },
        headers={"Idempotency-Key": "setup-order-ev"},
    )
    assert order_res.status_code == 201
    return order_res.json()


@pytest.mark.asyncio
async def test_buyer_evidence_upload_success_and_metadata_stripped(client: AsyncClient, seller_identity):
    order = await _create_test_order(client)
    token = order["portal_token"]

    png_data = _create_minimal_png(width=100, height=80, with_metadata=True)
    assert b"Sensitive EXIF" in png_data

    res = await client.post(
        f"/api/public/orders/{token}/evidence",
        content=png_data,
        headers={"Content-Type": "image/png", "Idempotency-Key": "upload-key-1"},
    )
    assert res.status_code == 201
    data = res.json()
    assert "evidence_id" in data
    assert data["media_type"] == "image/png"
    assert data["width"] == 100
    assert data["height"] == 80
    assert "url" not in data
    assert "file_path" not in data
    assert "storage_key" not in data

    # Verify upload did not count as submission or change order lifecycle
    order_res = await client.get(f"/api/public/orders/{token}")
    assert order_res.json()["lifecycle"] == "awaiting_buyer"

    # Before submission, staged evidence is not yet retrievable by seller
    unattached_get = await client.get(f"/api/seller/evidence/{data['evidence_id']}")
    assert unattached_get.status_code == 404

    # Submit order with evidence attached
    sub_res = await client.post(
        f"/api/public/orders/{token}/submission",
        json={
            "buyer_name": "Rahim Ahmed",
            "contact_number": "01799999999",
            "address": {"raw_text": "Road 1, Dhanmondi, Dhaka"},
            "payment_claim": {
                "provider": "bkash",
                "trx_id": "TRX12345678",
                "sender_number": "01788888888",
                "amount_minor": 100000,
                "evidence_id": data["evidence_id"],
            },
        },
        headers={"Idempotency-Key": "sub-with-ev-key"},
    )
    assert sub_res.status_code == 200

    # Once attached, owning seller retrieves it privately
    seller_get = await client.get(f"/api/seller/evidence/{data['evidence_id']}")
    assert seller_get.status_code == 200
    assert seller_get.headers["Content-Type"] == "image/png"
    assert "private" in seller_get.headers["Cache-Control"]
    assert "no-store" in seller_get.headers["Cache-Control"]
    assert b"Sensitive EXIF" not in seller_get.content


@pytest.mark.asyncio
async def test_evidence_upload_idempotency_and_conflict(client: AsyncClient, seller_identity):
    order = await _create_test_order(client)
    token = order["portal_token"]
    jpeg_data = _create_minimal_jpeg(width=50, height=50)

    # First attempt
    res1 = await client.post(
        f"/api/public/orders/{token}/evidence",
        content=jpeg_data,
        headers={"Content-Type": "image/jpeg", "Idempotency-Key": "idemp-ev-1"},
    )
    assert res1.status_code == 201
    ev_id = res1.json()["evidence_id"]

    # Replay with same key & same payload returns same result
    res2 = await client.post(
        f"/api/public/orders/{token}/evidence",
        content=jpeg_data,
        headers={"Content-Type": "image/jpeg", "Idempotency-Key": "idemp-ev-1"},
    )
    assert res2.status_code == 201
    assert res2.json()["evidence_id"] == ev_id

    # Same key with different payload returns 409
    different_jpeg = _create_minimal_jpeg(width=60, height=60)
    res3 = await client.post(
        f"/api/public/orders/{token}/evidence",
        content=different_jpeg,
        headers={"Content-Type": "image/jpeg", "Idempotency-Key": "idemp-ev-1"},
    )
    assert res3.status_code == 409


@pytest.mark.asyncio
async def test_evidence_storage_outage_raises_503_without_storing(client: AsyncClient, seller_identity):
    order = await _create_test_order(client)
    token = order["portal_token"]
    png_data = _create_minimal_png()

    inject_storage_outage(True)
    res = await client.post(
        f"/api/public/orders/{token}/evidence",
        content=png_data,
        headers={"Content-Type": "image/png", "Idempotency-Key": "outage-key"},
    )
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "STORAGE_UNAVAILABLE"


@pytest.mark.asyncio
async def test_rejects_foreign_evidence_id_on_submission(client: AsyncClient, seller_identity):
    order1 = await _create_test_order(client)
    # Create order 2
    order2_res = await client.post(
        "/api/seller/orders",
        json={
            "product_name": "Second watch",
            "total_minor": 600000,
            "required_advance_minor": 100000,
            "payment_account_id": order1["payment_account_id"],
        },
        headers={"Idempotency-Key": "setup-order-ev-2"},
    )
    order2 = order2_res.json()

    # Upload evidence for order 1
    png_data = _create_minimal_png()
    ev_res = await client.post(
        f"/api/public/orders/{order1['portal_token']}/evidence",
        content=png_data,
        headers={"Content-Type": "image/png", "Idempotency-Key": "ev-ord1"},
    )
    assert ev_res.status_code == 201
    foreign_ev_id = ev_res.json()["evidence_id"]

    # Attempt to submit order 2 referencing order 1's evidence
    sub_payload = {
        "buyer_name": "Rahim Ahmed",
        "contact_number": "01799999999",
        "address": {"raw_text": "Road 1, Dhanmondi, Dhaka"},
        "payment_claim": {
            "provider": "bkash",
            "trx_id": "TRX99998888",
            "sender_number": "01788888888",
            "amount_minor": 100000,
            "evidence_id": foreign_ev_id,
        },
    }
    submit_res = await client.post(
        f"/api/public/orders/{order2['portal_token']}/submission",
        json=sub_payload,
        headers={"Idempotency-Key": "sub-with-foreign-ev"},
    )
    assert submit_res.status_code == 422
    assert submit_res.json()["error"]["code"] == "FOREIGN_EVIDENCE_REFERENCE"


@pytest.mark.asyncio
async def test_shop_b_cannot_access_shop_a_evidence(client: AsyncClient, seller_identity):
    order = await _create_test_order(client)
    png_data = _create_minimal_png()
    ev_res = await client.post(
        f"/api/public/orders/{order['portal_token']}/evidence",
        content=png_data,
        headers={"Content-Type": "image/png", "Idempotency-Key": "ev-shop-a"},
    )
    evidence_id = ev_res.json()["evidence_id"]

    # Switch identity to Shop B
    seller_b = SellerIdentity(owner_id="seller_b_intruder")
    app.dependency_overrides[get_seller_identity] = lambda: seller_b

    # Set up Shop B
    await client.post(
        "/api/seller/shop",
        json={"display_name": "Shop B"},
        headers={"Idempotency-Key": "setup-shop-b"},
    )

    # Shop B attempts to get Shop A's evidence
    get_res = await client.get(f"/api/seller/evidence/{evidence_id}")
    assert get_res.status_code == 404
    assert get_res.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_cannot_upload_to_submitted_or_expired_order(client: AsyncClient, seller_identity):
    order = await _create_test_order(client)
    token = order["portal_token"]

    # Submit order first
    sub_payload = {
        "buyer_name": "Rahim Ahmed",
        "contact_number": "01799999999",
        "address": {"raw_text": "Road 1, Dhanmondi, Dhaka"},
        "payment_claim": {
            "provider": "bkash",
            "trx_id": "TRX12345678",
            "sender_number": "01788888888",
            "amount_minor": 100000,
        },
    }
    sub_res = await client.post(
        f"/api/public/orders/{token}/submission",
        json=sub_payload,
        headers={"Idempotency-Key": "sub-manual-no-ev"},
    )
    assert sub_res.status_code == 200

    # Attempt upload on submitted order
    png_data = _create_minimal_png()
    up_res = await client.post(
        f"/api/public/orders/{token}/evidence",
        content=png_data,
        headers={"Content-Type": "image/png", "Idempotency-Key": "up-after-sub"},
    )
    assert up_res.status_code == 409
    assert up_res.json()["error"]["code"] == "ORDER_ALREADY_SUBMITTED"


@pytest.mark.asyncio
async def test_evidence_upload_via_multipart_form_data(client: AsyncClient, seller_identity):
    order = await _create_test_order(client)
    token = order["portal_token"]
    png_data = _create_minimal_png(width=30, height=30)

    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="screenshot.png"\r\n'
        f"Content-Type: image/png\r\n\r\n"
    ).encode("latin1") + png_data + f"\r\n--{boundary}--\r\n".encode("latin1")

    res = await client.post(
        f"/api/public/orders/{token}/evidence",
        content=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Idempotency-Key": "multipart-ev-1",
        },
    )
    assert res.status_code == 201
    assert res.json()["media_type"] == "image/png"


@pytest.mark.asyncio
async def test_seller_evidence_expired_or_deleted_returns_410(client: AsyncClient, seller_identity):
    order = await _create_test_order(client)
    token = order["portal_token"]
    png_data = _create_minimal_png(width=20, height=20)

    res = await client.post(
        f"/api/public/orders/{token}/evidence",
        content=png_data,
        headers={"Content-Type": "image/png", "Idempotency-Key": "ev-expire-test"},
    )
    assert res.status_code == 201
    ev_id = res.json()["evidence_id"]

    # Attach evidence by submitting order
    await client.post(
        f"/api/public/orders/{token}/submission",
        json={
            "buyer_name": "Rahim Ahmed",
            "contact_number": "01799999999",
            "address": {"raw_text": "Road 1, Dhanmondi, Dhaka"},
            "payment_claim": {
                "provider": "bkash",
                "trx_id": "TRXEXP123",
                "sender_number": "01788888888",
                "amount_minor": 100000,
                "evidence_id": ev_id,
            },
        },
        headers={"Idempotency-Key": "sub-exp-test"},
    )

    # Before expiry, seller retrieval succeeds
    seller_get1 = await client.get(f"/api/seller/evidence/{ev_id}")
    assert seller_get1.status_code == 200

    # Advance clock past 30 days
    future = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=31)
    app.dependency_overrides[get_buyer_clock] = lambda: future
    from app.services import evidence_service
    # Service get_seller_evidence uses its clock
    orig_svc_init = evidence_service.EvidenceService.__init__
    evidence_service.EvidenceService.__init__ = lambda self, db=None, clock=lambda: future: orig_svc_init(self, db, clock)
    try:
        seller_get2 = await client.get(f"/api/seller/evidence/{ev_id}")
        assert seller_get2.status_code == 410
        assert seller_get2.json()["error"]["code"] == "EVIDENCE_EXPIRED"
    finally:
        evidence_service.EvidenceService.__init__ = orig_svc_init


@pytest.mark.asyncio
async def test_seller_evidence_deleted_returns_410_unavailable(client: AsyncClient, seller_identity):
    order = await _create_test_order(client)
    token = order["portal_token"]
    png_data = _create_minimal_png(width=20, height=20)

    res = await client.post(
        f"/api/public/orders/{token}/evidence",
        content=png_data,
        headers={"Content-Type": "image/png", "Idempotency-Key": "ev-del-test"},
    )
    assert res.status_code == 201
    ev_id = res.json()["evidence_id"]

    await client.post(
        f"/api/public/orders/{token}/submission",
        json={
            "buyer_name": "Rahim Ahmed",
            "contact_number": "01799999999",
            "address": {"raw_text": "Road 1, Dhanmondi, Dhaka"},
            "payment_claim": {
                "provider": "bkash",
                "trx_id": "TRXDEL123",
                "sender_number": "01788888888",
                "amount_minor": 100000,
                "evidence_id": ev_id,
            },
        },
        headers={"Idempotency-Key": "sub-del-test"},
    )

    from app.services.evidence_service import _memory_order_evidence
    _memory_order_evidence[ev_id]["status"] = "deleted"
    _memory_order_evidence[ev_id]["deleted_at"] = datetime.datetime.now(datetime.timezone.utc)

    seller_get = await client.get(f"/api/seller/evidence/{ev_id}")
    assert seller_get.status_code == 410
    assert seller_get.json()["error"]["code"] == "EVIDENCE_UNAVAILABLE"


@pytest.mark.asyncio
async def test_public_gate_denies_evidence_upload_when_unapproved(client: AsyncClient, seller_identity):
    app.dependency_overrides.pop(verify_public_access_gate, None)
    res = await client.post(
        "/api/public/orders/any-token/evidence",
        content=b"some bytes",
        headers={"Content-Type": "image/png", "Idempotency-Key": "gate-test"},
    )
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "PUBLIC_ACCESS_POLICY_UNSETTLED"


@pytest.mark.asyncio
async def test_excessive_images_rejected_per_order(client: AsyncClient, seller_identity):
    order = await _create_test_order(client)
    token = order["portal_token"]
    png_data = _create_minimal_png(width=10, height=10)

    # Upload 5 images (the maximum allowed)
    for i in range(5):
        res = await client.post(
            f"/api/public/orders/{token}/evidence",
            content=png_data,
            headers={"Content-Type": "image/png", "Idempotency-Key": f"limit-key-{i}"},
        )
        assert res.status_code == 201

    # 6th upload should be rejected with 422 EXCESSIVE_IMAGES
    res6 = await client.post(
        f"/api/public/orders/{token}/evidence",
        content=png_data,
        headers={"Content-Type": "image/png", "Idempotency-Key": "limit-key-6"},
    )
    assert res6.status_code == 422
    assert res6.json()["error"]["code"] == "EXCESSIVE_IMAGES"


@pytest.mark.asyncio
async def test_invalid_content_type_header_rejected(client: AsyncClient, seller_identity):
    order = await _create_test_order(client)
    token = order["portal_token"]

    res = await client.post(
        f"/api/public/orders/{token}/evidence",
        content=b"%PDF-1.4 fake pdf data",
        headers={"Content-Type": "application/pdf", "Idempotency-Key": "pdf-key"},
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "INVALID_IMAGE_CONTENT"
