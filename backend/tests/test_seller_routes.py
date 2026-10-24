import pytest
from httpx import AsyncClient

from app.core.auth import SellerIdentity, get_seller_identity
from app.main import app


@pytest.mark.asyncio
async def test_seller_routes_unauthenticated_returns_401(client: AsyncClient) -> None:
    response = await client.get("/api/seller/shop")
    assert response.status_code == 401
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_seller_routes_unavailable_verifier_returns_503(client: AsyncClient) -> None:
    async def mock_unavailable_verifier() -> SellerIdentity:
        from app.core.auth import AuthenticationUnavailableError
        raise AuthenticationUnavailableError("Identity verifier unreachable")

    app.dependency_overrides[get_seller_identity] = mock_unavailable_verifier
    try:
        response = await client.get("/api/seller/shop")
        assert response.status_code == 503
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == "AUTH_UNAVAILABLE"
    finally:
        app.dependency_overrides.pop(get_seller_identity, None)


@pytest.mark.asyncio
async def test_seller_shop_lifecycle_and_idempotency(client: AsyncClient) -> None:
    seller = SellerIdentity(owner_id="seller_test_owner_1")
    app.dependency_overrides[get_seller_identity] = lambda: seller
    try:
        # 1. Shop initial status -> setup_needed
        resp = await client.get("/api/seller/shop")
        assert resp.status_code == 200
        data = resp.json()
        assert data["setup_needed"] is True
        assert data["shop"] is None

        # 2. Create shop with idempotency key
        headers = {"Idempotency-Key": "shop-create-key-1"}
        payload = {"display_name": "Pantha's Gadgets"}
        resp2 = await client.post("/api/seller/shop", json=payload, headers=headers)
        assert resp2.status_code == 201
        created = resp2.json()["shop"]
        assert created["display_name"] == "Pantha's Gadgets"
        assert created["owner_id"] == "seller_test_owner_1"
        shop_id = created["id"]

        # 3. Same key + same payload -> idempotent replay
        resp_replay = await client.post("/api/seller/shop", json=payload, headers=headers)
        assert resp_replay.status_code in (200, 201)
        assert resp_replay.json()["shop"]["id"] == shop_id

        # 4. Same key + different payload -> 409 IDEMPOTENCY_KEY_REUSED
        resp_conflict = await client.post("/api/seller/shop", json={"display_name": "Different Name"}, headers=headers)
        assert resp_conflict.status_code == 409
        assert resp_conflict.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"

        # 5. Get shop now returns existing shop
        resp_after = await client.get("/api/seller/shop")
        assert resp_after.status_code == 200
        data_after = resp_after.json()
        assert data_after["setup_needed"] is False
        assert data_after["shop"]["id"] == shop_id
        assert data_after["shop"]["display_name"] == "Pantha's Gadgets"
    finally:
        app.dependency_overrides.pop(get_seller_identity, None)


@pytest.mark.asyncio
async def test_seller_payment_accounts_lifecycle(client: AsyncClient) -> None:
    seller = SellerIdentity(owner_id="seller_test_owner_2")
    app.dependency_overrides[get_seller_identity] = lambda: seller
    try:
        # Create shop first
        await client.post(
            "/api/seller/shop",
            json={"display_name": "Ratul's Corner"},
            headers={"Idempotency-Key": "shop-ratul-key"},
        )

        # 1. Validation: invalid provider returns 422
        resp_bad_provider = await client.post(
            "/api/seller/payment-accounts",
            json={"provider": "rocket", "receiving_number": "01711111111", "label": "Rocket"},
            headers={"Idempotency-Key": "acc-key-bad"},
        )
        assert resp_bad_provider.status_code == 422

        # 2. Validation: invalid phone returns 422
        resp_bad_phone = await client.post(
            "/api/seller/payment-accounts",
            json={"provider": "bkash", "receiving_number": "12345", "label": "Invalid Phone"},
            headers={"Idempotency-Key": "acc-key-bad-phone"},
        )
        assert resp_bad_phone.status_code == 422

        # 3. Create bKash account with Bangla digits (AC08)
        resp_create = await client.post(
            "/api/seller/payment-accounts",
            json={"provider": "bkash", "receiving_number": "০১৭১১২২৩৩৪৪", "label": "Personal bKash"},
            headers={"Idempotency-Key": "acc-key-1"},
        )
        assert resp_create.status_code == 201
        acc = resp_create.json()
        assert acc["provider"] == "bkash"
        assert acc["receiving_number"] == "01711223344"
        assert acc["label"] == "Personal bKash"
        assert acc["is_active"] is True
        assert acc["version"] == 1
        account_id = acc["id"]

        # 4. List accounts
        resp_list = await client.get("/api/seller/payment-accounts")
        assert resp_list.status_code == 200
        accounts = resp_list.json()
        assert len(accounts) == 1
        assert accounts[0]["id"] == account_id

        # 5. Patch account (relabel and deactivate)
        resp_patch = await client.patch(
            f"/api/seller/payment-accounts/{account_id}",
            json={"expected_version": 1, "label": "Merchant bKash", "is_active": False},
        )
        assert resp_patch.status_code == 200
        updated = resp_patch.json()
        assert updated["label"] == "Merchant bKash"
        assert updated["is_active"] is False
        assert updated["version"] == 2

        # 6. Patch with stale version returns 409 STALE_VERSION
        resp_stale = await client.patch(
            f"/api/seller/payment-accounts/{account_id}",
            json={"expected_version": 1, "label": "Stale Update"},
        )
        assert resp_stale.status_code == 409
        assert resp_stale.json()["error"]["code"] == "STALE_VERSION"
    finally:
        app.dependency_overrides.pop(get_seller_identity, None)


@pytest.mark.asyncio
async def test_seller_shop_isolation(client: AsyncClient) -> None:
    # Shop A
    seller_a = SellerIdentity(owner_id="seller_a")
    app.dependency_overrides[get_seller_identity] = lambda: seller_a
    try:
        await client.post(
            "/api/seller/shop",
            json={"display_name": "Shop A"},
            headers={"Idempotency-Key": "shop-a-key"},
        )
        resp_acc = await client.post(
            "/api/seller/payment-accounts",
            json={"provider": "nagad", "receiving_number": "01811223344", "label": "Shop A Nagad"},
            headers={"Idempotency-Key": "acc-a-key"},
        )
        acc_a_id = resp_acc.json()["id"]
    finally:
        app.dependency_overrides.pop(get_seller_identity, None)

    # Shop B
    seller_b = SellerIdentity(owner_id="seller_b")
    app.dependency_overrides[get_seller_identity] = lambda: seller_b
    try:
        await client.post(
            "/api/seller/shop",
            json={"display_name": "Shop B"},
            headers={"Idempotency-Key": "shop-b-key"},
        )
        # Listing accounts for Shop B must not return Shop A's account
        resp_list_b = await client.get("/api/seller/payment-accounts")
        assert resp_list_b.status_code == 200
        assert len(resp_list_b.json()) == 0

        # Patching Shop A's account by Shop B must return 404 without leaking existence details (AC02)
        resp_patch_foreign = await client.patch(
            f"/api/seller/payment-accounts/{acc_a_id}",
            json={"expected_version": 1, "label": "Hacked Label"},
        )
        assert resp_patch_foreign.status_code == 404
        assert resp_patch_foreign.json()["error"]["code"] == "NOT_FOUND"
    finally:
        app.dependency_overrides.pop(get_seller_identity, None)


@pytest.mark.asyncio
async def test_seller_retention_status_and_cleanup_routes(client: AsyncClient) -> None:
    # 1. Unauthenticated -> 401
    unauth = await client.get("/api/seller/retention/status")
    assert unauth.status_code == 401

    seller = SellerIdentity(owner_id="seller_retention_routes")
    app.dependency_overrides[get_seller_identity] = lambda: seller
    try:
        # Shop not created yet -> 404
        no_shop = await client.get("/api/seller/retention/status")
        assert no_shop.status_code == 404

        # Create shop
        await client.post(
            "/api/seller/shop",
            json={"display_name": "Retention Shop"},
            headers={"Idempotency-Key": "ret-shop-key"},
        )

        # GET retention status -> 200
        res = await client.get("/api/seller/retention/status")
        assert res.status_code == 200
        data = res.json()
        assert "shop_id" in data
        assert "counts" in data
        assert data["overdue_count"] == 0

        # POST retention cleanup -> 200
        cleanup_res = await client.post("/api/seller/retention/cleanup")
        assert cleanup_res.status_code == 200
        cleanup_data = cleanup_res.json()
        assert cleanup_data["status"] == "clean"
        assert cleanup_data["items_purged"] == 0
    finally:
        app.dependency_overrides.pop(get_seller_identity, None)
