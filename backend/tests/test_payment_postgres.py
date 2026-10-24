import asyncio
import datetime

import pytest

from app.main import app
from app.services.payment_extraction import reset_payment_memory
from app.services.payment_provider import get_payment_provider
from app.services.payment_retention import purge_payment_raw_evidence
from tests.test_payment_extraction import ProviderDouble, stage


@pytest.mark.asyncio
async def test_durable_replay_original_retention_and_purge(postgres_buyer):
    client, connection, sessions, order = postgres_buyer
    provider = ProviderDouble()
    app.dependency_overrides[get_payment_provider] = lambda: provider
    evidence = await stage(client, order)
    # Old screenshot, new processing: retention must not restart now.
    await connection.execute(
        "UPDATE order_evidence SET collected_at=collected_at-interval '2 days', delete_after=delete_after-interval '2 days' WHERE id=$1",
        evidence,
    )
    url = f"/api/public/orders/{order['portal_token']}/payment-extraction"
    payload = {"evidence_id": evidence, "ai_opt_in": True}
    response = await client.post(url, json=payload, headers={"Idempotency-Key": "durable"})
    assert response.status_code == 200, response.text
    reset_payment_memory()
    replay = await client.post(url, json=payload, headers={"Idempotency-Key": "durable"})
    assert replay.json() == response.json()
    assert provider.calls == 1
    row = await connection.fetchrow("SELECT * FROM payment_extractions WHERE evidence_id=$1", evidence)
    original = await connection.fetchrow("SELECT * FROM order_evidence WHERE id=$1", evidence)
    assert row["shop_id"] == order["shop_id"]
    assert row["collected_at"] == original["collected_at"]
    assert row["delete_after"] == original["delete_after"]
    assert row["delete_after"] - row["collected_at"] == datetime.timedelta(days=30)
    assert row["raw_response"] is not None
    async with sessions() as db:
        await purge_payment_raw_evidence(db, row["delete_after"])
        await db.commit()
    purged = await connection.fetchrow("SELECT * FROM payment_extractions WHERE id=$1", row["id"])
    assert purged["raw_response"] is None
    assert purged["result_json"] == row["result_json"]


@pytest.mark.asyncio
async def test_concurrent_replay_and_lost_attempt_budget(postgres_buyer):
    client, connection, _, order = postgres_buyer

    class SlowProvider(ProviderDouble):
        async def extract(self, image, media_type):
            await asyncio.sleep(0.05)
            return await super().extract(image, media_type)

    provider = SlowProvider()
    app.dependency_overrides[get_payment_provider] = lambda: provider
    evidence = await stage(client, order)
    url = f"/api/public/orders/{order['portal_token']}/payment-extraction"
    payload = {"evidence_id": evidence, "ai_opt_in": True}
    responses = await asyncio.gather(
        *(client.post(url, json=payload, headers={"Idempotency-Key": "concurrent"}) for _ in range(2))
    )
    assert all(r.status_code in (200, 409) for r in responses)
    assert any(r.status_code == 200 for r in responses)
    assert provider.calls == 1
    replay = await client.post(url, json=payload, headers={"Idempotency-Key": "concurrent"})
    assert replay.json()["available"] is True
    # Simulate the durable reservation left by a process dying before result commit.
    await connection.execute("UPDATE payment_extractions SET state='pending' WHERE order_id=$1", order["id"])
    lost = await client.post(url, json=payload, headers={"Idempotency-Key": "concurrent"})
    assert lost.status_code == 409
    assert lost.json()["error"]["code"] == "EXTRACTION_OUTCOME_UNKNOWN"
    assert provider.calls == 1


@pytest.mark.asyncio
async def test_crash_after_provider_call_leaves_durable_reservation_and_bounds_new_attempts(postgres_buyer):
    client, connection, _, order = postgres_buyer

    class CrashingProvider(ProviderDouble):
        async def extract(self, image, media_type):
            self.calls += 1
            raise RuntimeError("Synthetic process failure after sending provider request")

    provider = CrashingProvider()
    app.dependency_overrides[get_payment_provider] = lambda: provider
    evidence = await stage(client, order)
    url = f"/api/public/orders/{order['portal_token']}/payment-extraction"
    payload = {"evidence_id": evidence, "ai_opt_in": True}
    assert (await client.post(url, json=payload, headers={"Idempotency-Key": "crash"})).status_code == 500
    assert (await client.post(url, json=payload, headers={"Idempotency-Key": "crash"})).status_code == 409
    assert provider.calls == 1
    for index in range(4):
        assert (await client.post(url, json=payload, headers={"Idempotency-Key": str(index)})).status_code == 500
    assert (await client.post(url, json=payload, headers={"Idempotency-Key": "sixth"})).status_code == 429
    assert provider.calls == 5
    assert await connection.fetchval("SELECT count(*) FROM payment_extractions WHERE state='pending'") == 5
