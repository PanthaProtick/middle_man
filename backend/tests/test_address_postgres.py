import asyncio
import datetime

import pytest

from app.main import app
from app.services.address_assistance import reset_address_memory
from app.services.address_provider import get_address_provider
from tests.test_address_routes import SUGGESTIONS, ProviderDouble


@pytest.mark.asyncio
async def test_durable_replay_and_raw_evidence_ownership(postgres_buyer):
    client, connection, _, order = postgres_buyer
    provider = ProviderDouble(SUGGESTIONS)
    app.dependency_overrides[get_address_provider] = lambda: provider
    url = f"/api/public/orders/{order['portal_token']}/address-extraction"
    payload = {"raw_text": "Synthetic Dhaka", "ai_opt_in": True}
    response = await client.post(url, json=payload, headers={"Idempotency-Key": "durable"})
    assert response.status_code == 200
    reset_address_memory()
    replay = await client.post(url, json=payload, headers={"Idempotency-Key": "durable"})
    assert replay.json() == response.json()
    assert provider.calls == 1
    row = await connection.fetchrow("SELECT * FROM address_extractions WHERE order_id=$1", order["id"])
    assert row["shop_id"] == order["shop_id"]
    assert row["raw_request"] == "Synthetic Dhaka"
    assert row["delete_after"] - row["collected_at"] == datetime.timedelta(days=30)
    assert row["raw_request"] not in row["result_json"]
    assert await connection.fetchval("SELECT count(*) FROM idempotency_records WHERE operation='address_extraction'") == 0


@pytest.mark.asyncio
async def test_concurrent_same_key_has_one_committed_result(postgres_buyer):
    client, connection, _, order = postgres_buyer

    class SlowProvider(ProviderDouble):
        async def extract(self, address):
            await asyncio.sleep(0.05)
            return await super().extract(address)

    provider = SlowProvider(SUGGESTIONS)
    app.dependency_overrides[get_address_provider] = lambda: provider
    url = f"/api/public/orders/{order['portal_token']}/address-extraction"
    responses = await asyncio.gather(*(client.post(url, json={"raw_text": "Dhaka", "ai_opt_in": True}, headers={"Idempotency-Key": "concurrent"}) for _ in range(2)))
    assert [response.status_code for response in responses] == [200, 200]
    assert responses[0].json() == responses[1].json()
    assert provider.calls == 1
    assert await connection.fetchval("SELECT count(*) FROM address_extractions") == 1
