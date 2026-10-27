import pytest
from httpx import AsyncClient
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401


def _buyer_submission(buyer_name: str, contact: str, trx_id: str) -> dict:
    payload: dict = {
        "buyer_name": buyer_name,
        "contact_number": contact,
        "address": {"raw_text": "House 1, Road 2, Dhaka"},
        "payment_claim": {
            "provider": "bkash",
            "trx_id": trx_id,
            "sender_number": "01811112222",
            "amount_minor": 200000,
        },
    }
    return payload


@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_replacement_creates_distinct_order_and_link_without_disclosing_successor(client: AsyncClient):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"

    payload = {
        "expected_version": order["version"],
        "reason": "Customer changed mind about product model",
        "order": {
            "product_name": "Upgraded Mechanical Keyboard RGB",
            "total_minor": 1500000,
            "required_advance_minor": 300000,
            "payment_account_id": order["payment_account_id"],
        },
    }
    res = await client.post(path + "/replacement", json=payload, headers={"Idempotency-Key": "replace-distinct-1"})
    assert res.status_code == 201, res.text
    new_order = res.json()

    assert new_order["id"] != order["id"]
    assert new_order["portal_token"] != order["portal_token"]
    assert new_order["lifecycle"] == "awaiting_buyer"
    assert new_order["predecessor_order_id"] == order["id"]

    # Public projection for predecessor: returns 200 (no 3xx redirect, no Location header)
    old_pub_res = await client.get(f"/api/public/orders/{order['portal_token']}")
    assert old_pub_res.status_code == 200
    assert "location" not in old_pub_res.headers

    old_pub = old_pub_res.json()
    assert old_pub["id"] == order["id"]
    assert old_pub["lifecycle"] == "cancelled"
    assert old_pub["product_name"] == order["product_name"]
    assert old_pub["status_message"] == "This order has been cancelled. Please contact the seller."

    # Absolutely no successor token, successor order ID, or replacement reason leaked
    old_pub_str = old_pub_res.text
    assert new_order["id"] not in old_pub_str
    assert new_order["portal_token"] not in old_pub_str
    assert "Customer changed mind about product model" not in old_pub_str
    assert "replaced_by_order_id" not in old_pub

    # Successor public projection is awaiting buyer with new terms
    new_pub_res = await client.get(f"/api/public/orders/{new_order['portal_token']}")
    assert new_pub_res.status_code == 200
    new_pub = new_pub_res.json()
    assert new_pub["id"] == new_order["id"]
    assert new_pub["lifecycle"] == "awaiting_buyer"
    assert new_pub["product_name"] == "Upgraded Mechanical Keyboard RGB"


@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_predecessor_cannot_submit_after_replacement(client: AsyncClient):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"

    payload = {
        "expected_version": order["version"],
        "reason": "Replaced before any submission",
        "order": {
            "product_name": "New Version",
            "total_minor": 1400000,
            "required_advance_minor": 200000,
            "payment_account_id": order["payment_account_id"],
        },
    }
    res = await client.post(path + "/replacement", json=payload, headers={"Idempotency-Key": "replace-action-block"})
    assert res.status_code == 201
    new_order = res.json()

    # Predecessor cannot submit details
    sub_res = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json=_buyer_submission("Late Submitter", "01711112222", "TX998877"),
        headers={"Idempotency-Key": "sub-on-cancelled-predecessor"},
    )
    assert sub_res.status_code == 409
    assert sub_res.json()["error"]["code"] == "ORDER_ALREADY_SUBMITTED"

    new_sub_res = await client.post(
        f"/api/public/orders/{new_order['portal_token']}/submission",
        json=_buyer_submission("Valid Successor Buyer", "01711113333", "TXNEW123"),
        headers={"Idempotency-Key": "sub-on-new-successor"},
    )
    assert new_sub_res.status_code == 200
    assert new_sub_res.json()["lifecycle"] == "pending"
