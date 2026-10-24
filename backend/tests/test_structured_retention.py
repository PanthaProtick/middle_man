"""Retention behavior at the agreed cleanup and HTTP seams."""
import datetime as dt

import pytest
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401
from test_transaction_routes import clean_stores  # noqa: F401

from app.services.structured_retention import calendar_deadline, purge_completed_orders

UTC = dt.timezone.utc


@pytest.mark.parametrize('completion,deadline', [
    (dt.datetime(2024, 2, 29, 13, tzinfo=UTC), dt.datetime(2025, 2, 28, 13, tzinfo=UTC)),
    (dt.datetime(2025, 1, 31, 13, tzinfo=UTC), dt.datetime(2026, 1, 31, 13, tzinfo=UTC)),
])
def test_calendar_anniversary(completion, deadline):
    assert calendar_deadline(completion) == deadline


@pytest.mark.usefixtures('seller_identity')
async def test_removed_record_is_unavailable_not_expired_and_retry_is_safe(client):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"
    stopped = await client.post(path + '/decisions', json={
        'action': 'cancel', 'expected_version': 1, 'reason': 'Synthetic cancellation'},
        headers={'Idempotency-Key': 'retention-cancel'})
    assert stopped.status_code == 200, stopped.text
    completed = dt.datetime.fromisoformat(stopped.json()['completed_at'])
    deadline = calendar_deadline(completed)
    assert (await purge_completed_orders(None, deadline - dt.timedelta(microseconds=1), order['shop_id'])).removed == 0
    assert (await purge_completed_orders(None, deadline, order['shop_id'])).removed == 1
    assert (await purge_completed_orders(None, deadline, order['shop_id'])).removed == 0
    for url in [path, path + '/history', f"/api/public/orders/{order['portal_token']}"]:
        response = await client.get(url)
        assert response.status_code == 410, response.text
        assert response.json()['error']['code'] == 'RECORD_UNAVAILABLE'
        assert 'Synthetic' not in response.text
    assert (await client.get('/api/seller/orders')).json()['items'] == []


@pytest.mark.usefixtures('seller_identity')
async def test_seller_can_inspect_and_retry_structured_cleanup(client):
    await _create_test_order(client)
    result = await client.get('/api/seller/retention/structured')
    assert result.status_code == 200, result.text
    assert result.json()['overdue'] == 0
    assert result.json()['standby'] is True
    result = await client.post('/api/seller/retention/structured/cleanup')
    assert result.status_code == 200, result.text
    assert result.json()['removed'] == 0


@pytest.mark.usefixtures('seller_identity')
async def test_offline_adapter_removes_payment_details_but_blocks_reuse(client):
    from test_structured_retention_postgres import confirm_case
    order, receipt = await confirm_case(client)
    deadline = dt.datetime.fromisoformat(order['completed_at']) + dt.timedelta(days=367)
    assert (await purge_completed_orders(None, deadline, order['shop_id'])).removed == 1
    assert (await client.get('/api/seller/transactions')).json()['items'] == []
    response = await client.post('/api/seller/transactions', json={
        'payment_account_id': receipt['payment_account_id'], 'provider': 'bkash',
        'trx_id': receipt['trx_id'], 'amount_minor': receipt['amount_minor']})
    assert response.status_code == 409, response.text
    assert response.json()['error']['code'] == 'PAYMENT_USED'
