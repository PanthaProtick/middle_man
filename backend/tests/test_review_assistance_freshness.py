import datetime
from copy import deepcopy

import pytest
from httpx import AsyncClient
from test_public_order_routes import _create_test_order
from test_review_assistance_api import _submit_buyer_claim, clean_stores, seller_identity  # noqa: F401

from app.core.auth import SellerIdentity, get_seller_identity
from app.main import app
from app.services.buyer_service import _memory_buyer_revisions
from app.services.order_service import _memory_orders
from app.services.reconciliation_store import _memory_order_review_reasons
from app.services.transaction_store import _memory_transactions

pytestmark = pytest.mark.usefixtures('seller_identity')


async def request_advice(client, order, **payload):
    return await client.post(f"/api/seller/orders/{order['id']}/review-assistance", json=payload)


async def receipt(client, order):
    result = await client.post('/api/seller/transactions', json={
        'payment_account_id': order['payment_account_id'], 'provider': 'bkash',
        'trx_id': 'TX12345', 'amount_minor': 200000,
    }, headers={'Idempotency-Key': 'assistance-receipt'})
    assert result.status_code == 201
    return result.json()


@pytest.mark.asyncio
async def test_real_foreign_order_and_receipt_are_private(client: AsyncClient):
    order = await _create_test_order(client)
    await _submit_buyer_claim(client, order['portal_token'])
    tx = await receipt(client, order)
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id='other-owner')
    foreign_order = await _create_test_order(client)
    await _submit_buyer_claim(client, foreign_order['portal_token'])
    result = await request_advice(client, order)
    assert result.status_code == 404
    result = await request_advice(client, foreign_order, receipt_id=tx['id'])
    assert result.status_code == 404
    # A foreign shop's exact identity must never count as a local matching receipt.
    result = await request_advice(client, foreign_order)
    assert result.json()['condition'] == 'NO_RECORDED_RECEIPT'


@pytest.mark.asyncio
async def test_revalidation_tracks_receipts_reasons_and_locale_without_mutation(client):
    order = await _create_test_order(client)
    await _submit_buyer_claim(client, order['portal_token'])
    first = (await request_advice(client, order)).json()
    again = (await request_advice(client, order, language='bn')).json()
    assert first['context_token'] == again['context_token']
    tx = await receipt(client, order)
    _memory_transactions[tx['id']].update(
        sender_number_canonical='01711111111',
        occurred_at=_memory_orders[order['id']]['created_at'],
    )
    _memory_order_review_reasons[order['id']] = []
    before = deepcopy((_memory_orders, _memory_buyer_revisions, _memory_transactions))
    matched = (await request_advice(client, order)).json()
    assert matched['condition'] == 'UNKNOWN_CAUSE'
    assert matched['context_token'] != first['context_token']
    assert before == (_memory_orders, _memory_buyer_revisions, _memory_transactions)
    _memory_transactions[tx['id']]['version'] += 1
    corrected = (await request_advice(client, order)).json()
    assert corrected['context_token'] != matched['context_token']
    _memory_order_review_reasons[order['id']] = ['FUTURE_REASON']
    unsupported = (await request_advice(client, order)).json()
    assert unsupported['condition'] == 'UNSUPPORTED_REASON_CODE'
    assert unsupported['context_token'] != corrected['context_token']
    assert unsupported['facts'] == {'has_matching_receipt': True}
    _memory_orders[order['id']]['lifecycle'] = 'confirmed'
    assert (await request_advice(client, order)).status_code == 409


@pytest.mark.asyncio
async def test_selected_receipt_retention_and_version_are_respected(client):
    order = await _create_test_order(client)
    await _submit_buyer_claim(client, order['portal_token'])
    tx = await receipt(client, order)
    first = (await request_advice(client, order, receipt_id=tx['id'])).json()
    _memory_transactions[tx['id']]['version'] += 1
    second = (await request_advice(client, order, receipt_id=tx['id'])).json()
    assert second['context_token'] != first['context_token']
    _memory_transactions[tx['id']]['retained_at'] = datetime.datetime.now(datetime.timezone.utc)
    assert (await request_advice(client, order, receipt_id=tx['id'])).status_code == 410


@pytest.mark.asyncio
async def test_missing_current_revision_stays_unknown_instead_of_inventing_missing_receipt(client):
    order = await _create_test_order(client)
    await _submit_buyer_claim(client, order['portal_token'])
    # Older retained revisions must not be silently used in place of the current revision.
    _memory_orders[order['id']]['buyer_revision'] = 99
    result = await request_advice(client, order)
    assert result.json()['condition'] == 'UNKNOWN_CAUSE'


@pytest.mark.asyncio
@pytest.mark.parametrize('payload', [{'shop_id': 'forged'}, {'allowed_actions': ['approve']}, {'language': 'fr'}])
async def test_untrusted_context_and_language_are_rejected(client, payload):
    order = await _create_test_order(client)
    await _submit_buyer_claim(client, order['portal_token'])
    assert (await request_advice(client, order, **payload)).status_code == 422
