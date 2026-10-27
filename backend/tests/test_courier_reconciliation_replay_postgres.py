"""Real commits, rollback, and same-key contention across independent sessions."""
import asyncio

import pytest
from courier_reconciliation_support import reconcile, unknown_attempt
from test_courier_reconciliation_postgres import postgres_offline_settings  # noqa: F401
from test_courier_reconciliation_replay import inject_failure, resolution_payload


@pytest.mark.parametrize('action', ['attach_existing', 'confirm_noncreation'])
@pytest.mark.parametrize('phase', ['receipt', 'after_receipt', 'review', 'finalize'])
async def test_postgres_replay_after_resolution_failure(postgres_buyer, monkeypatch, action, phase):
    client, connection, _, _ = postgres_buyer
    order, _, ready, attempt = await unknown_attempt(client, monkeypatch, f'pg-replay-{action}-{phase}')
    payload = resolution_payload(order, ready, attempt, action)
    with monkeypatch.context() as patch:
        inject_failure(patch, phase)
        failed = await reconcile(client, order, payload, 'pg-replay-failure')
    assert failed.status_code == 500
    committed = phase not in ('receipt', 'after_receipt')
    row = await connection.fetchrow(
        'SELECT status, resolution_version FROM courier_attempts WHERE id = $1', attempt['id'],
    )
    assert row['status'] == (
        ('success' if action == 'attach_existing' else 'failed') if committed else 'unknown'
    )
    assert row['resolution_version'] == int(committed)
    assert await connection.fetchval(
        'SELECT count(*) FROM courier_reconciliations WHERE attempt_id = $1', attempt['id'],
    ) == int(committed)
    assert await connection.fetchval(
        "SELECT count(*) FROM idempotency_records WHERE operation = 'courier_reconciliation'",
    ) == int(committed)

    # A fresh HTTP request/session recovers the durable receipt without the failed request's state.
    recovered = await reconcile(client, order, payload, 'pg-replay-failure')
    assert recovered.status_code == 200, recovered.text
    replay = await reconcile(client, order, payload, 'pg-replay-failure')
    assert replay.status_code == 200
    assert replay.json() == recovered.json()
    assert recovered.json()['latest_attempt']['resolution_version'] == 1
    assert await connection.fetchval(
        'SELECT count(*) FROM courier_reconciliations WHERE attempt_id = $1', attempt['id'],
    ) == 1


async def test_postgres_same_key_recovers_after_delayed_evidence(postgres_buyer, monkeypatch):
    from app.services import pathao_provider

    client, connection, _, _ = postgres_buyer
    order, _, ready, attempt = await unknown_attempt(client, monkeypatch, 'pg-delayed-evidence')
    payload = resolution_payload(order, ready, attempt, 'attach_existing')
    lookup = pathao_provider.lookup_booking
    evidence_started = asyncio.Event()
    release_evidence = asyncio.Event()

    async def delayed_lookup(*args):
        if not evidence_started.is_set():
            evidence_started.set()
            await asyncio.wait_for(release_evidence.wait(), 5)
        return await lookup(*args)

    monkeypatch.setattr(pathao_provider, 'lookup_booking', delayed_lookup)
    slow = asyncio.create_task(reconcile(client, order, payload, 'delayed-evidence-key'))
    try:
        await asyncio.wait_for(evidence_started.wait(), 5)
        winner = await reconcile(client, order, payload, 'delayed-evidence-key')
    finally:
        release_evidence.set()
    replay = await asyncio.wait_for(slow, 5)
    assert winner.status_code == replay.status_code == 200, (winner.text, replay.text)
    assert winner.json() == replay.json()
    assert await connection.fetchval(
        'SELECT count(*) FROM courier_reconciliations WHERE attempt_id = $1', attempt['id'],
    ) == 1


@pytest.mark.parametrize('same_payload', [True, False])
async def test_postgres_concurrent_same_key(postgres_buyer, monkeypatch, same_payload):
    from app.services import courier_reconciliation

    client, connection, _, _ = postgres_buyer
    order, _, ready, attempt = await unknown_attempt(client, monkeypatch, 'pg-same-key')
    attach = resolution_payload(order, ready, attempt, 'attach_existing')
    other = attach if same_payload else resolution_payload(order, ready, attempt, 'confirm_noncreation')
    lock_attempt = courier_reconciliation._lock_attempt
    both_ready = asyncio.Event()
    arrivals = 0

    async def rendezvous(*args):
        nonlocal arrivals
        arrivals += 1
        if arrivals == 2:
            both_ready.set()
        await asyncio.wait_for(both_ready.wait(), 5)
        return await lock_attempt(*args)

    monkeypatch.setattr(courier_reconciliation, '_lock_attempt', rendezvous)
    first, second = await asyncio.wait_for(asyncio.gather(
        reconcile(client, order, attach, 'shared-resolution-key'),
        reconcile(client, order, other, 'shared-resolution-key'),
    ), 15)
    if same_payload:
        assert first.status_code == second.status_code == 200, (first.text, second.text)
        assert first.json() == second.json()
    else:
        assert sorted([first.status_code, second.status_code]) == [200, 409]
        loser = first if first.status_code == 409 else second
        assert loser.json()['error']['code'] == 'IDEMPOTENCY_KEY_REUSED'
    assert await connection.fetchval(
        'SELECT count(*) FROM courier_reconciliations WHERE attempt_id = $1', attempt['id'],
    ) == 1
