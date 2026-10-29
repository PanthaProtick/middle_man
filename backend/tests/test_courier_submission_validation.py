"""Courier snapshot validation, malformed outcomes, and error privacy boundaries."""
import pytest
from courier_submission_support import offline_settings  # noqa: F401
from test_courier_drafts import confirm_automatically, parcel_order
from test_courier_review import ready_review
from test_public_order_routes import clean_memory_stores, seller_identity  # noqa: F401
from transaction_route_support import clean_stores  # noqa: F401


@pytest.mark.usefixtures('seller_identity')
async def test_courier_boundary_validates_snapshot_and_handles_malformed_response(client, monkeypatch):
    from app.models.courier_submission import CourierBookingSnapshot
    from app.services.pathao_provider import CourierDefinitiveFailure, submit_booking

    valid_snapshot = CourierBookingSnapshot(
        order_id='ord-1', recipient_name='Buyer', recipient_phone='01711111111',
        recipient_address='House 1, Road 2, Dhanmondi', city_id=1, zone_id=10, area_id=100,
        store_id=1, delivery_type=48, item_weight_grams=500, item_quantity=1,
        amount_to_collect_bdt=100, remaining_cod_minor=10000,
    )

    bad_phone = valid_snapshot.model_copy(update={'recipient_phone': '123'})
    with pytest.raises(CourierDefinitiveFailure, match='phone is invalid'):
        await submit_booking('shop-1', 'offline', bad_phone)

    bad_address = valid_snapshot.model_copy(update={'recipient_address': ' '})
    with pytest.raises(CourierDefinitiveFailure, match='address is incomplete'):
        await submit_booking('shop-1', 'offline', bad_address)

    bad_loc = valid_snapshot.model_copy(update={'store_id': 0})
    with pytest.raises(CourierDefinitiveFailure, match='Pickup store'):
        await submit_booking('shop-1', 'offline', bad_loc)

    bad_qty = valid_snapshot.model_copy(update={'item_quantity': 0})
    with pytest.raises(CourierDefinitiveFailure, match='quantity must be positive'):
        await submit_booking('shop-1', 'offline', bad_qty)


@pytest.mark.usefixtures('seller_identity')
@pytest.mark.parametrize('scenario', ['empty-consignment', 'wrong-order', 'inconsistent-simulation'])
async def test_submission_malformed_success_classified_as_unknown(client, monkeypatch, scenario):
    from app.services import pathao_provider

    order = await parcel_order(client, f'malformed-{scenario}', parcel_weight_grams=500, parcel_quantity=1)
    await confirm_automatically(client, order, f'MALFORMED-{scenario.upper()}')
    path, ready, _ = await ready_review(client, order)
    approved = await client.post(path, json={'expected_token': ready['token']})
    assert approved.status_code == 200

    cid = '' if scenario == 'empty-consignment' else 'SIM-PATHAO-VALID'
    moid = 'wrong-order' if scenario == 'wrong-order' else order['id']
    sim = False if scenario == 'inconsistent-simulation' else True

    async def malformed_provider(*args):
        return pathao_provider.CourierBookingResult(
            consignment_id=cid,
            merchant_order_id=moid,
            is_simulated=sim,
        )

    monkeypatch.setattr(pathao_provider, 'submit_booking', malformed_provider)

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    res = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': f'key-{scenario}'},
    )
    assert res.status_code == 504, res.text
    assert res.json()['error']['code'] == 'COURIER_OUTCOME_UNKNOWN'

    review = (await client.get(path)).json()
    assert review['latest_attempt'] is not None
    assert review['latest_attempt']['status'] == 'unknown'
    assert review['latest_attempt']['error_code'] == 'MALFORMED_SUCCESS'


@pytest.mark.usefixtures('seller_identity')
@pytest.mark.parametrize('definitive,message', [
    (False, 'SECRET_PROVIDER_TOKEN=synthetic-secret-leak-12345'),
    (True, 'SECRET_PROVIDER_TOKEN=synthetic-secret-leak-12345'),
    (True, 'Rejected payload: synthetic-private-value, 01711111111, House 42'),
])
async def test_submission_error_privacy_sanitizes_raw_exceptions(client, monkeypatch, definitive, message):
    from app.services import pathao_provider

    order = await parcel_order(client, 'privacy-test', parcel_weight_grams=500, parcel_quantity=1)
    await confirm_automatically(client, order, 'PRIVACY-TEST')
    path, ready, _ = await ready_review(client, order)
    approved = await client.post(path, json={'expected_token': ready['token']})
    assert approved.status_code == 200

    async def leaking_provider(*args):
        error_type = pathao_provider.CourierDefinitiveFailure if definitive else RuntimeError
        raise error_type(message)

    monkeypatch.setattr(pathao_provider, 'submit_booking', leaking_provider)

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    res = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'key-privacy'},
    )
    assert res.status_code == (422 if definitive else 504), res.text
    assert message not in res.text

    current = await client.get(path)
    assert current.status_code == 200
    assert message not in current.text, current.text
    review = current.json()
    assert review['latest_attempt']['status'] == ('failed' if definitive else 'unknown')
    assert review['latest_attempt']['error_code'] == ('COURIER_REJECTED' if definitive else 'COURIER_OUTCOME_UNKNOWN')
    assert review['submission_enabled'] is definitive
    from app.services.courier_attempts import _memory_attempts
    stored = _memory_attempts[order['id']][-1]
    assert message not in str(stored)
    if definitive:
        assert stored['error_message'] == 'Courier rejected booking. Review delivery details before trying again.'
    else:
        assert 'unexpected' in stored['error_message']
