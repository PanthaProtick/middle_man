"""Real PostgreSQL review persistence, correction and tenant boundary acceptance."""
import pytest
from test_courier_drafts_postgres import confirm_automatically
from test_courier_review import ready_review
from test_courier_review import test_correction_settings_and_cancellation_invalidate_review as correction_case
from test_courier_review import test_review_exception_cod_and_foreign_access as exception_case


async def test_durable_review_restart_and_stale_settings(postgres_buyer):
    from app.services.courier_drafts import _memory_drafts
    from app.services.pathao_connections import _memory

    client, connection, _, order = postgres_buyer
    await confirm_automatically(client, order, 'PG-REVIEW')
    path, review, _ = await ready_review(client, order)
    parcel = await client.patch(path.replace('courier-review', 'courier-draft'), json={
        'expected_version': review['draft']['version'], 'parcel_weight_grams': 1500, 'parcel_quantity': 2,
    }, headers={'Idempotency-Key': 'pg-review-parcel'})
    assert parcel.status_code == 200, parcel.text
    ready = (await client.get(path)).json()
    approved = await client.post(path, json={'expected_token': ready['token']})
    assert approved.status_code == 200, approved.text
    _memory.clear()
    _memory_drafts.clear()
    assert (await client.get(path)).json() == approved.json()
    settings = await client.patch('/api/seller/courier/pathao/offline', json={
        'expected_version': 1, 'default_store_id': ready['choices']['store_id'], 'default_delivery_type': 12,
    })
    assert settings.status_code == 200
    current = (await client.get(path)).json()
    assert current['reviewed'] is False
    assert current['choices']['delivery_type'] == 48  # Explicit draft override survives changed defaults.
    assert (await client.post(path, json={'expected_token': ready['token']})).status_code == 409
    assert await connection.fetchval('SELECT count(*) FROM courier_drafts WHERE order_id=$1', order['id']) == 1


async def test_postgres_correction_cancellation(postgres_buyer):
    await correction_case(postgres_buyer[0])


@pytest.mark.parametrize('amount,cod', [(150000, 1050000), (1200000, 0)])
async def test_postgres_actual_cod_and_tenant(postgres_buyer, amount, cod):
    await exception_case(postgres_buyer[0], amount, cod)


async def test_correction_during_metadata_loading_rejects_stale_review(postgres_buyer, monkeypatch):
    from app.services import pathao_connections
    client, _, _, order = postgres_buyer
    await confirm_automatically(client, order, 'PG-RACE-REVIEW')
    path, review, _ = await ready_review(client, order)
    original = pathao_connections.stores_for
    changed = False

    async def stores(shop, env, revision):
        nonlocal changed
        if not changed:
            changed = True
            response = await client.patch(path.replace('courier-review', 'courier-draft'), json={
                'expected_version': review['draft']['version'], 'parcel_quantity': 4,
            }, headers={'Idempotency-Key': 'concurrent-parcel'})
            assert response.status_code == 200, response.text
        return await original(shop, env, revision)

    monkeypatch.setattr(pathao_connections, 'stores_for', stores)
    rejected = await client.post(path, json={'expected_token': review['token']})
    assert rejected.status_code == 409, rejected.text
    current = (await client.get(path)).json()
    assert current['draft']['parcel_quantity'] == 4
    assert current['reviewed'] is False
