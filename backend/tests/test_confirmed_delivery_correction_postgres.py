import datetime

import pytest


@pytest.mark.asyncio
async def test_postgres_confirmed_delivery_correction_persistence_and_invariants(postgres_buyer):
    client, connection, _, order = postgres_buyer
    payment_time = datetime.datetime.now(datetime.timezone.utc)
    claim = {'provider': 'bkash', 'trx_id': 'CONF-DELIV-1', 'sender_number': '01822222222', 'amount_minor': 200000}

    # 1. Submit claim and match receipt to achieve confirmed state
    sub_res = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json={'buyer_name': 'Original Buyer', 'contact_number': '01711111111',
              'address': {'raw_text': 'Original Address, Dhaka'}, 'payment_claim': claim},
        headers={'Idempotency-Key': 'conf-sub'},
    )
    assert sub_res.status_code == 200

    rec_res = await client.post(
        '/api/seller/transactions',
        json={'payment_account_id': order['payment_account_id'], **claim,
              'occurred_at': payment_time.isoformat()},
        headers={'Idempotency-Key': 'conf-rec'},
    )
    assert rec_res.status_code == 201
    receipt_data = rec_res.json()

    path = f"/api/seller/orders/{order['id']}"
    confirmed_order = (await client.get(path)).json()
    assert confirmed_order['lifecycle'] == 'confirmed'
    initial_version = confirmed_order['version']
    initial_buyer_rev = confirmed_order['buyer_revision']
    initial_completed_at = confirmed_order['completed_at']
    assert initial_completed_at is not None

    # Inspect Postgres state directly before correction
    order_row_before = await connection.fetchrow(
        "SELECT version, buyer_revision, completed_at, total_minor, required_advance_minor FROM orders WHERE id = $1",
        order['id'],
    )
    assert order_row_before['version'] == initial_version
    assert order_row_before['buyer_revision'] == initial_buyer_rev

    alloc_before = await connection.fetchrow(
        "SELECT id, accepted_amount_minor FROM allocations WHERE order_id = $1",
        order['id'],
    )
    assert alloc_before is not None

    receipt_row_before = await connection.fetchrow(
        "SELECT version, reconciliation_state FROM received_transactions WHERE id = $1",
        receipt_data['id'],
    )
    assert receipt_row_before['reconciliation_state'] == 'used'

    # 2. Perform confirmed delivery correction
    correction_res = await client.patch(
        path + '/buyer-details',
        json={
            'expected_version': initial_version,
            'reason': 'Buyer changed apartment and contact',
            'buyer_name': 'Corrected Buyer',
            'contact_number': '01933333333',
            'address': {'raw_text': 'Flat 4B, Road 12, Banani, Dhaka', 'district': 'Dhaka'},
        },
        headers={'Idempotency-Key': 'postgres-delivery-corr'},
    )
    assert correction_res.status_code == 200
    corr_data = correction_res.json()
    assert corr_data['lifecycle'] == 'confirmed'
    assert corr_data['actual_cod_minor'] == confirmed_order['actual_cod_minor']
    assert corr_data['version'] == initial_version + 1
    assert corr_data['buyer_revision'] == initial_buyer_rev + 1
    assert corr_data['completed_at'] == initial_completed_at

    # 3. Direct Postgres database assertions: durable persistence and invariant checks
    order_row_after = await connection.fetchrow(
        "SELECT version, buyer_revision, completed_at, total_minor, required_advance_minor FROM orders WHERE id = $1",
        order['id'],
    )
    assert order_row_after['version'] == initial_version + 1
    assert order_row_after['buyer_revision'] == initial_buyer_rev + 1
    # completed_at must not restart or change
    assert order_row_after['completed_at'] == order_row_before['completed_at']
    assert order_row_after['total_minor'] == order_row_before['total_minor']
    assert order_row_after['required_advance_minor'] == order_row_before['required_advance_minor']

    alloc_after = await connection.fetchrow(
        "SELECT id, accepted_amount_minor FROM allocations WHERE order_id = $1",
        order['id'],
    )
    assert alloc_after['id'] == alloc_before['id']
    assert alloc_after['accepted_amount_minor'] == alloc_before['accepted_amount_minor']

    # Durable buyer revision in postgres
    revisions = await connection.fetch(
        "SELECT revision_number, buyer_name, contact_number_raw, address_raw, reason, actor, claim_accepted_at "
        "FROM buyer_revisions WHERE order_id = $1 ORDER BY revision_number ASC",
        order['id'],
    )
    assert len(revisions) == 2
    rev1, rev2 = revisions[0], revisions[1]
    assert rev2['revision_number'] == 2
    assert rev2['buyer_name'] == 'Corrected Buyer'
    assert rev2['contact_number_raw'] == '01933333333'
    assert rev2['address_raw'] == 'Flat 4B, Road 12, Banani, Dhaka'
    assert rev2['reason'] == 'Buyer changed apartment and contact'
    assert rev2['claim_accepted_at'] == rev1['claim_accepted_at']

    # Receipt in postgres remains unchanged
    receipt_row_after = await connection.fetchrow(
        "SELECT version, reconciliation_state FROM received_transactions WHERE id = $1",
        receipt_data['id'],
    )
    assert receipt_row_after['version'] == receipt_row_before['version']

    # 4. Stale version conflict: old version rejected, no partial write or extra revision
    stale_res = await client.patch(
        path + '/buyer-details',
        json={
            'expected_version': initial_version,
            'reason': 'Concurrent stale correction attempt',
            'buyer_name': 'Lost Update Name',
        },
        headers={'Idempotency-Key': 'postgres-stale-attempt'},
    )
    assert stale_res.status_code == 409
    assert stale_res.json()['error']['code'] == 'STALE_VERSION'

    rev_count = await connection.fetchval(
        "SELECT count(*) FROM buyer_revisions WHERE order_id = $1",
        order['id'],
    )
    assert rev_count == 2
