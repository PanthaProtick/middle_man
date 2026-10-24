import csv
import io

import pytest
from httpx import AsyncClient
from test_public_order_routes import _create_test_order

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.public_gate import allow_synthetic_buyer_demo, verify_public_access_gate
from app.main import app
from app.services.order_export import _memory_attempts
from app.services.order_service import reset_order_memory_store
from app.services.seller_service import reset_memory_store


@pytest.fixture(autouse=True)
def clean_export_state():
    reset_memory_store()
    reset_order_memory_store()
    _memory_attempts.clear()
    app.dependency_overrides[verify_public_access_gate] = allow_synthetic_buyer_demo
    yield
    app.dependency_overrides.pop(get_seller_identity, None)
    app.dependency_overrides.pop(verify_public_access_gate, None)


@pytest.mark.asyncio
async def test_export_is_authenticated_and_literal_route(client: AsyncClient):
    response = await client.get('/api/seller/orders/export')
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_export_scope_balances_filters_and_private_fields(client: AsyncClient):
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id='export-a')
    order = await _create_test_order(client)
    response = await client.get('/api/seller/orders/export')
    assert response.status_code == 200
    rows = list(csv.DictReader(io.StringIO(response.text)))
    assert len(rows) == 1
    assert rows[0]['order_id'] == order['id']
    assert rows[0]['total_bdt'] == f"{order['total_minor'] // 100}.{order['total_minor'] % 100:02d}"
    assert rows[0]['actual_cod_bdt'] == ''
    assert rows[0]['accepted_advance_bdt'] == ''
    assert order['portal_token'] not in response.text
    assert 'no-store' in response.headers['cache-control']
    assert (await client.get('/api/seller/orders/export?status=confirmed')).text.count('\n') == 1
    assert (await client.get('/api/seller/orders/export?status=bogus')).status_code == 422
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id='export-b')
    assert (await client.get('/api/seller/orders/export')).text.count('\n') == 1
    assert (await client.get(f"/api/seller/orders/{order['id']}/summary")).status_code == 404


async def check_buyer_csv(client, order):
    path = f"/api/seller/orders/{order['id']}"
    response = await client.post(f"/api/public/orders/{order['portal_token']}/submission", json={
        'buyer_name': '=HYPERLINK("bad"),\n@SUM(1)', 'contact_number': '01711111111',
        'address': {'raw_text': '+CMD,"quoted"\n=1+1'},
        'payment_claim': {'provider': 'bkash', 'trx_id': 'EXPORT123',
                          'sender_number': '01822222222', 'amount_minor': 200000}},
        headers={'Idempotency-Key': 'export-buyer'})
    assert response.status_code == 200, response.text
    csv_response = await client.get('/api/seller/orders/export?status=pending')
    assert csv_response.status_code == 200, csv_response.text
    row = list(csv.DictReader(io.StringIO(csv_response.text)))[0]
    assert row['buyer_name'] == '\'=HYPERLINK("bad"),\n@SUM(1)'
    assert row['address'] == '\'+CMD,"quoted"\n=1+1'
    summary = (await client.get(path + '/summary')).json()
    assert summary['buyer_name'] == '=HYPERLINK("bad"),\n@SUM(1)'
    assert summary['contact_number'] == '01711111111'
    assert summary['expected_cod_bdt'] == '10000.00'
    receipt = (await client.post('/api/seller/transactions', json={
        'payment_account_id': order['payment_account_id'], 'provider': 'bkash',
        'trx_id': 'EXPORT123', 'amount_minor': 150000}, headers={'Idempotency-Key': 'export-receipt'})).json()
    current = (await client.get(path)).json()
    confirmed = await client.post(path + '/decisions', json={
        'action': 'confirm', 'expected_version': current['version'],
        'expected_transaction_version': receipt['version'], 'transaction_id': receipt['id'],
        'accepted_amount_minor': 150000, 'reason': 'Synthetic accepted advance'},
        headers={'Idempotency-Key': 'export-confirm'})
    assert confirmed.status_code == 200, confirmed.text
    summary = (await client.get(path + '/summary')).json()
    assert summary['accepted_advance_bdt'] == '1500.00'
    assert summary['actual_cod_bdt'] == '10500.00'
    assert confirmed.json()['actual_cod_minor'] == 1050000
    assert summary['expected_cod_bdt'] == '10000.00'


@pytest.mark.asyncio
async def test_buyer_csv_and_accepted_balance(client):
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id='csv-seller')
    await check_buyer_csv(client, await _create_test_order(client))


@pytest.mark.asyncio
async def test_export_limits_and_validation(client):
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id='limit-seller')
    order = await _create_test_order(client)
    assert (await client.get('/api/seller/orders/export?limit=501')).status_code == 422
    assert (await client.get('/api/seller/orders/export?shop_id=foreign')).status_code == 422
    await client.post('/api/seller/orders', json={
        'product_name': 'Second', 'total_minor': 10000, 'required_advance_minor': 2000,
        'payment_account_id': order['payment_account_id']}, headers={'Idempotency-Key': 'second'})
    too_large = await client.get('/api/seller/orders/export?limit=1')
    assert too_large.status_code == 422
    assert too_large.json()['error']['code'] == 'EXPORT_TOO_LARGE'
    for _ in range(9):
        assert (await client.get('/api/seller/orders/export')).status_code == 200
    limited = await client.get('/api/seller/orders/export')
    assert limited.status_code == 429
    assert limited.json()['error']['code'] == 'EXPORT_RATE_LIMIT'


@pytest.mark.asyncio
@pytest.mark.parametrize('product', ['\x1b=1+1', '\u2003@SUM(1)', '-1+2', '"quoted",\n=1+1'])
async def test_csv_neutralizes_formula_prefix_after_control_or_unicode_space(client, product):
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id='formula-seller')
    order = await _create_test_order(client)
    response = await client.post('/api/seller/orders', json={
        'product_name': product, 'total_minor': 10000, 'required_advance_minor': 2000,
        'payment_account_id': order['payment_account_id']}, headers={'Idempotency-Key': 'formula-order'})
    assert response.status_code == 201
    export = await client.get('/api/seller/orders/export')
    row = list(csv.DictReader(io.StringIO(export.text)))[0]
    if product.startswith('"'):
        assert row['product'] == product
    else:
        assert row['product'].startswith("'")
