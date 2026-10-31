"""Snapshot authority, atomic replacement, outages and concurrent refresh leases."""
import datetime as dt
from uuid import uuid4

import pytest

from app.models.pathao_location import LocationChoice, LocationSelection
from app.services import pathao_connections as connections
from app.services import pathao_snapshot_jobs as jobs
from app.services import pathao_snapshot_store as store
from app.services import pathao_snapshot_sync as sync
from app.services.pathao_locations import resolve_choices


@pytest.fixture(autouse=True)
def isolated(monkeypatch):
    monkeypatch.setattr(store, '_snapshots', {})
    monkeypatch.setattr(jobs, '_jobs', {})
    monkeypatch.setattr(connections, '_memory', {('shop', 'offline'): [connections.Revision(1)]})


def tree(name='Old city'):
    return {('city', 0): [LocationChoice(id=1, name=name)],
            ('zone', 1): [LocationChoice(id=10, name='Zone')],
            ('area', 10): [LocationChoice(id=100, name='Area', home_delivery_available=True)]}


async def publish(data=None):
    claim = await jobs.claim(None, 'shop', 'offline', True)
    assert claim is not None
    await jobs.finish(None, 'shop', 'offline', *claim, tree() if data is None else data)
    return await store.snapshot(None, 'shop', 'offline')


async def test_atomic_replacement_checkout_window_and_isolation(monkeypatch):
    now = dt.datetime(2026, 10, 31, tzinfo=dt.timezone.utc)
    monkeypatch.setattr(jobs, 'get_utc_now', lambda: now)
    monkeypatch.setattr(store, 'get_utc_now', lambda: now)
    old = await publish()
    now += dt.timedelta(days=1)
    claim = await jobs.claim(None, 'shop', 'offline', False)
    assert claim
    assert (await store.snapshot(None, 'shop', 'offline')).id == old.id
    await jobs.finish(None, 'shop', 'offline', *claim, tree('New city'))
    current = await store.snapshot(None, 'shop', 'offline')
    assert current.id != old.id
    assert (await store.hierarchy(None, current))[0].name == 'New city'
    pinned = await store.snapshot(None, 'shop', 'offline', old.id)
    selected = LocationSelection(city_id=1, zone_id=10, area_id=100, catalog_version=old.id)
    resolved = await resolve_choices('shop', 'offline', connections.Revision(1), selected, saved=pinned)
    assert resolved.city_name == 'Old city' and resolved.condition == 'resolved'
    for shop, env in [('foreign', 'offline'), ('shop', 'sandbox')]:
        with pytest.raises(store.CatalogExpired):
            await store.snapshot(None, shop, env, old.id)
    now += dt.timedelta(hours=48)
    with pytest.raises(store.CatalogExpired):
        await store.snapshot(None, 'shop', 'offline', old.id)
    assert (await store.snapshot(None, 'shop', 'offline')).id == current.id


async def test_failed_refresh_keeps_snapshot_and_lease_prevents_duplicate_work(monkeypatch):
    old = await publish()
    now = jobs.get_utc_now() + dt.timedelta(days=2)
    monkeypatch.setattr(jobs, 'get_utc_now', lambda: now)
    calls = []
    async def failed(env, revision):
        calls.append(env)
        assert await jobs.claim(None, 'shop', 'offline', True) is None
        raise ValueError('malformed partial tree')
    monkeypatch.setattr(sync, 'crawl', failed)
    await sync.refresh(None, 'shop', 'offline')
    status = await jobs.status(None, 'shop', 'offline')
    assert status.failed and not status.refreshing and status.catalog_version == old.id
    assert calls == ['offline']
    await sync.refresh(None, 'shop', 'offline')
    assert calls == ['offline']  # Failed scheduled jobs have a bounded retry cadence.


async def test_defaults_keep_generation_reconnect_and_disconnect_revoke_authority(monkeypatch):
    saved = await publish()
    connections._memory[('shop', 'offline')].append(connections.Revision(2, store_id=1, delivery_type=48))
    assert (await store.snapshot(None, 'shop', 'offline', saved.id)).id == saved.id
    connections._memory[('shop', 'offline')].append(connections.Revision(3))
    with pytest.raises(store.CatalogExpired):
        await store.snapshot(None, 'shop', 'offline', saved.id)
    assert await store.snapshot(None, 'shop', 'offline') is None
    claim = await jobs.claim(None, 'shop', 'offline', True)
    assert claim
    connections._memory[('shop', 'offline')].append(connections.Revision(4, enabled=False))
    await jobs.finish(None, 'shop', 'offline', *claim, tree('Must not publish'))
    assert await store.snapshot(None, 'shop', 'offline') is None
    assert (await jobs.status(None, 'shop', 'offline')).catalog_version is None


async def test_incomplete_crawl_never_publishes_and_expired_lease_cannot_publish(monkeypatch):
    async def broken(env, revision, level, parent):
        if level == 'area':
            raise ValueError('Malformed area response')
        return tree()[(level, parent or 0)]
    monkeypatch.setattr(sync.catalog, 'fetch', broken)
    await sync.refresh(None, 'shop', 'offline')
    assert await store.snapshot(None, 'shop', 'offline') is None
    assert (await jobs.status(None, 'shop', 'offline')).failed
    now = jobs.get_utc_now() + dt.timedelta(hours=1)
    monkeypatch.setattr(jobs, 'get_utc_now', lambda: now)
    claim = await jobs.claim(None, 'shop', 'offline', True)
    assert claim
    now += dt.timedelta(minutes=31)
    await jobs.finish(None, 'shop', 'offline', *claim, tree())
    assert await store.snapshot(None, 'shop', 'offline') is None
    with pytest.raises(store.CatalogExpired):
        await store.snapshot(None, 'shop', 'offline', str(uuid4()))


async def test_seller_review_uses_fresh_coverage_instead_of_buyer_snapshot(monkeypatch):
    from app.services import pathao_catalog
    saved = await publish()
    selected = LocationSelection(city_id=1, zone_id=10, area_id=100)
    # Warm the live cache with old advertised coverage too.
    await pathao_catalog.choices('shop', 'offline', connections.Revision(1), 'area', 10)
    async def changed(env, revision, level, parent):
        items = tree()[(level, parent or 0)]
        return [item.model_copy(update={'home_delivery_available': False}) for item in items] if level == 'area' else items
    monkeypatch.setattr(pathao_catalog, 'fetch', changed)
    buyer = await resolve_choices('shop', 'offline', connections.Revision(1), selected, saved=saved)
    seller = await resolve_choices('shop', 'offline', connections.Revision(1), selected)
    assert buyer.condition == 'resolved'
    assert seller.condition == 'unsupported'


@pytest.mark.parametrize('changed', [False, True])
async def test_expired_submission_rechecks_connection_before_rejecting(monkeypatch, changed):
    from app.core.config import settings
    from app.models.buyer import Address
    from app.models.pathao_location import LocationResolution
    from app.services import pathao_locations

    monkeypatch.setattr(settings, 'PATHAO_LOCATION_ENVIRONMENT', 'offline')
    async def shop(*args):
        return 'shop'
    async def expired_snapshot(*args):
        if changed:
            connections._memory[('shop', 'offline')].append(connections.Revision(2, enabled=False))
        raise store.expired()
    monkeypatch.setattr(pathao_locations, 'link_shop', shop)
    monkeypatch.setattr(store, 'snapshot', expired_snapshot)
    address = Address(raw_text='Preserve written address', pathao=LocationResolution(
        city_id=1, zone_id=10, area_id=100, catalog_version=str(uuid4())))
    if not changed:
        with pytest.raises(store.CatalogExpired):
            await pathao_locations.resolve(None, 'token', address)
    else:
        resolved = await pathao_locations.resolve(None, 'token', address)
        assert resolved.raw_text == address.raw_text
        assert resolved.pathao.condition == 'unavailable'
        assert resolved.pathao.city_id is None and resolved.pathao.booking_blocked
