"""Confirmed received-payment actions recover through the HTTP boundary."""
import asyncio
import datetime

import pytest
from httpx import ASGITransport, AsyncClient
from order_dates_support import _setup_shop

from app.core.auth import SellerIdentity, get_seller_identity
from app.main import app
from app.models.buyer import BuyerSubmission
from app.services.buyer_service import BuyerService
from app.services.order_service import _memory_orders, reset_order_memory_store
from app.services.seller_service import reset_memory_store
from app.services.transaction_store import reset_transaction_memory_store

UTC = datetime.timezone.utc


@pytest.fixture(autouse=True)
def stores():
    reset_memory_store()
    reset_order_memory_store()
    reset_transaction_memory_store()
    yield
    app.dependency_overrides.pop(get_seller_identity, None)


async def _context(client: AsyncClient) -> str:
    response = await client.get('/api/seller/transaction-submissions')
    assert response.status_code == 200, response.text
    return response.json()['storage_epoch']


def _payload(account: str, trx_id: str = 'Exact-Trx-01', amount: int = 15000, **extra):
    return dict(payment_account_id=account, provider='bkash', trx_id=trx_id,
                amount_minor=amount, **extra)


async def _submit(client: AsyncClient, key: str, payload: dict):
    return await client.post('/api/seller/transaction-submissions/' + key, json=payload)


async def test_lost_response_and_concurrent_duplicates_replay_one_receipt(client: AsyncClient):
    _, account = await _setup_shop(client)
    epoch = await _context(client)
    key = epoch + '.lost-response'
    path = '/api/seller/transaction-submissions/' + key
    assert (await client.get(path)).json() == {'state': 'not_found', 'result': None}
    payload = _payload(account, '  Exact-Trx-01  ', 15000, sender_number=None, occurred_at=None)
    responses = await asyncio.gather(*[_submit(client, key, payload) for _ in range(3)])
    assert all(response.status_code == 201 for response in responses), [r.text for r in responses]
    result = responses[0].json()
    assert {r.json()['receipt']['id'] for r in responses} == {result['receipt']['id']}
    assert result['receipt']['trx_id'] == 'Exact-Trx-01'
    assert result['receipt']['observations'][0]['parse_state'] == 'incomplete'
    assert result['allocated_order_ids'] == []
    recovered = await client.get(path)
    assert recovered.headers['cache-control'] == 'no-store, private'
    assert recovered.json() == {'state': 'succeeded', 'result': result}
    listed = (await client.get('/api/seller/transactions')).json()['items']
    assert len(listed) == 1
    assert len(listed[0]['observations']) == 1
    changed = await _submit(client, key, {**payload, 'amount_minor': 16000})
    assert changed.status_code == 409
    assert changed.json()['error']['code'] == 'IDEMPOTENCY_KEY_REUSED'
    assert (await client.get(path)).json()['result'] == result


async def test_identical_and_conflicting_evidence_are_preserved(client: AsyncClient):
    _, account = await _setup_shop(client)
    epoch = await _context(client)
    original = _payload(account, 'Same-Trx-9', 20000)
    created = await _submit(client, epoch + '.first', original)
    assert created.status_code == 201
    original_receipt = created.json()['receipt']
    identical = await _submit(client, epoch + '.identical', original)
    assert identical.status_code == 200
    identical_receipt = identical.json()['receipt']
    assert identical_receipt['id'] == original_receipt['id']
    assert identical_receipt['amount_minor'] == 20000
    assert identical_receipt['has_conflict'] is False
    assert identical_receipt['observations'][-1]['conflict_state'] == 'identical'
    conflicting = await _submit(client, epoch + '.conflict', {**original, 'amount_minor': 99999})
    assert conflicting.status_code == 200
    receipt = conflicting.json()['receipt']
    assert receipt['id'] == original_receipt['id']
    assert receipt['amount_minor'] == 20000
    assert receipt['has_conflict'] is True
    assert receipt['reconciliation_state'] == 'conflicted'
    assert receipt['observations'][-1]['conflict_state'] == 'conflicting'
    assert (await client.get('/api/seller/transaction-submissions/' + epoch + '.first')).json()['result']['receipt']['has_conflict'] is True


async def test_matching_receipt_reports_actual_order_confirmation(client: AsyncClient):
    _, account = await _setup_shop(client)
    order_response = await client.post('/api/seller/orders', json=dict(
        product_name='Guided payment order', total_minor=500000,
        required_advance_minor=100000, payment_account_id=account),
        headers={'Idempotency-Key': 'guided-payment-order'})
    assert order_response.status_code == 201
    order = order_response.json()
    now = datetime.datetime.now(UTC)
    _memory_orders[order['id']]['created_at'] = now - datetime.timedelta(hours=1)
    buyer = BuyerService(clock=lambda: now + datetime.timedelta(hours=1))
    public, status = await buyer.submit_buyer_details(order['portal_token'], BuyerSubmission(
        buyer_name='Guided Buyer', contact_number='01799887766',
        address={'raw_text': 'House 1, Dhaka'},
        payment_claim={'provider': 'bkash', 'trx_id': 'Claim-Trx-77',
                       'sender_number': '01811223344', 'amount_minor': 100000},
    ), 'guided-claim')
    assert status == 200 and public.lifecycle == 'pending'
    epoch = await _context(client)
    result = await _submit(client, epoch + '.confirm', _payload(
        account, 'Claim-Trx-77', 100000, sender_number='01811223344', occurred_at=now.isoformat()))
    assert result.status_code == 201, result.text
    body = result.json()
    assert body['allocated_order_ids'] == [order['id']]
    assert body['receipt']['reconciliation_state'] == 'used'
    confirmed = await client.get('/api/seller/orders/' + order['id'])
    assert confirmed.json()['lifecycle'] == 'confirmed'
    assert confirmed.json()['actual_cod_minor'] == 400000
    lookup = await client.get('/api/seller/transaction-submissions/' + epoch + '.confirm')
    assert lookup.json()['result']['allocated_order_ids'] == [order['id']]


async def test_identical_replay_reports_an_order_confirmed_after_recording(client: AsyncClient):
    _, account = await _setup_shop(client)
    epoch = await _context(client)
    now = datetime.datetime.now(UTC)
    first = await _submit(client, epoch + '.earlier', _payload(
        account, 'Late-Claim-1', 100000, sender_number='01811223344', occurred_at=now.isoformat()))
    assert first.status_code == 201
    assert first.json()['allocated_order_ids'] == []
    order_response = await client.post('/api/seller/orders', json=dict(
        product_name='Late claim order', total_minor=500000,
        required_advance_minor=100000, payment_account_id=account),
        headers={'Idempotency-Key': 'late-claim-order'})
    assert order_response.status_code == 201
    order = order_response.json()
    _memory_orders[order['id']]['created_at'] = now - datetime.timedelta(hours=1)
    buyer = BuyerService(clock=lambda: now + datetime.timedelta(hours=1))
    public, status = await buyer.submit_buyer_details(order['portal_token'], BuyerSubmission(
        buyer_name='Late Buyer', contact_number='01799887766',
        address={'raw_text': 'House 2, Dhaka'},
        payment_claim={'provider': 'bkash', 'trx_id': 'Late-Claim-1',
                       'sender_number': '01811223344', 'amount_minor': 100000},
    ), 'late-claim')
    assert status == 200 and public.lifecycle in ('pending', 'confirmed')
    replay = await _submit(client, epoch + '.replay', _payload(
        account, 'Late-Claim-1', 100000, sender_number='01811223344', occurred_at=now.isoformat()))
    assert replay.status_code == 200, replay.text
    body = replay.json()
    assert body['receipt']['observations'][-1]['conflict_state'] == 'identical'
    assert body['receipt']['reconciliation_state'] == 'used'
    assert body['allocated_order_ids'] == [order['id']]


async def test_unmatched_evidence_does_not_invent_confirmation(client: AsyncClient):
    _, account = await _setup_shop(client)
    epoch = await _context(client)
    result = await _submit(client, epoch + '.unmatched', _payload(account, 'No-Claim-1', 7000))
    assert result.status_code == 201
    assert result.json()['allocated_order_ids'] == []
    assert result.json()['receipt']['reconciliation_state'] == 'unmatched'


async def test_authorization_shop_isolation_and_stale_account(client: AsyncClient):
    anonymous = AsyncClient(transport=ASGITransport(app=app), base_url='http://test')
    async with anonymous:
        assert (await anonymous.get('/api/seller/transaction-submissions')).status_code == 401
        assert (await anonymous.post('/api/seller/transaction-submissions/x.post',
                                     json=_payload('account'))).status_code == 401

    _, account = await _setup_shop(client, 'first-owner')
    epoch = await _context(client)
    assert (await _submit(client, epoch + '.ok', _payload(account))).status_code == 201
    _, foreign_account = await _setup_shop(client, 'other-owner')
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity('first-owner')
    foreign = await _submit(client, epoch + '.foreign', _payload(foreign_account))
    assert foreign.status_code == 404
    assert (await client.get('/api/seller/transaction-submissions/' + epoch + '.ok')).json()['state'] == 'succeeded'
    assert (await client.get('/api/seller/transaction-submissions/' + epoch + '.ok')).json()['result']['receipt']['shop_id'] == _memory_shop_id('first-owner')

    deactivate = await client.patch('/api/seller/payment-accounts/' + account,
                                    json={'expected_version': 1, 'is_active': False})
    assert deactivate.status_code == 200
    stale = await _submit(client, epoch + '.stale', _payload(account, 'Stale-Trx-1'))
    assert stale.status_code == 422
    assert stale.json()['error']['code'] == 'PAYMENT_ACCOUNT_INACTIVE'
    assert (await client.get('/api/seller/transaction-submissions/' + epoch + '.stale')).json()['state'] == 'not_found'


def _memory_shop_id(owner: str) -> str:
    from app.services.seller_service import _memory_shops_by_owner
    return _memory_shops_by_owner[owner]


async def test_standby_restart_and_validation(client: AsyncClient, monkeypatch):
    from app.services import order_submission
    _, account = await _setup_shop(client)
    epoch = await _context(client)
    monkeypatch.setattr(order_submission, '_epoch', 'restarted-process')
    old = await _submit(client, epoch + '.old', _payload(account))
    assert old.status_code == 409
    assert old.json()['error']['code'] == 'SUBMISSION_STORAGE_RESET'
    fresh = await _context(client)
    assert (await _submit(client, fresh + '.blank', _payload(account, '   '))).status_code == 422
    assert (await _submit(client, fresh + '.zero', _payload(account, 'Zero', 0))).status_code == 422
    assert (await _submit(client, fresh + '.sender', _payload(account, 'Bad-Phone', sender_number='123'))).status_code == 422
