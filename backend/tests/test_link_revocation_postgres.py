import asyncio

import pytest
from buyer_postgres_support import PAYLOAD, wait_for_order_waiters
from sqlalchemy import select

from app.models.entities import OrderTable
from app.services.buyer_service import BuyerService
from app.services.order_service import reset_order_memory_store
from app.services.seller_service import SellerDomainException, reset_memory_store


@pytest.mark.parametrize("revoke_first", [True, False])
async def test_submission_and_revocation_serialize_and_survive_restart(postgres_buyer, revoke_first):
    client, connection, sessions, order = postgres_buyer
    public = f"/api/public/orders/{order['portal_token']}"
    seller = f"/api/seller/orders/{order['id']}"

    async def revoke():
        return await client.post(seller + "/revoke-link", json={"expected_version": 1}, headers={"Idempotency-Key": "race-revoke"})

    async def submit():
        return await client.post(public + "/submission", json=PAYLOAD, headers={"Idempotency-Key": "race-submit"})

    await connection.execute("BEGIN")
    await connection.execute("SELECT id FROM orders WHERE id=$1 FOR UPDATE", order["id"])
    first = asyncio.create_task(revoke() if revoke_first else submit())
    second = None
    try:
        await wait_for_order_waiters(connection, 1)
        second = asyncio.create_task(submit() if revoke_first else revoke())
        await wait_for_order_waiters(connection, 2)
    finally:
        await connection.execute("COMMIT")
        responses = await asyncio.gather(first, *([second] if second is not None else []))
    assert [r.status_code for r in responses] == ([200, 410] if revoke_first else [200, 409])
    if not revoke_first:
        response = await client.post(seller + "/revoke-link", json={"expected_version": 2}, headers={"Idempotency-Key": "fresh-revoke"})
        assert response.status_code == 200
    assert await connection.fetchval("SELECT count(*) FROM buyer_revisions") == (0 if revoke_first else 1)
    assert await connection.fetchval("SELECT count(*) FROM audit_events WHERE action='buyer_link_revoked'") == 1
    before = (await client.get(seller)).json()
    reset_order_memory_store()
    reset_memory_store()
    await sessions.kw["bind"].dispose()
    assert (await client.get(seller)).json() == before
    assert before["lifecycle"] == ("awaiting_buyer" if revoke_first else "pending")
    assert before["expires_at"] == order["expires_at"]
    assert (await client.get(public)).status_code == 410
    assert (await submit()).status_code == 410


async def test_public_authorization_refreshes_an_already_loaded_order(postgres_buyer):
    client, _, sessions, order = postgres_buyer
    async with sessions() as session:
        stale = await session.scalar(select(OrderTable).where(OrderTable.id == order["id"]))
        assert stale.buyer_link_revoked_at is None
        response = await client.post(f"/api/seller/orders/{order['id']}/revoke-link",
                                    json={"expected_version": 1}, headers={"Idempotency-Key": "revoke"})
        assert response.status_code == 200
        with pytest.raises(SellerDomainException) as denied:
            await BuyerService(session).get_public_order(order["portal_token"])
        assert denied.value.detail["code"] == "BUYER_LINK_REVOKED"


async def test_revocation_audit_failure_rolls_back_access_and_retry_key(postgres_buyer):
    client, connection, _, order = postgres_buyer
    await connection.execute("""
        CREATE FUNCTION reject_revoke() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$;
        CREATE TRIGGER reject_revoke BEFORE INSERT ON audit_events
        FOR EACH ROW WHEN (NEW.action='buyer_link_revoked') EXECUTE FUNCTION reject_revoke();
    """)
    path = f"/api/seller/orders/{order['id']}/revoke-link"
    payload, headers = {"expected_version": 1}, {"Idempotency-Key": "retry-revoke"}
    failed = await client.post(path, json=payload, headers=headers)
    assert failed.status_code == 503
    assert (await client.get(f"/api/public/orders/{order['portal_token']}")).status_code == 200
    assert await connection.fetchval("SELECT version FROM orders") == 1
    assert await connection.fetchval("SELECT count(*) FROM idempotency_records WHERE operation='revoke_buyer_link'") == 0
    await connection.execute("DROP TRIGGER reject_revoke ON audit_events")
    assert (await client.post(path, json=payload, headers=headers)).status_code == 200


async def test_confirmed_allocation_survives_durable_revocation(postgres_buyer):
    from test_link_revocation import confirmed_order_revocation
    client, _, _, _ = postgres_buyer
    await confirmed_order_revocation(client)


async def test_revocation_between_extraction_reservation_and_work_denies_storage(postgres_buyer, monkeypatch):
    from app.core.config import settings
    from app.main import app
    from app.models.payment_entities import PaymentExtractionTable
    from app.services.payment_provider import get_payment_provider
    from tests.test_image_service import _create_minimal_png

    client, _, sessions, order = postgres_buyer
    public = f"/api/public/orders/{order['portal_token']}"
    uploaded = await client.post(public + "/evidence", content=_create_minimal_png(),
                                headers={"Content-Type": "image/png", "Idempotency-Key": "image"})
    assert uploaded.status_code == 201
    reserved, resume = asyncio.Event(), asyncio.Event()
    original_commit = sessions.class_.commit

    async def commit(session):
        reservation = any(isinstance(row, PaymentExtractionTable) for row in session.new)
        await original_commit(session)
        if reservation:
            reserved.set()
            await resume.wait()

    class ForbiddenProvider:
        async def extract(self, image, media_type):
            pytest.fail("Revoked access reached the provider")

    def forbidden_storage(key):
        pytest.fail("Revoked access read screenshot storage")

    monkeypatch.setattr(sessions.class_, "commit", commit)
    monkeypatch.setattr(settings, "SELF_TEST_MODE", False)
    monkeypatch.setattr("app.services.payment_extraction.read_evidence_file", forbidden_storage)
    app.dependency_overrides[get_payment_provider] = lambda: ForbiddenProvider()
    task = asyncio.create_task(client.post(public + "/payment-extraction", json={
        "evidence_id": uploaded.json()["evidence_id"], "ai_opt_in": True,
    }, headers={"Idempotency-Key": "extract"}))
    try:
        await asyncio.wait_for(reserved.wait(), timeout=5)
        revoked = await client.post(f"/api/seller/orders/{order['id']}/revoke-link",
                                   json={"expected_version": 1}, headers={"Idempotency-Key": "revoke"})
        assert revoked.status_code == 200
    finally:
        resume.set()
        result = await task
        app.dependency_overrides.pop(get_payment_provider, None)
    assert result.status_code == 410
    assert result.json()["error"]["code"] == "BUYER_LINK_REVOKED"
