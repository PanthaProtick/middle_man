import asyncio
import datetime

import asyncpg
import pytest
from buyer_postgres_support import PAYLOAD, wait_for_order_waiters
from fastapi import Request

from app.api.public_orders import get_buyer_clock
from app.main import app


@pytest.mark.parametrize("offset,expected", [(-1, 200), (0, 410), (1, 410)])
async def test_server_deadline_is_strict(postgres_buyer, offset, expected):
    client, connection, _, order = postgres_buyer
    deadline = await connection.fetchval("SELECT expires_at FROM orders")
    app.dependency_overrides[get_buyer_clock] = lambda: lambda: deadline + datetime.timedelta(microseconds=offset)
    payload = {**PAYLOAD, "payment_claim": {**PAYLOAD["payment_claim"], "amount_minor": 200000}}
    response = await client.post(f"/api/public/orders/{order['portal_token']}/submission", json=payload, headers={"Idempotency-Key": "deadline"})
    assert response.status_code == expected
    assert await connection.fetchval("SELECT count(*) FROM buyer_revisions") == (1 if expected == 200 else 0)


async def test_clock_is_sampled_after_waiting_for_order_lock(postgres_buyer):
    client, connection, _, order = postgres_buyer
    deadline = await connection.fetchval("SELECT expires_at FROM orders")
    now = deadline - datetime.timedelta(seconds=1)
    app.dependency_overrides[get_buyer_clock] = lambda: lambda: now
    await connection.execute("BEGIN")
    await connection.execute("SELECT id FROM orders FOR UPDATE")
    task = asyncio.create_task(client.post(f"/api/public/orders/{order['portal_token']}/submission", json=PAYLOAD, headers={"Idempotency-Key": "wait-deadline"}))
    try:
        await wait_for_order_waiters(connection, 1)
        now = deadline
    finally:
        await connection.execute("COMMIT")
        response = await task
    assert response.status_code == 410
    assert await connection.fetchval("SELECT count(*) FROM buyer_revisions") == 0


@pytest.mark.parametrize("reader", ["public", "seller"])
async def test_expiry_read_cannot_overwrite_accepted_submission(postgres_buyer, monkeypatch, reader):
    client, connection, _, order = postgres_buyer
    deadline = await connection.fetchval("SELECT expires_at FROM orders")

    def clock(request: Request):
        offset = 1 if request.method == "GET" else -1
        return lambda: deadline + datetime.timedelta(seconds=offset)

    app.dependency_overrides[get_buyer_clock] = clock
    monkeypatch.setattr("app.services.order_service.get_utc_now", lambda: deadline + datetime.timedelta(seconds=1))
    await connection.execute("BEGIN")
    await connection.execute("SELECT id FROM orders FOR UPDATE")
    public_url = f"/api/public/orders/{order['portal_token']}"
    submission = asyncio.create_task(client.post(public_url + "/submission", json=PAYLOAD, headers={"Idempotency-Key": "expiry-race"}))
    tasks = [submission]
    try:
        await wait_for_order_waiters(connection, 1)
        read_url = public_url if reader == "public" else f"/api/seller/orders/{order['id']}"
        read = asyncio.create_task(client.get(read_url))
        tasks.append(read)
        await wait_for_order_waiters(connection, 2)
    finally:
        await connection.execute("COMMIT")
        responses = await asyncio.gather(*tasks)
    assert all(response.status_code == 200 for response in responses)
    assert all(response.json()["lifecycle"] == "pending" for response in responses)
    assert await connection.fetchval("SELECT version FROM orders") == 2
    assert await connection.fetchval("SELECT completed_at FROM orders") is None


async def test_duplicate_revision_is_rejected_by_migrated_schema(postgres_buyer):
    client, connection, _, order = postgres_buyer
    response = await client.post(f"/api/public/orders/{order['portal_token']}/submission", json=PAYLOAD, headers={"Idempotency-Key": "unique"})
    assert response.status_code == 200
    with pytest.raises(asyncpg.UniqueViolationError):
        await connection.execute("INSERT INTO buyer_revisions SELECT 'different-id', order_id, revision_number, buyer_name, contact_number_raw, contact_number_canonical, address_raw, address_district, address_thana, address_area, address_street_line, address_landmark, payment_provider, payment_trx_id, payment_sender_raw, payment_sender_canonical, payment_amount_minor, payment_claimed_at, source, actor, reason, created_at, claim_accepted_at FROM buyer_revisions")


async def test_measurements_separate_repeat_bot_and_status_requests(postgres_buyer):
    client, connection, _, order = postgres_buyer
    url = f"/api/public/orders/{order['portal_token']}"
    assert (await client.get(url, headers={"User-Agent": "Synthetic browser"})).status_code == 200
    assert (await client.get(url, headers={"User-Agent": "Synthetic browser"})).status_code == 200
    assert (await client.get(url, headers={"User-Agent": "PreviewBot"})).status_code == 200
    assert await connection.fetchval("SELECT count(*) FROM link_measurements WHERE event_type='open' AND is_bot_or_repeat=false") == 1
    assert await connection.fetchval("SELECT count(*) FROM link_measurements WHERE event_type='open' AND is_bot_or_repeat=true") == 2
    for _ in range(2):
        assert (await client.post(url + "/submission", json=PAYLOAD, headers={"Idempotency-Key": "measured"})).status_code == 200
    for _ in range(3):
        assert (await client.get(url)).status_code == 200
    assert await connection.fetchval("SELECT count(*) FROM link_measurements WHERE event_type='open'") == 3
    assert await connection.fetchval("SELECT count(*) FROM link_measurements WHERE event_type='submission'") == 1


async def test_open_draft_does_not_extend_original_48_hour_deadline(postgres_buyer):
    client, connection, _, order = postgres_buyer
    created, deadline = await connection.fetchrow("SELECT created_at, expires_at FROM orders")
    assert deadline == created + datetime.timedelta(hours=48)
    now = deadline - datetime.timedelta(minutes=1)
    app.dependency_overrides[get_buyer_clock] = lambda: lambda: now
    url = f"/api/public/orders/{order['portal_token']}"
    opened = await client.get(url)
    assert opened.status_code == 200
    assert opened.json()["lifecycle"] == "awaiting_buyer"
    now = deadline + datetime.timedelta(microseconds=1)
    rejected = await client.post(url + "/submission", json=PAYLOAD, headers={"Idempotency-Key": "old-draft"})
    assert rejected.status_code == 410
    assert rejected.json()["error"]["code"] == "EXPIRED_SUBMISSION"
    assert (await client.get(url)).json()["expires_at"] == opened.json()["expires_at"]
    assert await connection.fetchval("SELECT count(*) FROM buyer_revisions") == 0
    assert await connection.fetchval("SELECT count(*) FROM idempotency_records WHERE operation='buyer_submission'") == 0


async def test_pending_outcome_replays_after_deadline_but_rejects_new_writes(postgres_buyer):
    client, connection, sessions, order = postgres_buyer
    deadline = await connection.fetchval("SELECT expires_at FROM orders")
    now = deadline - datetime.timedelta(microseconds=1)
    app.dependency_overrides[get_buyer_clock] = lambda: lambda: now
    url = f"/api/public/orders/{order['portal_token']}"
    first = await client.post(url + "/submission", json=PAYLOAD, headers={"Idempotency-Key": "original"})
    assert first.status_code == 200
    assert first.json()["lifecycle"] == "pending"
    now = deadline + datetime.timedelta(days=2)
    await sessions.kw["bind"].dispose()
    replay = await client.post(url + "/submission", json=PAYLOAD, headers={"Idempotency-Key": "original"})
    assert replay.status_code == 200
    assert replay.json() == first.json()
    status = await client.get(url)
    assert status.status_code == 200
    assert status.json()["lifecycle"] == "pending"
    assert status.json()["submission_acknowledgement"] == first.json()["submission_acknowledgement"]
    duplicate = await client.post(url + "/submission", json=PAYLOAD, headers={"Idempotency-Key": "new"})
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "ORDER_ALREADY_SUBMITTED"
    changed = await client.post(url + "/submission", json={**PAYLOAD, "buyer_name": "Changed"}, headers={"Idempotency-Key": "original"})
    assert changed.status_code == 409
    assert changed.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"
    assert await connection.fetchval("SELECT count(*) FROM buyer_revisions") == 1
    assert await connection.fetchval("SELECT completed_at FROM orders") is None
