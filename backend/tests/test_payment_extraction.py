import json

import pytest

from app.main import app
from tests.test_evidence_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401
from tests.test_image_service import _create_minimal_png

pytestmark = pytest.mark.usefixtures("seller_identity")


@pytest.mark.asyncio
async def test_payment_suggestions_require_consent_and_replay_without_submission(client):
    from app.services.payment_provider import get_payment_provider

    class Provider:
        calls = 0

        async def extract(self, image, media_type):
            self.calls += 1
            return json.dumps(
                dict(
                    is_payment_screenshot=True,
                    provider="bkash",
                    trx_id="ABC123",
                    amount_minor=100000,
                    sender_number="01712345678",
                    receiver_number=None,
                    occurred_at=None,
                    unreadable_fields=["receiver_number", "occurred_at"],
                )
            )

    provider = Provider()
    app.dependency_overrides[get_payment_provider] = lambda: provider
    try:
        order = await _create_test_order(client)
        base = f"/api/public/orders/{order['portal_token']}"
        upload = await client.post(
            base + "/evidence",
            content=_create_minimal_png(),
            headers={"Content-Type": "image/png", "Idempotency-Key": "image"},
        )
        payload = {"evidence_id": upload.json()["evidence_id"], "ai_opt_in": True}
        assert (
            await client.post(
                base + "/payment-extraction",
                json={**payload, "ai_opt_in": False},
                headers={"Idempotency-Key": "extract"},
            )
        ).status_code == 422
        response = await client.post(base + "/payment-extraction", json=payload, headers={"Idempotency-Key": "extract"})
        assert response.status_code == 200
        assert response.json()["suggestions"]["trx_id"] == "ABC123"
        assert response.json()["review_required"] is True
        assert (
            await client.post(base + "/payment-extraction", json=payload, headers={"Idempotency-Key": "extract"})
        ).json() == response.json()
        assert provider.calls == 1
        assert (await client.get(base)).json()["lifecycle"] == "awaiting_buyer"
    finally:
        app.dependency_overrides.pop(get_payment_provider, None)


@pytest.fixture(autouse=True)
def reset_payment():
    from app.services.payment_extraction import reset_payment_memory
    from app.services.payment_provider import get_payment_provider

    reset_payment_memory()
    yield
    reset_payment_memory()
    app.dependency_overrides.pop(get_payment_provider, None)


SUGGESTIONS = dict(
    is_payment_screenshot=True,
    provider="bkash",
    trx_id="ABC123",
    amount_minor=100000,
    sender_number="01712345678",
    receiver_number=None,
    occurred_at=None,
    unreadable_fields=["receiver_number", "occurred_at"],
)


class ProviderDouble:
    def __init__(self, output=SUGGESTIONS):
        self.output, self.calls = output, 0

    async def extract(self, image, media_type):
        self.calls += 1
        assert image.startswith(b"\x89PNG")
        assert media_type == "image/png"
        if isinstance(self.output, Exception):
            raise self.output
        return json.dumps(self.output)


async def stage(client, order, key="image"):
    response = await client.post(
        f"/api/public/orders/{order['portal_token']}/evidence",
        content=_create_minimal_png(),
        headers={"Content-Type": "image/png", "Idempotency-Key": key},
    )
    assert response.status_code == 201
    return response.json()["evidence_id"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "output",
    [
        {},
        {**SUGGESTIONS, "provider": "unknown"},
        {**SUGGESTIONS, "amount_minor": True},
        {**SUGGESTIONS, "confirmed": True},
        {**SUGGESTIONS, "occurred_at": "2026-10-24T12:00:00"},
        TimeoutError(),
    ],
)
async def test_invalid_output_has_replayable_manual_fallback(client, output):
    from app.services.payment_provider import get_payment_provider

    provider = ProviderDouble(output)
    app.dependency_overrides[get_payment_provider] = lambda: provider
    order = await _create_test_order(client)
    evidence = await stage(client, order)
    url = f"/api/public/orders/{order['portal_token']}/payment-extraction"
    for _ in range(2):
        response = await client.post(
            url, json={"evidence_id": evidence, "ai_opt_in": True}, headers={"Idempotency-Key": "fallback"}
        )
        assert response.status_code == 200
        assert response.json()["available"] is False
        assert response.json()["suggestions"] is None
    assert provider.calls == 1


@pytest.mark.asyncio
async def test_foreign_missing_evidence_gate_and_numeric_consent_do_not_call_provider(client):
    from app.core.public_gate import verify_public_access_gate
    from app.services.evidence_service import _memory_order_evidence
    from app.services.payment_provider import get_payment_provider

    provider = ProviderDouble()
    app.dependency_overrides[get_payment_provider] = lambda: provider
    order = await _create_test_order(client)
    evidence = await stage(client, order)
    url = f"/api/public/orders/{order['portal_token']}/payment-extraction"
    for value in [False, 1, "true"]:
        assert (
            await client.post(
                url, json={"evidence_id": evidence, "ai_opt_in": value}, headers={"Idempotency-Key": "consent"}
            )
        ).status_code == 422
    _memory_order_evidence[evidence]["order_id"] = "foreign-order"
    for eid in [evidence, "missing"]:
        assert (
            await client.post(url, json={"evidence_id": eid, "ai_opt_in": True}, headers={"Idempotency-Key": "foreign"})
        ).status_code == 422
    app.dependency_overrides.pop(verify_public_access_gate)
    assert (
        await client.post(url, json={"evidence_id": evidence, "ai_opt_in": True}, headers={"Idempotency-Key": "gate"})
    ).status_code == 503
    assert provider.calls == 0


@pytest.mark.asyncio
async def test_attempt_limit_key_conflict_and_submission_remain_manual(client):
    from app.services.payment_provider import get_payment_provider
    from tests.buyer_postgres_support import PAYLOAD

    provider = ProviderDouble()
    app.dependency_overrides[get_payment_provider] = lambda: provider
    order = await _create_test_order(client)
    evidence = await stage(client, order)
    other = await stage(client, order, "other")
    base = f"/api/public/orders/{order['portal_token']}"
    payload = {"evidence_id": evidence, "ai_opt_in": True}
    for index in range(5):
        assert (
            await client.post(base + "/payment-extraction", json=payload, headers={"Idempotency-Key": str(index)})
        ).status_code == 200
    assert (
        await client.post(
            base + "/payment-extraction", json={**payload, "evidence_id": other}, headers={"Idempotency-Key": "0"}
        )
    ).status_code == 409
    assert (
        await client.post(base + "/payment-extraction", json=payload, headers={"Idempotency-Key": "sixth"})
    ).status_code == 429
    assert (
        await client.post(base + "/submission", json=PAYLOAD, headers={"Idempotency-Key": "manual"})
    ).status_code == 200
    assert (
        await client.post(base + "/payment-extraction", json=payload, headers={"Idempotency-Key": "0"})
    ).status_code == 409
    assert provider.calls == 5


@pytest.mark.asyncio
async def test_expired_order_rejects_before_provider_and_late_output_is_rejected(client):
    import datetime

    from app.api.public_orders import get_buyer_clock
    from app.services.payment_provider import get_payment_provider

    order = await _create_test_order(client)
    evidence = await stage(client, order)
    expires = datetime.datetime.fromisoformat(order["expires_at"])
    now = expires - datetime.timedelta(seconds=1)
    app.dependency_overrides[get_buyer_clock] = lambda: lambda: now

    class ExpiringProvider(ProviderDouble):
        async def extract(self, image, media_type):
            nonlocal now
            now = expires
            return await super().extract(image, media_type)

    provider = ExpiringProvider()
    app.dependency_overrides[get_payment_provider] = lambda: provider
    url = f"/api/public/orders/{order['portal_token']}/payment-extraction"
    for _ in range(2):
        assert (
            await client.post(
                url, json={"evidence_id": evidence, "ai_opt_in": True}, headers={"Idempotency-Key": "late"}
            )
        ).status_code == 410
    assert provider.calls == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("unavailable", ["deleted", "failed", "expired", "storage"])
async def test_unavailable_screenshot_never_reaches_provider(client, unavailable):
    import datetime

    from app.services.evidence_service import _memory_order_evidence
    from app.services.evidence_store import inject_storage_outage
    from app.services.payment_provider import get_payment_provider

    order = await _create_test_order(client)
    evidence = await stage(client, order)
    provider = ProviderDouble()
    app.dependency_overrides[get_payment_provider] = lambda: provider
    if unavailable == "expired":
        _memory_order_evidence[evidence]["delete_after"] = datetime.datetime.now(datetime.UTC) - datetime.timedelta(
            seconds=1
        )
    elif unavailable == "storage":
        inject_storage_outage(True)
    else:
        _memory_order_evidence[evidence]["status"] = unavailable
    response = await client.post(
        f"/api/public/orders/{order['portal_token']}/payment-extraction",
        json={"evidence_id": evidence, "ai_opt_in": True},
        headers={"Idempotency-Key": "unavailable"},
    )
    assert response.status_code == (200 if unavailable == "storage" else 410)
    if unavailable == "storage":
        assert response.json()["available"] is False
    assert provider.calls == 0
