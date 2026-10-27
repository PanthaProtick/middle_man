"""Receipt failures and lost responses must not strand a resolved memory attempt."""
import pytest
from courier_reconciliation_support import (  # noqa: F401
    offline_consignment,
    offline_settings,
    reconcile,
    unknown_attempt,
)
from test_public_order_routes import clean_memory_stores, seller_identity  # noqa: F401
from test_transaction_routes import clean_stores  # noqa: F401


def resolution_payload(order, ready, attempt, action):
    payload = {'attempt_id': attempt['id'], 'expected_version': 0, 'action': action}
    if action == 'attach_existing':
        payload.update(
            environment='offline', merchant_order_id=order['id'],
            consignment_id=offline_consignment(order['shop_id'], order['id'], ready['choices']['store_id']),
        )
    return payload


def inject_failure(patch, phase):
    from app.services import courier_reconciliation_replay, courier_review

    async def fail(*args, **kwargs):
        raise RuntimeError('Injected resolution failure')

    if phase == 'receipt':
        patch.setattr(courier_reconciliation_replay, 'save_idempotency_record', fail)
    elif phase == 'after_receipt':
        save = courier_reconciliation_replay.ReconciliationReplay.save

        async def fail_after_receipt(self, db):
            await save(self, db)
            raise RuntimeError('Injected resolution failure')

        patch.setattr(courier_reconciliation_replay.ReconciliationReplay, 'save', fail_after_receipt)
    elif phase == 'review':
        patch.setattr(courier_review, 'read', fail)
    else:
        patch.setattr(courier_reconciliation_replay, 'finalize_idempotency_record', fail)


@pytest.mark.usefixtures('seller_identity')
@pytest.mark.parametrize('action', ['attach_existing', 'confirm_noncreation'])
@pytest.mark.parametrize('phase', ['receipt', 'review', 'finalize'])
async def test_memory_resolution_retries_across_failure_windows(client, monkeypatch, action, phase):
    from app.services.courier_reconciliation import _memory_reconciliations

    order, path, ready, attempt = await unknown_attempt(client, monkeypatch, f'replay-{action}-{phase}')
    payload = resolution_payload(order, ready, attempt, action)
    with monkeypatch.context() as patch:
        inject_failure(patch, phase)
        with pytest.raises(RuntimeError, match='Injected resolution failure'):
            await reconcile(client, order, payload, 'replay-failure')

    committed = phase != 'receipt'
    current = (await client.get(path)).json()
    assert current['latest_attempt']['status'] == (
        ('success' if action == 'attach_existing' else 'failed') if committed else 'unknown'
    )
    assert len(_memory_reconciliations.get(attempt['id'], [])) == int(committed)
    recovered = await reconcile(client, order, payload, 'replay-failure')
    assert recovered.status_code == 200, recovered.text
    assert recovered.json()['latest_attempt']['resolution_version'] == 1
    assert len(_memory_reconciliations[attempt['id']]) == 1
    replay = await reconcile(client, order, payload, 'replay-failure')
    assert replay.status_code == 200
    assert replay.json() == recovered.json()
