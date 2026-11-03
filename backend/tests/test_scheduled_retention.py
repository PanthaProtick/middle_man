"""Scheduler authorization through the public HTTP boundary."""
import pytest

from app.core.config import settings

PATH = '/api/maintenance/retention'


@pytest.mark.parametrize('authorization', ['', 'Bearer wrong', 'Basic scheduler'])
async def test_scheduler_rejects_invalid_authorization(client, monkeypatch, authorization):
    monkeypatch.setattr(settings, 'CRON_SECRET', 'synthetic-scheduler-secret', raising=False)
    response = await client.get(PATH, headers={'Authorization': authorization})
    assert response.status_code == 401
    assert response.headers['cache-control'] == 'no-store'


async def test_scheduler_fails_closed_without_secret_or_database(client, monkeypatch):
    monkeypatch.setattr(settings, 'CRON_SECRET', '', raising=False)
    assert (await client.get(PATH)).status_code == 503
    monkeypatch.setattr(settings, 'CRON_SECRET', 'synthetic-scheduler-secret')
    response = await client.get(PATH, headers={'Authorization': 'Bearer synthetic-scheduler-secret'})
    assert response.status_code == 503
    assert response.json()['status'] == 'failed'
    assert 'standby' not in response.text


async def test_scheduler_credential_does_not_grant_seller_access(client, monkeypatch):
    monkeypatch.setattr(settings, 'CRON_SECRET', 'synthetic-scheduler-secret', raising=False)
    response = await client.get('/api/seller/orders', headers={
        'Authorization': 'Bearer synthetic-scheduler-secret'})
    assert response.status_code == 401
