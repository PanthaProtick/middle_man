"""Buyer coverage problems must survive confirmation and courier review."""
import pytest
from test_courier_drafts import parcel_order
from test_pathao_location_requirements import connect, history_item, locations, payload  # noqa: F401
from test_public_order_routes import clean_memory_stores, seller_identity  # noqa: F401
from transaction_route_support import clean_stores  # noqa: F401


@pytest.mark.usefixtures('seller_identity')
@pytest.mark.parametrize('area,unsupported', [(100, True), (101, False)])
async def test_buyer_coverage_problem_requires_explicit_seller_resolution(client, area, unsupported):
    order = await parcel_order(client, 'coverage-review', parcel_weight_grams=800, parcel_quantity=1)
    await connect(client)
    stores = await client.get('/api/seller/courier/pathao/offline/stores?expected_version=1')
    assert stores.status_code == 200, stores.text
    defaults = await client.patch('/api/seller/courier/pathao/offline', json={
        'expected_version': 1, 'default_store_id': stores.json()['stores'][0]['id'], 'default_delivery_type': 48,
    })
    assert defaults.status_code == 200, defaults.text
    sent = payload({'city_id': 1, 'zone_id': 10, 'area_id': area, 'unsupported': unsupported})
    sent['payment_claim'] = {**sent['payment_claim'], 'amount_minor': 200000}
    receipt = await client.post('/api/seller/transactions', json={
        'payment_account_id': order['payment_account_id'], **sent['payment_claim'],
        'occurred_at': order['created_at'],
    }, headers={'Idempotency-Key': 'coverage-receipt'})
    assert receipt.status_code == 201, receipt.text
    submission = await client.post(f"/api/public/orders/{order['portal_token']}/submission", json=sent,
                                   headers={'Idempotency-Key': 'coverage-claim'})
    assert submission.status_code == 200, submission.text
    assert (await client.get(f"/api/seller/orders/{order['id']}")).json()['lifecycle'] == 'confirmed'
    location = (await history_item(client, order)).json()['items'][0]['address']['pathao']
    assert location['condition'] == 'unsupported'
    assert location['unsupported'] is unsupported

    path = f"/api/seller/orders/{order['id']}/courier-review"
    response = await client.get(path)
    assert response.status_code == 200, response.text
    blocked = response.json()
    assert blocked['location']['condition'] == 'unsupported'
    assert 'LOCATION_METADATA_REQUIRED' in blocked['blockers']
    assert blocked['submission_enabled'] is False
    assert (await client.post(path, json={'expected_token': blocked['token']})).status_code == 409

    resolved = await client.put(path, json={
        **blocked['choices'], 'expected_token': blocked['token'],
        'store_id': blocked['stores'][0]['id'],
        'location': {'city_id': 1, 'zone_id': 10, 'area_id': 100},
    })
    assert resolved.status_code == 200, resolved.text
    ready = resolved.json()
    assert ready['blockers'] == []
    approved = await client.post(path, json={'expected_token': ready['token']})
    assert approved.status_code == 200, approved.text
    assert approved.json()['submission_enabled'] is True
