import pytest
from test_payment_exceptions import exception_case
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401
from transaction_route_support import clean_stores  # noqa: F401


@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_replace_unallocated_order_creates_linked_new_order_and_cancels_predecessor(client):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"

    payload = {
        "expected_version": order["version"],
        "reason": "Customer wanted higher spec model",
        "order": {
            "product_name": "Upgraded Premium Leather Wallet",
            "total_minor": 1500000,
            "required_advance_minor": 300000,
            "payment_account_id": order["payment_account_id"],
        },
    }
    res = await client.post(path + "/replacement", json=payload, headers={"Idempotency-Key": "replace-1"})
    assert res.status_code == 201, res.text
    new_order = res.json()

    # Replacement order verification
    assert new_order["id"] != order["id"]
    assert new_order["product_name"] == "Upgraded Premium Leather Wallet"
    assert new_order["total_minor"] == 1500000
    assert new_order["required_advance_minor"] == 300000
    assert new_order["lifecycle"] == "awaiting_buyer"
    assert new_order["version"] == 1
    assert new_order["predecessor_order_id"] == order["id"]
    assert new_order["portal_token"] != order["portal_token"]

    # Predecessor order is atomically cancelled and links to replacement
    old_res = await client.get(path)
    assert old_res.status_code == 200
    old_order = old_res.json()
    assert old_order["lifecycle"] == "cancelled"
    assert old_order["replaced_by_order_id"] == new_order["id"]
    assert old_order["version"] == order["version"] + 1


@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_replace_allocated_order_returns_payment_resolution_required(client):
    order, receipt = await exception_case(client)
    path = f"/api/seller/orders/{order['id']}"

    # Confirm the order
    conf_payload = {
        "action": "confirm",
        "expected_version": order["version"],
        "expected_transaction_version": receipt["version"],
        "transaction_id": receipt["id"],
        "accepted_amount_minor": 150000,
        "reason": "Valid advance received",
    }
    conf_res = await client.post(
        path + "/decisions", json=conf_payload, headers={"Idempotency-Key": "conf-for-replace"}
    )
    assert conf_res.status_code == 200
    confirmed = conf_res.json()

    # Attempt replacement on allocated order
    replace_payload = {
        "expected_version": confirmed["version"],
        "reason": "Attempt to replace after payment allocation",
        "order": {
            "product_name": "Replacement Item",
            "total_minor": 1500000,
            "required_advance_minor": 300000,
            "payment_account_id": order["payment_account_id"],
        },
    }
    res = await client.post(path + "/replacement", json=replace_payload, headers={"Idempotency-Key": "replace-alloc"})
    assert res.status_code == 409
    assert "PAYMENT_RESOLUTION_REQUIRED" in res.text


@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_replace_already_replaced_order_rejected(client):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"

    payload = {
        "expected_version": order["version"],
        "reason": "First replacement",
        "order": {
            "product_name": "New Product 1",
            "total_minor": 1400000,
            "required_advance_minor": 200000,
            "payment_account_id": order["payment_account_id"],
        },
    }
    res1 = await client.post(path + "/replacement", json=payload, headers={"Idempotency-Key": "replace-twice-1"})
    assert res1.status_code == 201

    payload2 = {
        "expected_version": order["version"] + 1,
        "reason": "Second replacement attempt",
        "order": {
            "product_name": "New Product 2",
            "total_minor": 1600000,
            "required_advance_minor": 200000,
            "payment_account_id": order["payment_account_id"],
        },
    }
    res2 = await client.post(path + "/replacement", json=payload2, headers={"Idempotency-Key": "replace-twice-2"})
    assert res2.status_code == 409


@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_replace_idempotency_replay_and_conflict(client):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"

    payload = {
        "expected_version": order["version"],
        "reason": "Replacement test for idempotency",
        "order": {
            "product_name": "Idem Replacement",
            "total_minor": 1400000,
            "required_advance_minor": 200000,
            "payment_account_id": order["payment_account_id"],
        },
    }
    res1 = await client.post(path + "/replacement", json=payload, headers={"Idempotency-Key": "replace-idem-1"})
    assert res1.status_code == 201

    # Same key and payload -> exact same response
    res2 = await client.post(path + "/replacement", json=payload, headers={"Idempotency-Key": "replace-idem-1"})
    assert res2.status_code == 201
    assert res2.json() == res1.json()

    # Same key and different payload -> 409 conflict
    diff_payload = {
        "expected_version": order["version"],
        "reason": "Different reason",
        "order": {
            "product_name": "Different Product",
            "total_minor": 1400000,
            "required_advance_minor": 200000,
            "payment_account_id": order["payment_account_id"],
        },
    }
    res3 = await client.post(path + "/replacement", json=diff_payload, headers={"Idempotency-Key": "replace-idem-1"})
    assert res3.status_code == 409


@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_replace_unallocated_pending_does_not_transfer_buyer_claims(client):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"

    # Buyer submits claim to predecessor
    sub = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json={
            "buyer_name": "Old Buyer",
            "contact_number": "01711111111",
            "address": {"raw_text": "Dhanmondi 27"},
            "payment_claim": {
                "provider": "bkash",
                "trx_id": "CLAIM999",
                "sender_number": "01811111111",
                "amount_minor": 200000,
            },
        },
        headers={"Idempotency-Key": "sub-old-claim"},
    )
    assert sub.status_code == 200
    pending_order = (await client.get(path)).json()
    assert pending_order["lifecycle"] == "pending"
    assert pending_order["buyer_revision"] == 1

    # Replace the pending unallocated predecessor
    res = await client.post(
        path + "/replacement",
        json={
            "expected_version": pending_order["version"],
            "reason": "Agreed to replace before payment was matched",
            "order": {
                "product_name": "Completely New Deal",
                "total_minor": 1600000,
                "required_advance_minor": 300000,
                "payment_account_id": order["payment_account_id"],
            },
        },
        headers={"Idempotency-Key": "replace-pending-1"},
    )
    assert res.status_code == 201
    new_order = res.json()

    # Replacement order MUST NOT have buyer claims or revisions transferred
    assert new_order["buyer_revision"] is None
    assert new_order["lifecycle"] == "awaiting_buyer"
    assert new_order["predecessor_order_id"] == order["id"]

    # Public projection for new order is awaiting buyer
    pub_new = (await client.get(f"/api/public/orders/{new_order['portal_token']}")).json()
    assert pub_new["lifecycle"] == "awaiting_buyer"
    assert pub_new["product_name"] == "Completely New Deal"

    # Predecessor public projection is cancelled
    pub_old = (await client.get(f"/api/public/orders/{order['portal_token']}")).json()
    assert pub_old["lifecycle"] == "cancelled"
