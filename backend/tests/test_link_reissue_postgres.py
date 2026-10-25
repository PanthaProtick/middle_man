"""Real PostgreSQL rotation races, rollback and restart persistence."""
import asyncio

import pytest
from buyer_postgres_support import PAYLOAD, wait_for_order_waiters

from app.services.order_service import reset_order_memory_store
from app.services.seller_service import reset_memory_store


async def rotate(client, order, key="rotate", version=1):
    return await client.post(f"/api/seller/orders/{order['id']}/reissue-link",
                             json={"expected_version": version}, headers={"Idempotency-Key": key})


@pytest.mark.parametrize("other", ["retry", "revoke", "submit"])
@pytest.mark.parametrize("rotate_first", [True, False])
async def test_rotation_serializes_with_retry_revocation_and_submission(postgres_buyer, other, rotate_first):
    client, connection, sessions, order = postgres_buyer
    public = f"/api/public/orders/{order['portal_token']}"

    async def competing():
        if other == "retry":
            return await rotate(client, order)
        if other == "revoke":
            return await client.post(f"/api/seller/orders/{order['id']}/revoke-link",
                                     json={"expected_version": 1}, headers={"Idempotency-Key": "revoke"})
        return await client.post(public + "/submission", json=PAYLOAD, headers={"Idempotency-Key": "submit"})

    await connection.execute("BEGIN")
    await connection.execute("SELECT id FROM orders WHERE id=$1 FOR UPDATE", order["id"])
    first = asyncio.create_task(rotate(client, order) if rotate_first else competing())
    second = None
    try:
        await wait_for_order_waiters(connection, 1)
        second = asyncio.create_task(competing() if rotate_first else rotate(client, order))
        await wait_for_order_waiters(connection, 2)
    finally:
        await connection.execute("COMMIT")
        responses = await asyncio.gather(first, *([second] if second else []))
    expected = [200, 200] if other == "retry" else [200, 404] if other == "submit" and rotate_first else [200, 409]
    assert [response.status_code for response in responses] == expected
    seller = f"/api/seller/orders/{order['id']}"
    before = (await client.get(seller)).json()
    reset_order_memory_store()
    reset_memory_store()
    await sessions.kw["bind"].dispose()
    assert (await client.get(seller)).json() == before
    assert before["expires_at"] == order["expires_at"]
    if rotate_first or other == "retry":
        assert before["portal_token"] != order["portal_token"]
        assert (await client.get(public)).status_code == 404
        assert (await client.get(f"/api/public/orders/{before['portal_token']}")).status_code == 200
        assert (await rotate(client, order)).json() == before
        assert await connection.fetchval("SELECT count(*) FROM audit_events WHERE action='buyer_link_reissued'") == 1
    else:
        assert before["portal_token"] == order["portal_token"]


async def test_rotation_audit_failure_rolls_back_token_and_retry(postgres_buyer):
    client, connection, _, order = postgres_buyer
    await connection.execute("""
        CREATE FUNCTION reject_rotation() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$;
        CREATE TRIGGER reject_rotation BEFORE INSERT ON audit_events
        FOR EACH ROW WHEN (NEW.action='buyer_link_reissued') EXECUTE FUNCTION reject_rotation();
    """)
    assert (await rotate(client, order)).status_code == 503
    assert (await client.get(f"/api/seller/orders/{order['id']}")).json() == order
    assert (await client.get(f"/api/public/orders/{order['portal_token']}")).status_code == 200
    assert await connection.fetchval("SELECT count(*) FROM idempotency_records WHERE operation='reissue_buyer_link'") == 0
    await connection.execute("DROP TRIGGER reject_rotation ON audit_events")
    assert (await rotate(client, order)).status_code == 200


async def test_durable_confirmed_allocation_survives_rotation(postgres_buyer):
    from test_link_reissue import confirmed_reissue
    client, _, _, _ = postgres_buyer
    await confirmed_reissue(client)
