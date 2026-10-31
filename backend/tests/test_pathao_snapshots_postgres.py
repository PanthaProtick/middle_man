"""Real migration, restart, lease and atomic snapshot publication on loopback PostgreSQL."""
import datetime as dt

from sqlalchemy import text

from app.services import pathao_connections as connections
from app.services import pathao_snapshot_jobs as jobs
from app.services import pathao_snapshot_store as store
from app.services.pathao_snapshot_sync import refresh


async def test_persisted_catalog_is_retained_but_never_gates_buyer_choices(postgres_buyer, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, 'PATHAO_LOCATION_ENVIRONMENT', 'offline')
    client, sql, sessions, order = postgres_buyer
    result = await client.put('/api/seller/courier/pathao/offline', json={'expected_version': 0})
    assert result.status_code == 200, result.text
    path = f"/api/public/orders/{order['portal_token']}/pathao-locations"
    first = await client.get(path)
    assert first.status_code == 200 and len(first.json()['choices']) == 2
    assert first.json()['catalog_version'] is None
    assert (await client.post('/api/seller/courier/pathao/offline/catalog/refresh')).status_code == 202
    saved = (await client.get('/api/seller/courier/pathao/offline/catalog')).json()['catalog_version']
    assert saved
    store._snapshots.clear()
    jobs._jobs.clear()
    connections._memory.clear()
    async def forbidden(*args, **kwargs):
        raise AssertionError('Buyer reads must never contact Pathao')
    monkeypatch.setattr('app.services.pathao_catalog.fetch', forbidden)
    second = await client.get(path, params={'catalog_version': saved, 'city_id': 1})
    assert second.status_code == 200 and second.json()['choices'][0]['id'] == 10
    assert second.json()['catalog_version'] is None
    disconnected = await client.delete('/api/seller/courier/pathao/offline?expected_version=1')
    assert disconnected.status_code == 200 and disconnected.json()['status'] == 'disconnected'
    assert (await client.get(path)).json()['condition'] == 'disconnected'
    # Historical snapshot rows remain stored even though they no longer gate buyer authority.
    assert await sql.fetchval('SELECT count(*) FROM pathao_catalog_snapshots WHERE id=$1', saved) == 1


async def test_database_leases_atomic_failure_and_replaced_version_expiry(postgres_buyer, monkeypatch):
    client, sql, sessions, order = postgres_buyer
    await client.put('/api/seller/courier/pathao/offline', json={'expected_version': 0})
    shop = await sql.fetchval('SELECT shop_id FROM orders WHERE id=$1', order['id'])
    now = jobs.get_utc_now() + dt.timedelta(days=1)
    monkeypatch.setattr(jobs, 'get_utc_now', lambda: now)
    monkeypatch.setattr(store, 'get_utc_now', lambda: now)
    async with sessions() as one, sessions() as two:
        old = await store.snapshot(one, shop, 'offline')
        claim = await jobs.claim(one, shop, 'offline', False)
        assert claim is not None
        assert await jobs.claim(two, shop, 'offline', True) is None
        # A failed refresh publishes nothing and retains the old complete tree.
        await jobs.finish(one, shop, 'offline', *claim, None)
        assert (await store.snapshot(two, shop, 'offline')).id == old.id
        assert (await jobs.status(two, shop, 'offline')).failed
        now += dt.timedelta(hours=1)
        await refresh(one, shop, 'offline')
        current = await store.snapshot(two, shop, 'offline')
        assert current.id != old.id
        assert (await store.snapshot(two, shop, 'offline', old.id)).id == old.id
        now += dt.timedelta(hours=48)
        try:
            await store.snapshot(two, shop, 'offline', old.id)
            raise AssertionError('Retired catalogue remained usable beyond checkout window')
        except store.CatalogExpired:
            pass
        # Even if publication fails after retiring the old version, rollback
        # restores its authority. No partial catalogue becomes visible.
        claim = await jobs.claim(one, shop, 'offline', True)
        assert claim is not None
        original = one.flush
        async def fail_flush(*args, **kwargs):
            raise ValueError('Synthetic persistence failure')
        monkeypatch.setattr(one, 'flush', fail_flush)
        try:
            await jobs.finish(one, shop, 'offline', *claim, {('city', 0): []})
        except ValueError:
            await one.rollback()
        monkeypatch.setattr(one, 'flush', original)
        assert (await store.snapshot(two, shop, 'offline')).id == current.id
        assert (await two.execute(text('SELECT count(*) FROM pathao_catalog_lists'))).scalar() > 0


async def test_scheduled_sweep_refreshes_due_catalogues_only(postgres_buyer, monkeypatch):
    from app.core import database
    from app.services import pathao_snapshot_sync
    client, sql, sessions, order = postgres_buyer
    await client.put('/api/seller/courier/pathao/offline', json={'expected_version': 0})
    shop = await sql.fetchval('SELECT shop_id FROM orders WHERE id=$1', order['id'])
    async with sessions() as db:
        old = await store.snapshot(db, shop, 'offline')
    now = jobs.get_utc_now() + dt.timedelta(days=2)
    monkeypatch.setattr(jobs, 'get_utc_now', lambda: now)
    monkeypatch.setattr(store, 'get_utc_now', lambda: now)
    monkeypatch.setattr(database, 'AsyncSessionLocal', sessions)
    await pathao_snapshot_sync.run_due()
    async with sessions() as db:
        current = await store.snapshot(db, shop, 'offline')
    assert current.id != old.id
    assert await sql.fetchval('SELECT count(*) FROM pathao_catalog_snapshots') == 2
    await pathao_snapshot_sync.run_due()
    assert await sql.fetchval('SELECT count(*) FROM pathao_catalog_snapshots') == 2
