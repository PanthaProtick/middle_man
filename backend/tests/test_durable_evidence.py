import shutil
import subprocess
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.config import Settings
from app.core.public_gate import allow_synthetic_buyer_demo, verify_public_access_gate
from app.main import app
from app.services.buyer_service import reset_buyer_memory_store
from app.services.evidence_service import _memory_order_evidence
from app.services.evidence_store import (
    _memory_evidence_files,
    init_evidence_storage,
    reset_evidence_file_store,
)
from app.services.order_service import reset_order_memory_store
from app.services.seller_service import reset_memory_store
from tests.test_image_service import _create_minimal_png


def test_evidence_directory_is_git_ignored_and_untracked():
    repo_root = Path(__file__).resolve().parents[2]
    if not shutil.which("git") or not (repo_root / ".git").exists():
        pytest.skip("Git binary or repository not available")

    # Verify that .evidence folder is ignored by git
    evidence_dir = repo_root / ".evidence"
    probe_file = evidence_dir / "sample_probe.png"

    result = subprocess.run(
        ["git", "check-ignore", str(probe_file)],
        cwd=repo_root,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"Evidence path must be ignored by git: {probe_file}"

    # Verify that no evidence files are tracked in git
    ls_result = subprocess.run(
        ["git", "ls-files", ".evidence"],
        cwd=repo_root,
        capture_output=True,
        text=True,
    )
    assert ls_result.stdout.strip() == "", "No evidence files may be tracked in git"


def test_evidence_directory_is_not_mounted_as_static():
    # Verify no route mounts evidence folder or serves static evidence without seller auth
    mounted_routes = [route.path for route in app.routes if getattr(route, "path", None)]
    for path in mounted_routes:
        assert not path.startswith("/evidence"), f"Evidence must not be mounted at {path}"
        assert not path.startswith("/assets/evidence"), f"Evidence must not be mounted at {path}"
        assert not path.startswith("/static/evidence"), f"Evidence must not be mounted at {path}"


def test_effective_evidence_storage_path_anchors_to_repo_root():
    s = Settings(EVIDENCE_STORAGE_DIR=".evidence")
    p = s.effective_evidence_storage_path
    repo_root = Path(__file__).resolve().parents[2]
    assert p == (repo_root / ".evidence").resolve()


@pytest.mark.asyncio
async def test_screenshot_persists_across_restart_and_retrieved_by_owning_seller(tmp_path: Path):
    reset_memory_store()
    reset_order_memory_store()
    reset_buyer_memory_store()

    # Setup isolated real filesystem storage directory
    persistent_evidence_dir = tmp_path / "persistent_evidence"
    persistent_evidence_dir.mkdir(parents=True, exist_ok=True)
    init_evidence_storage(persistent_evidence_dir)

    seller_a = SellerIdentity(owner_id="seller_owner_a")
    app.dependency_overrides[get_seller_identity] = lambda: seller_a
    app.dependency_overrides[verify_public_access_gate] = allow_synthetic_buyer_demo

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Setup shop and order
            await client.post(
                "/api/seller/shop",
                json={"display_name": "Shop A"},
                headers={"Idempotency-Key": "setup-shop-restart-a"},
            )
            acc_res = await client.post(
                "/api/seller/payment-accounts",
                json={"provider": "bkash", "receiving_number": "01711111111", "label": "Main"},
                headers={"Idempotency-Key": "setup-acc-restart-a"},
            )
            account_id = acc_res.json()["id"]

            order_res = await client.post(
                "/api/seller/orders",
                json={
                    "product_name": "Durable Watch",
                    "total_minor": 500000,
                    "required_advance_minor": 100000,
                    "payment_account_id": account_id,
                },
                headers={"Idempotency-Key": "setup-order-restart-a"},
            )
            order = order_res.json()
            portal_token = order["portal_token"]

            # Upload evidence
            png_bytes = _create_minimal_png(width=50, height=50)
            upload_res = await client.post(
                f"/api/public/orders/{portal_token}/evidence",
                content=png_bytes,
                headers={"Content-Type": "image/png", "Idempotency-Key": "up-restart-1"},
            )
            assert upload_res.status_code == 201
            evidence_id = upload_res.json()["evidence_id"]

            # Evidence file is physically written to disk
            stored_files = list(persistent_evidence_dir.rglob("*.png"))
            assert len(stored_files) == 1
            assert stored_files[0].read_bytes() == png_bytes

            # Submit order attaching evidence
            sub_res = await client.post(
                f"/api/public/orders/{portal_token}/submission",
                json={
                    "buyer_name": "Buyer A",
                    "contact_number": "01722222222",
                    "address": {"raw_text": "Dhaka"},
                    "payment_claim": {
                        "provider": "bkash",
                        "trx_id": "TRXRESTART1",
                        "sender_number": "01733333333",
                        "amount_minor": 100000,
                        "evidence_id": evidence_id,
                    },
                },
                headers={"Idempotency-Key": "sub-restart-1"},
            )
            assert sub_res.status_code == 200

            # Public order projection does NOT leak evidence ID, path, or URL
            public_get = await client.get(f"/api/public/orders/{portal_token}")
            assert public_get.status_code == 200
            public_order = public_get.json()
            assert "evidence_id" not in public_order
            assert "storage_key" not in public_order
            assert "url" not in public_order

            # ------------------------------------------------------------------
            # SIMULATE APPLICATION RESTART
            # ------------------------------------------------------------------
            # Clear memory file caches to prove data is not in memory
            _memory_evidence_files.clear()
            # Reinstate storage directory pointing to same disk path
            init_evidence_storage(persistent_evidence_dir)

            # Owning seller retrieves evidence after restart
            seller_get = await client.get(f"/api/seller/evidence/{evidence_id}")
            assert seller_get.status_code == 200
            assert seller_get.content == png_bytes
            assert seller_get.headers["Content-Type"] == "image/png"
            assert "private" in seller_get.headers["Cache-Control"]

            # Foreign Shop B cannot access Shop A's evidence -> 404 (no leak)
            seller_b = SellerIdentity(owner_id="seller_owner_b")
            app.dependency_overrides[get_seller_identity] = lambda: seller_b
            await client.post(
                "/api/seller/shop",
                json={"display_name": "Shop B"},
                headers={"Idempotency-Key": "setup-shop-restart-b"},
            )
            shop_b_get = await client.get(f"/api/seller/evidence/{evidence_id}")
            assert shop_b_get.status_code == 404
            assert shop_b_get.json()["error"]["code"] == "NOT_FOUND"

            # Unauthenticated request cannot access evidence -> 401
            app.dependency_overrides.pop(get_seller_identity, None)
            unauth_get = await client.get(f"/api/seller/evidence/{evidence_id}")
            assert unauth_get.status_code == 401

            # Corrupted / malicious storage key escaping root fails closed -> 503
            app.dependency_overrides[get_seller_identity] = lambda: seller_a
            _memory_order_evidence[evidence_id]["storage_key"] = "../../escaped_path.png"
            escaped_get = await client.get(f"/api/seller/evidence/{evidence_id}")
            assert escaped_get.status_code == 503
            assert escaped_get.json()["error"]["code"] == "STORAGE_UNAVAILABLE"

    finally:
        app.dependency_overrides.pop(get_seller_identity, None)
        app.dependency_overrides.pop(verify_public_access_gate, None)
        reset_evidence_file_store()
        reset_memory_store()
        reset_order_memory_store()
        reset_buyer_memory_store()
