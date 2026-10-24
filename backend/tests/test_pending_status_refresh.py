"""Public status reads preserve durable outcomes and the existing privacy boundary."""
import datetime

from buyer_postgres_support import PAYLOAD

from app.api.public_orders import get_buyer_clock
from app.main import app


async def test_repeated_durable_pending_reads_survive_deadline_and_seller_cancellation(postgres_buyer):
    client, _, sessions, order = postgres_buyer
    public_url = f"/api/public/orders/{order['portal_token']}"
    payload = {**PAYLOAD, "payment_claim": {**PAYLOAD["payment_claim"], "amount_minor": 200000}}
    submitted = await client.post(public_url + "/submission", json=payload, headers={"Idempotency-Key": "refresh-submit"})
    assert submitted.status_code == 200
    assert submitted.json()["lifecycle"] == "pending"
    app.dependency_overrides[get_buyer_clock] = lambda: lambda: datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=5)
    await sessions.kw["bind"].dispose()
    for _ in range(3):
        fresh = await client.get(public_url)
        assert fresh.status_code == 200
        assert fresh.headers["cache-control"] == "no-store, private"
        assert fresh.json()["lifecycle"] == "pending"
        assert fresh.json()["actual_cod_minor"] is None
        assert fresh.json()["submission_acknowledgement"] == submitted.json()["submission_acknowledgement"]
        assert not {"buyer_name", "contact_number", "address", "payment_claim", "review_reasons", "owner_id", "receipt", "version"} & fresh.json().keys()
    seller_url = f"/api/seller/orders/{order['id']}"
    seller = await client.get(seller_url)
    cancelled = await client.post(seller_url + "/decisions", json={
        "action": "cancel", "expected_version": seller.json()["version"], "reason": "Synthetic private seller reason",
    }, headers={"Idempotency-Key": "refresh-cancel"})
    assert cancelled.status_code == 200
    await sessions.kw["bind"].dispose()
    final = await client.get(public_url)
    assert final.json()["lifecycle"] == "cancelled"
    assert "Synthetic private seller reason" not in final.text
