"""Device language does not alter order terms, authorization or link replay contracts."""
import pytest
from httpx import AsyncClient
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity

from app.core.auth import SellerIdentity, get_seller_identity
from app.main import app

__all__ = ["clean_memory_stores", "seller_identity"]


@pytest.mark.asyncio
@pytest.mark.parametrize("language,other", [("en", "bn-BD"), ("bn-BD", "en")])
async def test_order_and_link_contracts_are_language_independent(client: AsyncClient, seller_identity, language, other):
    seed = await _create_test_order(client)
    payload = {
        "product_name": "ব্যাগ Bag ১২", "total_minor": 250025, "required_advance_minor": 30010,
        "payment_account_id": seed["payment_account_id"], "parcel_weight_grams": 1001, "parcel_quantity": 2,
    }
    headers = {"Accept-Language": language, "Idempotency-Key": "locale-order"}
    response = await client.post("/api/seller/orders", json=payload, headers=headers)
    assert response.status_code == 201
    order = response.json()
    for field, value in payload.items():
        assert order[field] == value
    assert order["expected_cod_minor"] == 220015
    headers["Accept-Language"] = other
    replay = await client.post("/api/seller/orders", json=payload, headers=headers)
    assert replay.json() == order
    conflict = await client.post("/api/seller/orders", json={**payload, "total_minor": 250026}, headers=headers)
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"

    listing = await client.get("/api/seller/orders?status=awaiting_buyer", headers={"Accept-Language": other})
    assert listing.status_code == 200
    assert order["id"] in [item["id"] for item in listing.json()["items"]]
    path = f"/api/seller/orders/{order['id']}"
    assert (await client.get(path, headers={"Accept-Language": other})).json() == order
    invalid = await client.post("/api/seller/orders", json={**payload, "parcel_quantity": 0},
                                headers={"Accept-Language": other, "Idempotency-Key": "invalid-locale"})
    assert invalid.status_code == 422
    error = invalid.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert any(item["field"] == "parcel_quantity" and item["code"] == "greater_than_equal" for item in error["fields"])

    access_payload = {"expected_version": order["version"]}
    rotate_headers = {"Accept-Language": language, "Idempotency-Key": "locale-rotate"}
    rotated = await client.post(path + "/reissue-link", json=access_payload, headers=rotate_headers)
    assert rotated.status_code == 200
    fresh = rotated.json()
    assert fresh["portal_url"] != order["portal_url"]
    rotate_headers["Accept-Language"] = other
    assert (await client.post(path + "/reissue-link", json=access_payload, headers=rotate_headers)).json() == fresh
    assert (await client.get(f"/api/public/orders/{order['portal_token']}")).status_code == 404
    assert (await client.get(f"/api/public/orders/{fresh['portal_token']}", headers={"Accept-Language": other})).status_code == 200
    revoked = await client.post(path + "/revoke-link", json={"expected_version": fresh["version"]},
                               headers={"Accept-Language": other, "Idempotency-Key": "locale-revoke"})
    assert revoked.status_code == 200
    assert (await client.get(f"/api/public/orders/{fresh['portal_token']}")).status_code == 410
    assert (await client.get(path)).status_code == 200
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id="foreign-locale")
    assert (await client.get(path, headers={"Accept-Language": other})).status_code == 404
    app.dependency_overrides.pop(get_seller_identity)
    assert (await client.get(path, headers={"Accept-Language": language})).status_code == 401
