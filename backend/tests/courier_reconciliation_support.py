"""Shared HTTP helpers and fixtures for courier reconciliation tests."""
import pytest
from test_courier_drafts import confirm_automatically, parcel_order
from test_courier_review import ready_review


@pytest.fixture(autouse=True)
def offline_settings(monkeypatch):
    from app.core.config import settings
    from app.services import courier_reconciliation
    from app.services.courier_attempts import _memory_attempts
    from app.services.pathao_connections import _memory
    monkeypatch.setattr(settings, 'SELF_TEST_MODE', False)
    monkeypatch.setattr(settings, 'PATHAO_LOCATION_ENVIRONMENT', 'offline')
    _memory.clear()
    _memory_attempts.clear()
    courier_reconciliation._memory_reconciliations.clear()
    yield
    _memory.clear()
    _memory_attempts.clear()
    courier_reconciliation._memory_reconciliations.clear()


def offline_consignment(shop_id: str, order_id: str, store_id: int) -> str:
    from app.services.pathao_provider import simulated_consignment
    return simulated_consignment(shop_id, order_id, store_id)


async def unknown_attempt(client, monkeypatch, key: str):
    from app.services import pathao_provider

    order = await parcel_order(client, f'{key}-order', parcel_weight_grams=1000, parcel_quantity=2)
    await confirm_automatically(client, order, f'{key}-receipt')
    path, ready, _ = await ready_review(client, order)
    assert (await client.post(path, json={'expected_token': ready['token']})).status_code == 200

    async def timeout_booking(*args, **kwargs):
        raise TimeoutError('Synthetic submission timeout.')

    with monkeypatch.context() as patch:
        patch.setattr(pathao_provider, 'submit_booking', timeout_booking)
        submitted = await client.post(
            f"/api/seller/orders/{order['id']}/courier-submission",
            json={'expected_token': ready['token']},
            headers={'Idempotency-Key': f'{key}-timeout'},
        )
    assert submitted.status_code in (504, 502, 503), submitted.text
    review = (await client.get(path)).json()
    assert review['latest_attempt']['status'] == 'unknown'
    assert review['submission_enabled'] is False
    return order, path, ready, review['latest_attempt']


async def reconcile(client, order, payload, key: str):
    return await client.post(
        f"/api/seller/orders/{order['id']}/courier-reconciliation",
        json=payload,
        headers={'Idempotency-Key': key},
    )
