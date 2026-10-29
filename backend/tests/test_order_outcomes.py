import pytest
from test_payment_exceptions import exception_case
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401
from transaction_route_support import clean_stores  # noqa: F401


@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_cancel_awaiting_buyer_order(client):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"

    payload = {
        "action": "cancel",
        "expected_version": order["version"],
        "reason": "Customer requested order cancellation",
    }
    res = await client.post(path + "/decisions", json=payload, headers={"Idempotency-Key": "cancel-1"})
    assert res.status_code == 200, res.text
    cancelled = res.json()
    assert cancelled["lifecycle"] == "cancelled"
    assert cancelled["version"] == order["version"] + 1
    assert cancelled["completed_at"] is not None

    # Public projection reflects cancellation directing contact with seller
    pub = (await client.get(f"/api/public/orders/{order['portal_token']}")).json()
    assert pub["lifecycle"] == "cancelled"
    assert "contact the seller" in pub["status_message"].lower()

    # Buyer cannot submit
    sub = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json={
            "buyer_name": "Buyer Name",
            "contact_number": "01711111111",
            "address": {"raw_text": "Banani Dhaka"},
            "payment_claim": {
                "provider": "bkash",
                "trx_id": "TX12345",
                "sender_number": "01811111111",
                "amount_minor": 200000,
            },
        },
        headers={"Idempotency-Key": "sub-cancelled"},
    )
    assert sub.status_code == 409


@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_cancel_confirmed_order_preserves_allocation_and_markers(client):
    order, receipt = await exception_case(client)
    path = f"/api/seller/orders/{order['id']}"
    # Confirm the order first
    conf_payload = {
        "action": "confirm",
        "expected_version": order["version"],
        "expected_transaction_version": receipt["version"],
        "transaction_id": receipt["id"],
        "accepted_amount_minor": 150000,
        "reason": "Valid advance received",
    }
    conf_res = await client.post(path + "/decisions", json=conf_payload, headers={"Idempotency-Key": "conf-for-cancel"})
    assert conf_res.status_code == 200
    confirmed = conf_res.json()
    assert confirmed["lifecycle"] == "confirmed"
    initial_completed_at = confirmed["completed_at"]
    assert initial_completed_at is not None

    # Now cancel the confirmed order
    cancel_payload = {
        "action": "cancel",
        "expected_version": confirmed["version"],
        "reason": "Deal cancelled post-payment by seller request",
    }
    cancel_res = await client.post(path + "/decisions", json=cancel_payload, headers={"Idempotency-Key": "cancel-conf"})
    assert cancel_res.status_code == 200, cancel_res.text
    cancelled = cancel_res.json()
    assert cancelled["lifecycle"] == "cancelled"
    assert cancelled["version"] == confirmed["version"] + 1
    # Retains first terminal completion time
    assert cancelled["completed_at"] == initial_completed_at
    # Allocation & actual cod preserved
    assert cancelled["actual_cod_minor"] == 1050000
    assert cancelled["allocation_basis"] == "manual"

    # Cannot allocate the same receipt to another order (funds are NOT released and used marker preserved)
    order2_res = await client.post(
        "/api/seller/orders",
        json={
            "product_name": "Second Product",
            "total_minor": 1200000,
            "required_advance_minor": 200000,
            "payment_account_id": order["payment_account_id"],
        },
        headers={"Idempotency-Key": "setup-order-2"},
    )
    assert order2_res.status_code == 201
    order2 = order2_res.json()

    sub2 = await client.post(
        f"/api/public/orders/{order2['portal_token']}/submission",
        json={
            "buyer_name": "Buyer 2",
            "contact_number": "01722222222",
            "address": {"raw_text": "Gulshan 2, Dhaka"},
            "payment_claim": {
                "provider": "bkash",
                "trx_id": "EXCEPTION",
                "sender_number": "01822222222",
                "amount_minor": 200000,
            },
        },
        headers={"Idempotency-Key": "sub-order-2"},
    )
    assert sub2.status_code == 200

    preview2 = await client.get(
        f"/api/seller/orders/{order2['id']}/payment-preview", params={"transaction_id": receipt["id"]}
    )
    assert preview2.status_code == 200
    assert "PAYMENT_USED" in preview2.json()["blockers"]


@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_reject_pending_order(client):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"

    # Buyer submits details -> becomes pending
    sub = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json={
            "buyer_name": "Synthetic Buyer",
            "contact_number": "01711111111",
            "address": {"raw_text": "Mirpur 10, Dhaka"},
            "payment_claim": {
                "provider": "bkash",
                "trx_id": "FAKE123",
                "sender_number": "01811111111",
                "amount_minor": 200000,
            },
        },
        headers={"Idempotency-Key": "sub-for-reject"},
    )
    assert sub.status_code == 200
    pending_order = (await client.get(path)).json()
    assert pending_order["lifecycle"] == "pending"

    # Seller explicitly rejects
    reject_payload = {
        "action": "reject",
        "expected_version": pending_order["version"],
        "reason": "Fraudulent TrxID not found in records",
    }
    reject_res = await client.post(path + "/decisions", json=reject_payload, headers={"Idempotency-Key": "reject-1"})
    assert reject_res.status_code == 200, reject_res.text
    rejected = reject_res.json()
    assert rejected["lifecycle"] == "rejected"
    assert rejected["version"] == pending_order["version"] + 1
    assert rejected["completed_at"] is not None

    # Terminal buyer projection directing contact with seller
    pub = (await client.get(f"/api/public/orders/{order['portal_token']}")).json()
    assert pub["lifecycle"] == "rejected"
    assert "contact the seller" in pub["status_message"].lower()

    # Self-resubmission is blocked
    sub2 = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json={
            "buyer_name": "Synthetic Buyer",
            "contact_number": "01711111111",
            "address": {"raw_text": "Mirpur 10, Dhaka"},
            "payment_claim": {
                "provider": "bkash",
                "trx_id": "FAKE123",
                "sender_number": "01811111111",
                "amount_minor": 200000,
            },
        },
        headers={"Idempotency-Key": "sub-resubmit"},
    )
    assert sub2.status_code == 409


@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_reject_confirmed_order_forbidden(client):
    order, receipt = await exception_case(client)
    path = f"/api/seller/orders/{order['id']}"
    conf_payload = {
        "action": "confirm",
        "expected_version": order["version"],
        "expected_transaction_version": receipt["version"],
        "transaction_id": receipt["id"],
        "accepted_amount_minor": 150000,
        "reason": "Valid advance received",
    }
    conf_res = await client.post(path + "/decisions", json=conf_payload, headers={"Idempotency-Key": "conf-for-reject"})
    assert conf_res.status_code == 200
    confirmed = conf_res.json()

    reject_payload = {
        "action": "reject",
        "expected_version": confirmed["version"],
        "reason": "Attempt to reject confirmed order",
    }
    res = await client.post(path + "/decisions", json=reject_payload, headers={"Idempotency-Key": "reject-conf"})
    assert res.status_code == 409


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_reject_awaiting_buyer_order_forbidden(client):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"

    # Awaiting buyer order cannot be rejected (only pending can be rejected)
    reject_payload = {
        'action': 'reject',
        'expected_version': order['version'],
        'reason': 'Cannot reject order before buyer submitted details',
    }
    res = await client.post(path + '/decisions', json=reject_payload, headers={'Idempotency-Key': 'reject-awaiting'})
    assert res.status_code == 409
    assert 'INVALID_LIFECYCLE' in res.text or 'pending' in res.text.lower()
