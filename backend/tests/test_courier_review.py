"""Review is a version-bound local decision, never a provider submission."""
import pytest
from test_courier_drafts import confirm_automatically, parcel_order
from test_public_order_routes import clean_memory_stores, seller_identity  # noqa: F401
from test_transaction_routes import clean_stores  # noqa: F401


@pytest.fixture(autouse=True)
def offline_settings(monkeypatch):
    from app.core.config import settings
    from app.services.pathao_connections import _memory
    monkeypatch.setattr(settings, 'SELF_TEST_MODE', False)
    monkeypatch.setattr(settings, 'PATHAO_LOCATION_ENVIRONMENT', 'offline')
    _memory.clear()
    yield
    _memory.clear()


@pytest.mark.usefixtures('seller_identity')
async def test_complete_review_and_invalidate_after_parcel_change(client):
    order = await parcel_order(client, 'review-order', parcel_weight_grams=1500, parcel_quantity=2)
    await confirm_automatically(client, order, 'REVIEW-ONE')
    path = f"/api/seller/orders/{order['id']}/courier-review"
    initial = await client.get(path)
    assert initial.status_code == 200, initial.text
    assert 'COURIER_CONNECTION_REQUIRED' in initial.json()['blockers']
    assert initial.json()['reviewed'] is False
    assert (await client.put('/api/seller/courier/pathao/offline', json={'expected_version': 0})).status_code == 200
    current = (await client.get(path)).json()
    selected = await client.put(path, json={
        'expected_token': current['token'], 'environment': 'offline',
        'store_id': current['stores'][0]['id'], 'delivery_type': 48,
        'location': {'city_id': 1, 'zone_id': 10, 'area_id': 100},
    })
    assert selected.status_code == 200, selected.text
    ready = selected.json()
    assert ready['blockers'] == []
    assert ready['draft']['remaining_cod_minor'] == 1000000
    approved = await client.post(path, json={'expected_token': ready['token']})
    assert approved.status_code == 200, approved.text
    assert approved.json()['reviewed'] is True
    assert approved.json()['submission_enabled'] is True
    assert (await client.post(path, json={'expected_token': ready['token']})).json() == approved.json()
    assert (await client.patch(path.replace('courier-review', 'courier-draft'), json={
        'expected_version': ready['draft']['version'], 'parcel_quantity': 3,
    }, headers={'Idempotency-Key': 'change-reviewed-parcel'})).status_code == 200
    assert (await client.get(path)).json()['reviewed'] is False
    assert (await client.post(path, json={'expected_token': ready['token']})).status_code == 409


async def ready_review(client, order):
    path = f"/api/seller/orders/{order['id']}/courier-review"
    assert (await client.put('/api/seller/courier/pathao/offline', json={'expected_version': 0})).status_code == 200
    current = (await client.get(path)).json()
    payload = {'expected_token': current['token'], 'environment': 'offline',
               'store_id': current['stores'][0]['id'], 'delivery_type': 48,
               'location': {'city_id': 1, 'zone_id': 10, 'area_id': 100}}
    result = await client.put(path, json=payload)
    assert result.status_code == 200, result.text
    return path, result.json(), payload


@pytest.mark.usefixtures('seller_identity')
async def test_correction_settings_and_cancellation_invalidate_review(client):
    order = await parcel_order(client, 'correction-review', parcel_weight_grams=800, parcel_quantity=1)
    await confirm_automatically(client, order, 'REVIEW-CORRECT')
    path, ready, _ = await ready_review(client, order)
    assert (await client.post(path, json={'expected_token': ready['token']})).status_code == 200
    current_order = (await client.get(path.replace('/courier-review', ''))).json()
    corrected = await client.patch(path.replace('courier-review', 'buyer-details'), json={
        'expected_version': current_order['version'], 'reason': 'New destination',
        'buyer_name': 'Corrected buyer', 'contact_number': '01933333333',
        'address': {'raw_text': 'New destination address'},
    }, headers={'Idempotency-Key': 'review-correct'})
    assert corrected.status_code == 200, corrected.text
    refreshed = (await client.get(path)).json()
    assert refreshed['draft']['recipient_name'] == 'Corrected buyer'
    assert refreshed['draft']['remaining_cod_minor'] == 1000000
    assert refreshed['choices']['location']['area_id'] is None
    assert refreshed['reviewed'] is False
    assert (await client.post(path, json={'expected_token': ready['token']})).status_code == 409
    settings = await client.patch('/api/seller/courier/pathao/offline', json={
        'expected_version': 1, 'default_store_id': ready['choices']['store_id'], 'default_delivery_type': 12,
    })
    assert settings.status_code == 200, settings.text
    assert (await client.post(path, json={'expected_token': refreshed['token']})).status_code == 409
    cancelled = await client.post(path.replace('courier-review', 'decisions'), json={
        'action': 'cancel', 'expected_version': corrected.json()['version'], 'reason': 'Stop dispatch',
    }, headers={'Idempotency-Key': 'review-cancel'})
    assert cancelled.status_code == 200, cancelled.text
    stopped = (await client.get(path)).json()
    assert 'ORDER_NOT_CONFIRMED' in stopped['blockers']
    assert (await client.post(path, json={'expected_token': stopped['token']})).status_code == 409


@pytest.mark.usefixtures('seller_identity')
@pytest.mark.parametrize('changes,blocker', [
    ({'store_id': 999999999}, 'PICKUP_STORE_REQUIRED'),
    ({'location': {'city_id': 1, 'zone_id': 10, 'area_id': 101}}, 'LOCATION_METADATA_REQUIRED'),
    ({'location': {'city_id': 2, 'zone_id': 10, 'area_id': 100}}, 'LOCATION_METADATA_REQUIRED'),
    ({'environment': 'sandbox'}, 'COURIER_CONNECTION_REQUIRED'),
])
async def test_unready_choices_cannot_be_approved(client, changes, blocker):
    order = await parcel_order(client, 'unready', parcel_weight_grams=800, parcel_quantity=1)
    await confirm_automatically(client, order, 'REVIEW-INVALID')
    path, ready, payload = await ready_review(client, order)
    response = await client.put(path, json={**payload, 'expected_token': ready['token'], **changes})
    assert response.status_code == 200, response.text
    blocked = response.json()
    assert blocker in blocked['blockers']
    if changes.get('location', {}).get('city_id') == 2:
        assert 'LOCATION_CHOICES_INVALID' in blocked['blockers']
        assert 'METADATA_UNAVAILABLE' not in blocked['blockers']
    assert (await client.post(path, json={'expected_token': blocked['token']})).status_code == 409
    for injection in ({'remaining_cod_minor': 1}, {'delivery_type': 99}, {'parcel_quantity': 0}):
        assert (await client.put(path, json={**payload, **injection})).status_code == 422


@pytest.mark.usefixtures('seller_identity')
@pytest.mark.parametrize('amount,cod', [(150000, 1050000), (1200000, 0)])
async def test_review_exception_cod_and_foreign_access(client, amount, cod):
    from test_payment_exceptions import exception_case
    from test_payment_exceptions_postgres import decision

    from app.core.auth import SellerIdentity, get_seller_identity
    from app.main import app
    order, receipt = await exception_case(client, amount)
    assert (await decision(client, order, receipt)).status_code == 200
    path = f"/api/seller/orders/{order['id']}/courier-review"
    review = (await client.get(path)).json()
    assert review['draft']['remaining_cod_minor'] == cod
    original = app.dependency_overrides[get_seller_identity]
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity('foreign-review')
    await client.post('/api/seller/shop', json={'display_name': 'Other'})
    assert (await client.get(path)).status_code == 404
    assert (await client.post(path, json={'expected_token': review['token']})).status_code == 404
    app.dependency_overrides[get_seller_identity] = original


@pytest.mark.usefixtures('seller_identity')
async def test_seller_catalog_hierarchy_revision_and_authority(client):
    from datetime import datetime

    from app.core.auth import SellerIdentity, get_seller_identity
    from app.main import app
    from app.services.structured_retention import calendar_deadline, purge_completed_orders

    order = await parcel_order(client, 'catalog-review')
    await confirm_automatically(client, order, 'REVIEW-CATALOG')
    path, _, _ = await ready_review(client, order)
    catalog = path + '/locations?environment=offline&expected_version=1'
    response = await client.get(catalog)
    assert response.status_code == 200, response.text
    assert response.json()['choices'][0]['id'] == 1
    assert 'no-store' in response.headers['cache-control']
    zones = await client.get(catalog + '&city_id=1')
    assert [item['id'] for item in zones.json()['choices']] == [10, 11]
    areas = await client.get(catalog + '&city_id=1&zone_id=10')
    assert [item['id'] for item in areas.json()['choices']] == [100, 101]
    assert (await client.get(catalog + '&city_id=2&zone_id=10')).status_code == 422
    assert (await client.get(catalog.replace('expected_version=1', 'expected_version=2'))).status_code == 409
    original = app.dependency_overrides[get_seller_identity]
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity('foreign-catalog')
    await client.post('/api/seller/shop', json={'display_name': 'Other'})
    assert (await client.get(catalog)).status_code == 404
    app.dependency_overrides[get_seller_identity] = original
    current = (await client.get(path.replace('/courier-review', ''))).json()
    deadline = calendar_deadline(datetime.fromisoformat(current['completed_at']))
    assert (await purge_completed_orders(None, deadline, order['shop_id'])).removed >= 1
    assert (await client.get(path)).status_code == 410
    assert (await client.get(catalog)).status_code == 410
