"""Selected receipt advice follows the authorized acceptance preview."""
from copy import deepcopy
from datetime import datetime

import pytest
from review_assistance_support import create_order, make_receipt_complete, record_receipt, submit_claim
from test_public_order_routes import _create_test_order
from test_review_assistance_api import clean_stores, seller_identity  # noqa: F401

from app.core.auth import SellerIdentity, get_seller_identity
from app.main import app
from app.services.buyer_service import _memory_buyer_revisions
from app.services.order_service import _memory_orders
from app.services.payment_marker_protection import _memory_keys
from app.services.reconciliation_store import _memory_allocations, _memory_order_review_reasons
from app.services.transaction_store import _memory_transactions

pytestmark = [pytest.mark.asyncio, pytest.mark.usefixtures("seller_identity")]


async def test_selected_receipt_uses_preview_not_automatic_match(client):
    order = await _create_test_order(client)
    await submit_claim(client, order)
    matching = await record_receipt(client, key="matching", order=order)
    selected = await record_receipt(client, key="selected", order=order,
                                    trx_id="PRIVATEOTHER", amount_minor=1_300_000)
    make_receipt_complete(order['id'], matching['id'])
    make_receipt_complete(order['id'], selected['id'])
    before = deepcopy((_memory_orders, _memory_transactions))
    preview = (await client.get(
        f"/api/seller/orders/{order['id']}/payment-preview",
        params={"transaction_id": selected['id']},
    )).json()
    response = await client.post(f"/api/seller/orders/{order['id']}/review-assistance",
                                 json={"receipt_id": selected['id']})
    assert response.status_code == 200
    data = response.json()
    assert data['preview_conditions'] == sorted(set(preview['exceptions'] + preview['blockers']))
    assert data['preview_blockers'] == preview['blockers']
    assert 'TRANSACTION_ID_MISMATCH' in data['preview_blockers']
    assert 'PAYMENT_EXCEEDS_TOTAL' in data['preview_blockers']
    assert data['selected_receipt_id'] == selected['id']
    assert data['facts']['received_amount_minor'] == 1_300_000
    assert data['facts']['transaction_id_comparison'] == 'different'
    assert data['facts']['total_minor'] == 1_200_000
    assert 'Cannot accept' in data['explanation']
    assert 'PRIVATEOTHER' not in str(data['context'])
    assert selected['id'] not in str(data['context'])
    assert before == (_memory_orders, _memory_transactions)
    assert not {'PAYMENT_EXCEEDS_TOTAL', 'TRANSACTION_ID_MISMATCH'} & set(data['reason_codes'])


async def test_provider_exception_is_minimized_and_does_not_accept(client):
    order = await _create_test_order(client)
    await submit_claim(client, order)
    account = await client.post('/api/seller/payment-accounts', json={
        'provider': 'nagad', 'receiving_number': '01812345678', 'label': 'Private account',
    }, headers={'Idempotency-Key': 'nagad-account'})
    assert account.status_code == 201
    response = await client.post('/api/seller/transactions', json={
        'provider': 'nagad', 'payment_account_id': account.json()['id'],
        'trx_id': 'TX12345', 'amount_minor': 150_000,
    }, headers={'Idempotency-Key': 'nagad-receipt'})
    assert response.status_code == 201
    receipt = response.json()
    # Even an uninitialized protection binding must remain untouched by advice.
    _memory_keys.clear()
    before = deepcopy((_memory_orders, _memory_transactions, _memory_buyer_revisions,
                       _memory_allocations, _memory_order_review_reasons, _memory_keys))
    result = await client.post(f"/api/seller/orders/{order['id']}/review-assistance",
                              json={'receipt_id': receipt['id'], 'language': 'bn'})
    assert result.status_code == 200
    data = result.json()
    assert 'PROVIDER_MISMATCH' in data['preview_conditions']
    assert 'PROVIDER_MISMATCH' not in data['reason_codes']
    assert data['facts']['provider_comparison'] == 'different'
    assert data['facts']['transaction_id_comparison'] == 'same'
    assert data['facts']['received_amount_minor'] == 150_000
    assert 'সেবাদাতা' in data['explanation']
    for private in ('TX12345', '01812345678', 'Private account', account.json()['id'], receipt['id']):
        assert private not in str(data['context'])
    assert before == (_memory_orders, _memory_transactions, _memory_buyer_revisions,
                      _memory_allocations, _memory_order_review_reasons, _memory_keys)


async def test_selected_preview_retains_competing_and_resolution_blockers(client):
    order = await _create_test_order(client)
    other = await create_order(client, order['payment_account_id'], key='other-order')
    await submit_claim(client, order)
    await submit_claim(client, other)
    receipt = await record_receipt(client, order=order, key='base', sender='01799999999',
                                   occurred_at=datetime.fromisoformat(order['created_at']))
    await record_receipt(client, order=order, key='conflict', amount_minor=150_000)
    path = f"/api/seller/orders/{order['id']}/review-assistance"
    first = (await client.post(path, json={'receipt_id': receipt['id']})).json()
    assert {'COMPETING_CLAIMS', 'CONFLICTING_RECEIPTS'} <= set(first['preview_blockers'])
    comparison = (await client.get(f"/api/seller/transactions/{receipt['id']}")).json()
    resolved = await client.post(f"/api/seller/transactions/{receipt['id']}/resolve", json={
        'expected_version': comparison['receipt']['version'], 'reason': 'Select original evidence',
        'selected_observation_id': comparison['receipt']['observations'][0]['id'],
        'selected_order_id': other['id'],
    }, headers={'Idempotency-Key': 'selected-resolution'})
    assert resolved.status_code == 200, resolved.text
    second = (await client.post(path, json={'receipt_id': receipt['id']})).json()
    assert second['context_token'] != first['context_token']
    assert 'COMPETING_CLAIMS' in second['preview_blockers']
    assert second['facts']['claim_held_by_prior_resolution'] is True
    _memory_orders[order['id']]['version'] += 1
    third = (await client.post(path, json={'receipt_id': receipt['id']})).json()
    assert third['context_token'] != second['context_token']
    assert third['order_version'] == second['order_version'] + 1


async def test_selection_requires_independent_ownership_and_rejects_missing(client):
    order = await _create_test_order(client)
    await submit_claim(client, order)
    receipt = await record_receipt(client, order=order, key='own')
    path = f"/api/seller/orders/{order['id']}/review-assistance"
    assert (await client.post(path, json={'receipt_id': 'missing'})).status_code == 404
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id='other-owner')
    foreign = await _create_test_order(client)
    await submit_claim(client, foreign)
    assert (await client.post(path, json={'receipt_id': receipt['id']})).status_code == 404
    foreign_path = f"/api/seller/orders/{foreign['id']}/review-assistance"
    assert (await client.post(foreign_path, json={'receipt_id': receipt['id']})).status_code == 404
