import pytest
from test_payment_exceptions import exception_case
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401
from test_transaction_routes import clean_stores  # noqa: F401

from app.core.auth import SellerIdentity, get_seller_identity
from app.main import app


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
@pytest.mark.usefixtures("seller_identity")
async def test_decision_stale_version_and_blank_reason(client):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"

    # Stale version
    stale_payload = {
        "action": "cancel",
        "expected_version": 999,
        "reason": "Wrong version test",
    }
    res = await client.post(path + "/decisions", json=stale_payload, headers={"Idempotency-Key": "stale-1"})
    assert res.status_code == 409
    assert "STALE_VERSION" in res.text or "changed" in res.text.lower()

    # Blank reason
    blank_payload = {
        "action": "cancel",
        "expected_version": order["version"],
        "reason": "   ",
    }
    res2 = await client.post(path + "/decisions", json=blank_payload, headers={"Idempotency-Key": "blank-1"})
    assert res2.status_code == 422


@pytest.mark.asyncio
async def test_decision_shop_isolation(client):
    # Setup Shop A
    seller_a = SellerIdentity(owner_id="owner_a")
    app.dependency_overrides[get_seller_identity] = lambda: seller_a
    order = await _create_test_order(client)

    # Switch to Shop B
    seller_b = SellerIdentity(owner_id="owner_b")
    app.dependency_overrides[get_seller_identity] = lambda: seller_b
    await client.post(
        "/api/seller/shop",
        json={"display_name": "Shop B"},
        headers={"Idempotency-Key": "setup-shop-b"},
    )

    path = f"/api/seller/orders/{order['id']}"
    res = await client.post(
        path + "/decisions",
        json={
            "action": "cancel",
            "expected_version": 1,
            "reason": "Cross shop cancellation attempt",
        },
        headers={"Idempotency-Key": "cross-shop-1"},
    )
    assert res.status_code == 404


@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_decision_idempotency_replay_and_conflict(client):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"
    payload = {"action": "cancel", "expected_version": order["version"], "reason": "Customer changed mind"}
    res1 = await client.post(path + "/decisions", json=payload, headers={"Idempotency-Key": "idem-cancel"})
    assert res1.status_code == 200
    res2 = await client.post(path + "/decisions", json=payload, headers={"Idempotency-Key": "idem-cancel"})
    assert res2.status_code == 200
    assert res2.json() == res1.json()

    # Different payload with same mutation key
    diff_payload = {"action": "cancel", "expected_version": order["version"], "reason": "Different reason"}
    res3 = await client.post(path + "/decisions", json=diff_payload, headers={"Idempotency-Key": "idem-cancel"})
    assert res3.status_code == 409


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
async def test_replace_stale_version_and_blank_reason(client):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"

    # Stale version
    payload_stale = {
        "expected_version": 999,
        "reason": "Replacement test",
        "order": {
            "product_name": "New Product",
            "total_minor": 1400000,
            "required_advance_minor": 200000,
            "payment_account_id": order["payment_account_id"],
        },
    }
    res = await client.post(path + "/replacement", json=payload_stale, headers={"Idempotency-Key": "replace-stale"})
    assert res.status_code == 409

    # Blank reason
    payload_blank = {
        "expected_version": order["version"],
        "reason": "   ",
        "order": {
            "product_name": "New Product",
            "total_minor": 1400000,
            "required_advance_minor": 200000,
            "payment_account_id": order["payment_account_id"],
        },
    }
    res2 = await client.post(path + "/replacement", json=payload_blank, headers={"Idempotency-Key": "replace-blank"})
    assert res2.status_code == 422


@pytest.mark.asyncio
async def test_replace_cross_shop_isolation(client):
    seller_a = SellerIdentity(owner_id="owner_a_replace")
    app.dependency_overrides[get_seller_identity] = lambda: seller_a
    order = await _create_test_order(client)

    seller_b = SellerIdentity(owner_id="owner_b_replace")
    app.dependency_overrides[get_seller_identity] = lambda: seller_b
    await client.post(
        "/api/seller/shop",
        json={"display_name": "Shop B Replacement"},
        headers={"Idempotency-Key": "setup-shop-b-replace"},
    )

    path = f"/api/seller/orders/{order['id']}"
    res = await client.post(
        path + "/replacement",
        json={
            "expected_version": 1,
            "reason": "Unauthorized cross shop replacement",
            "order": {
                "product_name": "Hacked Product",
                "total_minor": 1400000,
                "required_advance_minor": 200000,
                "payment_account_id": order["payment_account_id"],
            },
        },
        headers={"Idempotency-Key": "cross-replace-1"},
    )
    assert res.status_code == 404


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


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_replace_rejected_or_cancelled_order_forbidden(client):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"

    # Cancel order
    cancel_res = await client.post(path + '/decisions', json={
        'action': 'cancel',
        'expected_version': 1,
        'reason': 'Cancelled first',
    }, headers={'Idempotency-Key': 'cancel-before-replace'})
    assert cancel_res.status_code == 200

    # Cannot replace an already cancelled order
    res = await client.post(path + '/replacement', json={
        'expected_version': 2,
        'reason': 'Replace cancelled order',
        'order': {
            'product_name': 'Replacement',
            'total_minor': 1300000,
            'required_advance_minor': 200000,
            'payment_account_id': order['payment_account_id'],
        },
    }, headers={'Idempotency-Key': 'replace-cancelled'})
    assert res.status_code == 409
    assert 'INVALID_LIFECYCLE' in res.text


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_replace_expired_order_preserves_expired_lifecycle(client):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"

    # Expire the order manually in store
    from app.services.order_service import _memory_orders
    _memory_orders[order['id']]['lifecycle'] = 'expired'
    _memory_orders[order['id']]['version'] = 2

    res = await client.post(path + '/replacement', json={
        'expected_version': 2,
        'reason': 'Customer requested new link after expiry',
        'order': {
            'product_name': 'Replacement For Expired',
            'total_minor': 1300000,
            'required_advance_minor': 200000,
            'payment_account_id': order['payment_account_id'],
        },
    }, headers={'Idempotency-Key': 'replace-expired'})
    assert res.status_code == 201
    new_order = res.json()

    # Predecessor order remains expired (does not become cancelled)
    old_order = (await client.get(path)).json()
    assert old_order['lifecycle'] == 'expired'
    assert old_order['replaced_by_order_id'] == new_order['id']


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_decision_cross_action_idempotency_conflict(client):
    order, receipt = await exception_case(client)
    path = f"/api/seller/orders/{order['id']}"

    # First call: confirm
    conf_payload = {
        'action': 'confirm',
        'expected_version': order['version'],
        'expected_transaction_version': receipt['version'],
        'transaction_id': receipt['id'],
        'accepted_amount_minor': 150000,
        'reason': 'Confirming advance',
    }
    res1 = await client.post(path + '/decisions', json=conf_payload, headers={'Idempotency-Key': 'shared-decision-key'})
    assert res1.status_code == 200

    # Second call with SAME key but different action (cancel)
    cancel_payload = {
        'action': 'cancel',
        'expected_version': order['version'],
        'reason': 'Attempt to cancel with same idempotency key',
    }
    res2 = await client.post(path + '/decisions', json=cancel_payload, headers={'Idempotency-Key': 'shared-decision-key'})
    assert res2.status_code == 409
