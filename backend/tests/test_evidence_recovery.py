from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.public_gate import allow_synthetic_buyer_demo, verify_public_access_gate
from app.main import app
from app.services.buyer_service import reset_buyer_memory_store
from app.services.evidence_service import _memory_order_evidence
from app.services.evidence_store import (
    get_orphan_evidence_keys,
    init_evidence_storage,
    inject_storage_outage,
    record_orphan_evidence,
    reset_evidence_file_store,
)
from app.services.order_service import reset_order_memory_store
from app.services.raw_evidence_cleanup import reset_cleanup_memory
from app.services.seller_service import reset_memory_store
from tests.test_image_service import _create_minimal_png


@pytest.fixture(autouse=True)
def clean_environment(tmp_path: Path):
    reset_memory_store()
    reset_order_memory_store()
    reset_buyer_memory_store()
    reset_cleanup_memory()
    reset_evidence_file_store()
    storage_root = tmp_path / "evidence_storage"
    storage_root.mkdir(parents=True, exist_ok=True)
    init_evidence_storage(storage_root)
    app.dependency_overrides[verify_public_access_gate] = allow_synthetic_buyer_demo
    yield storage_root
    app.dependency_overrides.pop(verify_public_access_gate, None)
    app.dependency_overrides.pop(get_seller_identity, None)
    reset_evidence_file_store()
    reset_memory_store()
    reset_order_memory_store()
    reset_buyer_memory_store()
    reset_cleanup_memory()


async def _setup_order(client: AsyncClient) -> dict:
    seller = SellerIdentity(owner_id="seller_recovery_owner")
    app.dependency_overrides[get_seller_identity] = lambda: seller
    await client.post(
        "/api/seller/shop",
        json={"display_name": "Recovery Shop"},
        headers={"Idempotency-Key": "setup-shop-rec"},
    )
    acc_res = await client.post(
        "/api/seller/payment-accounts",
        json={"provider": "bkash", "receiving_number": "01700000000", "label": "Main"},
        headers={"Idempotency-Key": "setup-acc-rec"},
    )
    account_id = acc_res.json()["id"]
    order_res = await client.post(
        "/api/seller/orders",
        json={
            "product_name": "Recovery Watch",
            "total_minor": 500000,
            "required_advance_minor": 100000,
            "payment_account_id": account_id,
        },
        headers={"Idempotency-Key": "setup-order-rec"},
    )
    return order_res.json()


@pytest.mark.asyncio
async def test_storage_failure_during_upload_does_not_leak_private_path_and_records_failed_status():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        order = await _setup_order(client)
        token = order["portal_token"]
        png_data = _create_minimal_png(width=50, height=50)

        # Inject storage outage
        inject_storage_outage(True)

        res = await client.post(
            f"/api/public/orders/{token}/evidence",
            content=png_data,
            headers={"Content-Type": "image/png", "Idempotency-Key": "outage-key-1"},
        )
        assert res.status_code == 503
        data = res.json()
        assert data["error"]["code"] == "STORAGE_UNAVAILABLE"
        # Must not disclose server directory or filesystem path
        detail = data["error"]["message"]
        assert "evidence_storage" not in detail
        assert "\\" not in detail
        assert "/" not in detail


@pytest.mark.asyncio
async def test_cannot_attach_uncommitted_failed_evidence_to_order_submission():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        order = await _setup_order(client)
        token = order["portal_token"]
        png_data = _create_minimal_png(width=50, height=50)

        # 1. Upload fails due to outage
        inject_storage_outage(True)
        fail_res = await client.post(
            f"/api/public/orders/{token}/evidence",
            content=png_data,
            headers={"Content-Type": "image/png", "Idempotency-Key": "fail-key"},
        )
        assert fail_res.status_code == 503

        # Locate the failed evidence record in memory store
        failed_ev_ids = [k for k, v in _memory_order_evidence.items() if v.get("status") == "failed"]
        assert len(failed_ev_ids) == 1
        failed_id = failed_ev_ids[0]

        # 2. Try to submit order attaching this failed evidence
        inject_storage_outage(False)
        sub_res = await client.post(
            f"/api/public/orders/{token}/submission",
            json={
                "buyer_name": "Test Buyer",
                "contact_number": "01711111111",
                "address": {"raw_text": "Dhaka"},
                "payment_claim": {
                    "provider": "bkash",
                    "trx_id": "TRXFAILED1",
                    "sender_number": "01722222222",
                    "amount_minor": 100000,
                    "evidence_id": failed_id,
                },
            },
            headers={"Idempotency-Key": "sub-fail-key"},
        )
        # Must be rejected because evidence is failed / uncommitted
        assert sub_res.status_code == 422
        assert sub_res.json()["error"]["code"] == "UNCOMMITTED_EVIDENCE"


@pytest.mark.asyncio
async def test_retry_upload_after_outage_succeeds_and_attaches_cleanly():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        order = await _setup_order(client)
        token = order["portal_token"]
        png_data = _create_minimal_png(width=50, height=50)

        # 1. First attempt fails due to outage
        inject_storage_outage(True)
        res1 = await client.post(
            f"/api/public/orders/{token}/evidence",
            content=png_data,
            headers={"Content-Type": "image/png", "Idempotency-Key": "upload-retry-key-1"},
        )
        assert res1.status_code == 503

        # 2. Outage clears, user retries upload (new idempotency key or re-attempt)
        inject_storage_outage(False)
        res2 = await client.post(
            f"/api/public/orders/{token}/evidence",
            content=png_data,
            headers={"Content-Type": "image/png", "Idempotency-Key": "upload-retry-key-2"},
        )
        assert res2.status_code == 201
        evidence_id = res2.json()["evidence_id"]

        # 3. Submission with the successful evidence succeeds
        sub_res = await client.post(
            f"/api/public/orders/{token}/submission",
            json={
                "buyer_name": "Test Buyer",
                "contact_number": "01711111111",
                "address": {"raw_text": "Dhaka"},
                "payment_claim": {
                    "provider": "bkash",
                    "trx_id": "TRXRETRYOK",
                    "sender_number": "01722222222",
                    "amount_minor": 100000,
                    "evidence_id": evidence_id,
                },
            },
            headers={"Idempotency-Key": "sub-retry-ok"},
        )
        assert sub_res.status_code == 200
        assert _memory_order_evidence[evidence_id]["status"] == "attached"


@pytest.mark.asyncio
async def test_recover_orphan_evidence_cleans_recorded_files(clean_environment: Path):
    from app.services.evidence_store import recover_orphan_evidence, save_evidence_file

    orphan_key = "rec-shop/rec-order/orphan.png"
    save_evidence_file(orphan_key, b"orphan payload")
    record_orphan_evidence(orphan_key)

    assert orphan_key in get_orphan_evidence_keys()

    recovered_count = recover_orphan_evidence()
    assert recovered_count == 1

    # Orphan must be removed from tracking and disk
    assert orphan_key not in get_orphan_evidence_keys()
    assert not (clean_environment / orphan_key).exists()


@pytest.mark.asyncio
async def test_staging_db_commit_failure_cleans_file_and_maps_to_503(clean_environment: Path, monkeypatch: pytest.MonkeyPatch):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        order = await _setup_order(client)
        token = order["portal_token"]
        png_data = _create_minimal_png(width=50, height=50)

        # In memory mode (standby without real db session), simulate failure during post-write staging
        from app.services import evidence_staging

        async def failing_save_idempotency(*args, **kwargs):
            raise RuntimeError("Simulated failure during metadata persistence")

        monkeypatch.setattr(evidence_staging, "save_idempotency_record", failing_save_idempotency)

        res = await client.post(
            f"/api/public/orders/{token}/evidence",
            content=png_data,
            headers={"Content-Type": "image/png", "Idempotency-Key": "stage-fail-key"},
        )
        assert res.status_code == 503
        assert res.json()["error"]["code"] == "STORAGE_UNAVAILABLE"

        # Evidence file was cleaned up from storage
        all_files = list(clean_environment.rglob("*.png"))
        assert len(all_files) == 0

