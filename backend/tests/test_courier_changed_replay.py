"""Courier operation retries must project later local changes without new bookings."""
import pytest
from courier_reconciliation_support import offline_settings, reconcile, unknown_attempt  # noqa: F401
from test_courier_drafts import confirm_automatically, parcel_order
from test_courier_reconciliation_replay import resolution_payload
from test_courier_review import ready_review
from test_public_order_routes import clean_memory_stores, seller_identity  # noqa: F401
from transaction_route_support import clean_stores  # noqa: F401


async def verify_changed_replay(client, monkeypatch, operation, change, connection=None):
    from app.services import pathao_provider
    from app.services.courier_attempts import _memory_attempts
    from app.services.courier_reconciliation import _memory_reconciliations

    if operation == 'reconciliation':
        order, review_path, ready, attempt = await unknown_attempt(client, monkeypatch, 'changed-replay')
        payload = resolution_payload(order, ready, attempt, 'attach_existing')
    else:
        order = await parcel_order(client, 'changed-replay', parcel_weight_grams=1000, parcel_quantity=2)
        await confirm_automatically(client, order, 'CHANGED-REPLAY')
        review_path, ready, _ = await ready_review(client, order)
        assert (await client.post(review_path, json={'expected_token': ready['token']})).status_code == 200
        payload = {'expected_token': ready['token']}
    endpoint = f"/api/seller/orders/{order['id']}/courier-{operation}"
    first = await client.post(endpoint, json=payload, headers={'Idempotency-Key': 'original-operation'})
    assert first.status_code == 200, first.text
    original = first.json()['latest_attempt']
    fresh = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    if change == 'correction':
        changed = await client.patch(
            f"/api/seller/orders/{order['id']}/buyer-details",
            json={'expected_version': fresh['version'], 'reason': 'Requested delivery correction',
                  'buyer_name': 'Updated recipient', 'contact_number': '01933333333',
                  'address': {'raw_text': 'Updated address, Dhaka'}},
            headers={'Idempotency-Key': 'local-change'},
        )
    else:
        changed = await client.post(
            f"/api/seller/orders/{order['id']}/decisions",
            json={'action': 'cancel', 'expected_version': fresh['version'], 'reason': 'Buyer cancelled'},
            headers={'Idempotency-Key': 'local-change'},
        )
    assert changed.status_code == 200, changed.text

    async def unexpected_io(*args, **kwargs):
        raise AssertionError('Replay must not perform booking or evidence lookup')

    monkeypatch.setattr(pathao_provider, 'submit_booking', unexpected_io)
    monkeypatch.setattr(pathao_provider, 'lookup_booking', unexpected_io)
    replay = await client.post(endpoint, json=payload, headers={'Idempotency-Key': 'original-operation'})
    assert replay.status_code == 200, replay.text
    assert replay.json()['latest_attempt'] == original
    assert replay.json()['delivery_mismatch']['cancelled'] == (change == 'cancellation')
    assert replay.json()['delivery_mismatch']['recipient_name_changed'] == (change == 'correction')
    assert replay.json() == (await client.get(review_path)).json()
    if connection is None:
        assert len(_memory_attempts[order['id']]) == 1
        if operation == 'reconciliation':
            assert len(_memory_reconciliations[original['id']]) == 1
    else:
        assert await connection.fetchval(
            'SELECT count(*) FROM courier_attempts WHERE order_id = $1', order['id'],
        ) == 1
        if operation == 'reconciliation':
            assert await connection.fetchval(
                'SELECT count(*) FROM courier_reconciliations WHERE attempt_id = $1', original['id'],
            ) == 1


@pytest.mark.usefixtures('seller_identity')
@pytest.mark.parametrize('operation', ['submission', 'reconciliation'])
@pytest.mark.parametrize('change', ['correction', 'cancellation'])
async def test_replay_projects_later_local_changes(client, monkeypatch, operation, change):
    await verify_changed_replay(client, monkeypatch, operation, change)


@pytest.mark.parametrize('operation', ['submission', 'reconciliation'])
@pytest.mark.parametrize('change', ['correction', 'cancellation'])
async def test_postgres_replay_projects_later_local_changes(postgres_buyer, monkeypatch, operation, change):
    client, connection, _, _ = postgres_buyer
    await verify_changed_replay(client, monkeypatch, operation, change, connection)
