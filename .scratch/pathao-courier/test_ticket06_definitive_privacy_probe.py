"""Temporary acceptance probes for ticket 06."""
import pytest
from test_courier_submission import offline_settings  # noqa: F401
from test_courier_drafts import confirm_automatically, parcel_order
from test_courier_review import ready_review
from test_public_order_routes import clean_memory_stores, seller_identity  # noqa: F401
from test_transaction_routes import clean_stores  # noqa: F401


@pytest.mark.usefixtures('seller_identity')
@pytest.mark.parametrize('scenario', ['malformed', 'private-error'])
async def test_submission_acceptance_probe(client, monkeypatch, scenario):
    from app.services import pathao_provider
    order = await parcel_order(client, 'probe-' + scenario, parcel_weight_grams=500, parcel_quantity=1)
    await confirm_automatically(client, order, 'PROBE-' + scenario)
    path, ready, _ = await ready_review(client, order)
    assert (await client.post(path, json={'expected_token': ready['token']})).status_code == 200

    async def provider(*args):
        if scenario == 'private-error':
            raise pathao_provider.CourierDefinitiveFailure('Rejected payload: synthetic-private-value, 01711111111, House 42')
        return pathao_provider.CourierBookingResult(
            consignment_id='', merchant_order_id='wrong-order', is_simulated=False,
        )

    monkeypatch.setattr(pathao_provider, 'submit_booking', provider)
    result = await client.post(path.replace('courier-review', 'courier-submission'),
                               json={'expected_token': ready['token']},
                               headers={'Idempotency-Key': 'probe-' + scenario})
    current = await client.get(path)
    if scenario == 'malformed':
        assert result.status_code == 504, result.text
        assert current.json()['latest_attempt']['status'] == 'unknown'
    else:
        assert 'synthetic-private-value' not in current.text, current.text

