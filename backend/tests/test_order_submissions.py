"""Confirmed order actions recover through the authenticated HTTP boundary."""
import asyncio

import pytest
from httpx import AsyncClient
from order_dates_support import _setup_shop

from app.core.auth import get_seller_identity
from app.main import app
from app.services.order_service import reset_order_memory_store
from app.services.seller_service import reset_memory_store


@pytest.fixture(autouse=True)
def stores():
    reset_memory_store()
    reset_order_memory_store()
    yield
    app.dependency_overrides.pop(get_seller_identity, None)


async def test_submission_recovers_a_lost_response_without_another_order(client: AsyncClient):
    _, account = await _setup_shop(client)
    context = (await client.get('/api/seller/order-submissions')).json()
    key = context['storage_epoch'] + '.lost-response'
    path = '/api/seller/order-submissions/' + key
    assert (await client.get(path)).json()['state'] == 'not_found'
    payload = dict(product_name='শার্ট', total_minor=125050,
                   required_advance_minor=20000, payment_account_id=account)
    responses = await asyncio.gather(*[
        client.post(path, json=payload) for _ in range(3)
    ])
    assert all(response.status_code == 201 for response in responses)
    order = responses[0].json()
    assert {response.json()['id'] for response in responses} == {order['id']}
    recovered = await client.get(path)
    assert recovered.headers['cache-control'] == 'no-store, private'
    assert recovered.json() == {'state': 'succeeded', 'order': order}
    assert order['lifecycle'] == 'awaiting_buyer'
    assert len((await client.get('/api/seller/orders')).json()['items']) == 1
    conflict = await client.post(path, json={**payload, 'total_minor': 150000})
    assert conflict.status_code == 409
    assert (await client.get(path)).json()['order'] == order


async def test_submission_revalidates_accounts_and_never_exposes_another_shop(client: AsyncClient):
    _, account = await _setup_shop(client, 'first-owner')
    epoch = (await client.get('/api/seller/order-submissions')).json()['storage_epoch']
    path = '/api/seller/order-submissions/' + epoch + '.same-key'
    payload = dict(product_name='Shirt', total_minor=10000,
                   required_advance_minor=2000, payment_account_id=account)
    created = await client.post(path, json=payload)
    assert created.status_code == 201
    _, other_account = await _setup_shop(client, 'other-owner')
    assert (await client.get(path)).json()['state'] == 'not_found'
    assert (await client.post(path, json=payload)).status_code == 404
    assert (await client.get('/api/seller/orders')).json()['items'] == []
    await client.patch('/api/seller/payment-accounts/' + other_account,
                       json={'expected_version': 1, 'is_active': False})
    invalid = await client.post(path, json={**payload, 'payment_account_id': other_account})
    assert invalid.status_code == 422
    assert invalid.json()['error']['code'] == 'PAYMENT_ACCOUNT_INACTIVE'
    assert (await client.get(path)).json()['state'] == 'not_found'


async def test_standby_restart_blocks_reuse_of_a_lost_identity(client: AsyncClient, monkeypatch):
    from app.services import order_submission

    _, account = await _setup_shop(client)
    epoch = (await client.get('/api/seller/order-submissions')).json()['storage_epoch']
    path = '/api/seller/order-submissions/' + epoch + '.old-action'
    reset_order_memory_store()
    monkeypatch.setattr(order_submission, '_epoch', 'restarted-process')
    assert (await client.get(path)).status_code == 409
    response = await client.post(path, json=dict(product_name='Shirt', total_minor=10000,
        required_advance_minor=1000, payment_account_id=account))
    assert response.status_code == 409
    assert response.json()['error']['code'] == 'SUBMISSION_STORAGE_RESET'
    assert (await client.get('/api/seller/orders')).json()['items'] == []


async def test_submission_auth_and_invalid_constraints(client: AsyncClient):
    assert (await client.get('/api/seller/order-submissions')).status_code == 401
    assert (await client.get('/api/seller/order-submissions/durable.key')).status_code == 401
    _, account = await _setup_shop(client)
    epoch = (await client.get('/api/seller/order-submissions')).json()['storage_epoch']
    path = '/api/seller/order-submissions/' + epoch + '.invalid'
    response = await client.post(path, json=dict(product_name='Shirt', total_minor=10000,
        required_advance_minor=11000, payment_account_id=account))
    assert response.status_code == 422
    assert (await client.get(path)).json()['state'] == 'not_found'
