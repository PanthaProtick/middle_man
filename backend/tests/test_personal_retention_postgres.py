"""Controlled-clock retention acceptance through the owning seller HTTP surface."""
import datetime as dt

import pytest
from test_structured_retention_postgres import confirm_case

UTC = dt.timezone.utc
STATUS = '/api/seller/retention/structured'


@pytest.mark.parametrize('completed,deadline', [
    (dt.datetime(2024, 2, 29, 13, tzinfo=UTC), dt.datetime(2025, 2, 28, 13, tzinfo=UTC)),
    (dt.datetime(2023, 3, 1, 13, tzinfo=UTC), dt.datetime(2024, 3, 1, 13, tzinfo=UTC)),
])
async def test_calendar_boundary_preserves_personal_details_until_anniversary(
    postgres_buyer, monkeypatch, completed, deadline,
):
    client, connection, _, _ = postgres_buyer
    order, _ = await confirm_case(client)
    await connection.execute('UPDATE orders SET completed_at=$1 WHERE id=$2', completed, order['id'])
    monkeypatch.setattr('app.api.structured_retention.get_utc_now',
                        lambda: deadline - dt.timedelta(microseconds=1))
    before = await client.post(STATUS + '/cleanup')
    assert before.status_code == 200, before.text
    assert before.json()['removed'] == before.json()['overdue'] == 0
    assert (await client.get(f"/api/seller/orders/{order['id']}/history")).json()['items']
    assert await connection.fetchval('SELECT count(*) FROM buyer_revisions WHERE order_id=$1', order['id']) == 1

    monkeypatch.setattr('app.api.structured_retention.get_utc_now', lambda: deadline)
    due = await client.get(STATUS)
    assert due.status_code == 200, due.text
    assert due.json()['overdue'] == 1
    cleaned = await client.post(STATUS + '/cleanup')
    assert cleaned.status_code == 200, cleaned.text
    assert cleaned.json()['removed'] == 1
    assert cleaned.json()['overdue'] == cleaned.json()['failed'] == 0
    assert (await client.get(f"/api/seller/orders/{order['id']}/history")).status_code == 410
    assert await connection.fetchval('SELECT count(*) FROM buyer_revisions WHERE order_id=$1', order['id']) == 0


async def test_partial_failure_reports_committed_success_and_retry_through_seller(postgres_buyer, monkeypatch):
    client, connection, _, _ = postgres_buyer
    order, _ = await confirm_case(client)
    created = await client.post('/api/seller/orders', json={
        'product_name': 'Independent completed record', 'total_minor': 1200000,
        'required_advance_minor': 200000, 'payment_account_id': order['payment_account_id']},
        headers={'Idempotency-Key': 'independent-retention-order'})
    assert created.status_code == 201, created.text
    other = created.json()
    completed = dt.datetime(2024, 1, 1, tzinfo=UTC)
    deadline = dt.datetime(2025, 1, 1, tzinfo=UTC)
    await connection.execute('UPDATE orders SET completed_at=$1 WHERE id=$2', completed, order['id'])
    await connection.execute("UPDATE orders SET lifecycle='cancelled', completed_at=$1 WHERE id=$2",
                             completed, other['id'])
    await connection.execute("""CREATE FUNCTION fail_personal_retention() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'synthetic private failure'; END $$;
        CREATE TRIGGER block_personal_retention BEFORE DELETE ON buyer_revisions
        FOR EACH ROW EXECUTE FUNCTION fail_personal_retention();""")
    monkeypatch.setattr('app.api.structured_retention.get_utc_now', lambda: deadline)
    partial = await client.post(STATUS + '/cleanup')
    assert partial.status_code == 200, partial.text
    assert partial.json()['removed'] == 1
    assert partial.json()['failed'] == partial.json()['overdue'] == 1
    assert 'private' not in partial.text
    persisted = await client.get(STATUS)
    assert persisted.status_code == 200, persisted.text
    assert persisted.json()['failed'] == persisted.json()['overdue'] == 1
    assert (await client.get(f"/api/seller/orders/{other['id']}")).status_code == 410
    assert (await client.get(f"/api/seller/orders/{order['id']}/history")).json()['items']

    await connection.execute('DROP TRIGGER block_personal_retention ON buyer_revisions; '
                             'DROP FUNCTION fail_personal_retention()')
    retry = await client.post(STATUS + '/cleanup')
    assert retry.status_code == 200, retry.text
    assert retry.json()['removed'] == 1
    assert retry.json()['failed'] == retry.json()['overdue'] == 0
    assert (await client.post(STATUS + '/cleanup')).json()['removed'] == 0
