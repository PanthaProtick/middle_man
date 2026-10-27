"""Private HTTP surface sweep with two locally signed identities, never live credentials."""
import re
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from test_public_order_routes import _create_test_order, clean_memory_stores  # noqa: F401
from test_seller_auth_integration import _generate_rsa_key_pair, _make_token
from test_transaction_routes import clean_stores  # noqa: F401

import app.core.auth as auth_module
from app.core.auth import ClerkTokenVerifier
from app.core.config import settings


@pytest.mark.asyncio
async def test_signed_identities_cannot_read_or_mutate_foreign_private_surfaces(client, monkeypatch):
    issuer = 'https://clerk.isolation.example.com'
    key, jwk = _generate_rsa_key_pair()
    monkeypatch.setattr(settings, 'CLERK_ISSUER', issuer)
    monkeypatch.setattr(auth_module, '_clerk_verifier', ClerkTokenVerifier(issuer=issuer, jwks={'keys': [jwk]}))
    identities = [_make_token(key, sub=owner, issuer=issuer) for owner in ('alpha', 'beta')]
    orders = []
    receipts = []
    for token in identities:
        client.headers['Authorization'] = f'Bearer {token}'
        order = await _create_test_order(client)
        orders.append(order)
        submission = await client.post(f"/api/public/orders/{order['portal_token']}/submission", json={
            'buyer_name': 'Synthetic Private Buyer', 'contact_number': '01799999999',
            'address': {'raw_text': 'Synthetic Dhaka Address'},
            'payment_claim': {'provider': 'bkash', 'trx_id': 'CLAIM-ISOLATION',
                'sender_number': '01788888888', 'amount_minor': 200000},
        }, headers={'Idempotency-Key': 'isolation-submission'})
        assert submission.status_code == 200, submission.text
        receipt = await client.post('/api/seller/transactions', json={
            'payment_account_id': order['payment_account_id'], 'provider': 'bkash',
            'trx_id': 'RECEIPT-ISOLATION', 'amount_minor': 200000,
        }, headers={'Idempotency-Key': 'isolation-receipt'})
        assert receipt.status_code == 201, receipt.text
        receipts.append(receipt.json())

    for index, token in enumerate(identities):
        client.headers['Authorization'] = f'Bearer {token}'
        own, foreign = orders[index], orders[1 - index]
        receipt = receipts[1 - index]
        # Positive controls ensure denials are ownership checks, not unavailable fixtures.
        assert (await client.get(f"/api/seller/orders/{own['id']}")).status_code == 200
        cases = [
            ('GET', '/orders/{id}', None, foreign['id']),
            ('GET', '/orders/{id}/history', None, foreign['id']),
            ('GET', '/orders/{id}/payment-decisions', None, foreign['id']),
            ('GET', '/orders/{id}/summary', None, foreign['id']),
            ('GET', f"/orders/{{id}}/payment-preview?transaction_id={receipt['id']}", None, foreign['id']),
            ('PATCH', '/orders/{id}/buyer-details',
                {'expected_version': 1, 'reason': 'Foreign correction', 'buyer_name': 'Intruder'}, foreign['id']),
            ('POST', '/orders/{id}/decisions',
                {'action': 'cancel', 'expected_version': 1, 'reason': 'Foreign cancellation'}, foreign['id']),
            ('POST', '/orders/{id}/replacement', {'expected_version': 1, 'reason': 'Foreign replacement',
                'order': {'product_name': 'Replacement', 'total_minor': 1200000, 'required_advance_minor': 200000,
                    'payment_account_id': own['payment_account_id']}}, foreign['id']),
            ('PATCH', '/payment-accounts/{id}', {'label': 'Intruder', 'expected_version': 1}, foreign['payment_account_id']),
            ('GET', '/transactions/{id}', None, receipt['id']),
            ('PATCH', '/transactions/{id}',
                {'expected_version': 1, 'reason': 'Foreign correction', 'amount_minor': 100}, receipt['id']),
            ('POST', '/transactions/{id}/resolve', {'expected_version': 1, 'reason': 'Foreign resolution',
                'selected_observation_id': receipt['observations'][0]['id']}, receipt['id']),
        ]
        for method, path, payload, foreign_id in cases:
            results = []
            for resource_id in (foreign_id, str(uuid.uuid4())):
                response = await client.request(method, '/api/seller' + path.format(id=resource_id),
                    json=payload, headers={'Idempotency-Key': str(uuid.uuid4())})
                assert response.status_code == 404, (method, path, response.text)
                results.append(response.json()['error'])
            assert results[0] == results[1], (method, path, 'Foreign existence disclosed')
        for route, field, expected in (
            ('/orders', 'items', own['id']), ('/transactions', 'items', receipts[index]['id']),
        ):
            result = (await client.get('/api/seller' + route)).json()
            assert [row['id'] for row in result[field]] == [expected]
        accounts = (await client.get('/api/seller/payment-accounts')).json()
        assert [row['id'] for row in accounts] == [own['payment_account_id']]
        exported = await client.get('/api/seller/orders/export')
        assert exported.status_code == 200
        assert own['id'] in exported.text and foreign['id'] not in exported.text
        resolved = await client.post('/api/seller/order-links/resolve', json={'portal_token': foreign['portal_token']})
        missing = await client.post('/api/seller/order-links/resolve', json={'portal_token': 'missing-token'})
        assert resolved.status_code == missing.status_code == 404
        assert resolved.json()['error'] == missing.json()['error']
        # Retention accepts no target shop; supplying one cannot broaden the operation.
        for route in ('/retention/cleanup', '/retention/structured/cleanup'):
            result = await client.post('/api/seller' + route, json={'shop_id': foreign['shop_id']})
            assert result.status_code == 200, result.text
        client.headers['Authorization'] = f'Bearer {identities[1 - index]}'
        assert (await client.get(f"/api/seller/orders/{foreign['id']}")).status_code == 200

    # Both shops must have eligible data: a global/no-op cleanup would otherwise pass.
    for index, token in enumerate(identities):
        client.headers['Authorization'] = f'Bearer {token}'
        path = f"/api/seller/orders/{orders[index]['id']}"
        version = (await client.get(path)).json()['version']
        cancelled = await client.post(path + '/decisions', json={
            'action': 'cancel', 'expected_version': version, 'reason': 'Synthetic retention test',
        }, headers={'Idempotency-Key': 'retention-cancel'})
        assert cancelled.status_code == 200, cancelled.text
    future = datetime.now(timezone.utc) + timedelta(days=400)
    monkeypatch.setattr('app.api.seller.get_utc_now', lambda: future)
    monkeypatch.setattr('app.api.structured_retention.get_utc_now', lambda: future)
    for index, token in enumerate(identities):
        client.headers['Authorization'] = f'Bearer {token}'
        cleaned = await client.post('/api/seller/retention/cleanup')
        assert cleaned.status_code == 200, cleaned.text
        removed = await client.post('/api/seller/retention/structured/cleanup')
        assert removed.status_code == 200, removed.text
        assert removed.json()['removed'] == 1
        assert (await client.get(f"/api/seller/orders/{orders[index]['id']}")).status_code == 410
        if index == 0:
            client.headers['Authorization'] = f'Bearer {identities[1]}'
            assert (await client.get(f"/api/seller/orders/{orders[1]['id']}")).status_code == 200



@pytest.mark.asyncio
@pytest.mark.parametrize('unavailable', [False, True])
async def test_every_private_route_preserves_auth_failure_distinction(client, monkeypatch, unavailable):
    from app.main import app

    monkeypatch.setattr(settings, 'CLERK_ISSUER', '')
    monkeypatch.setattr(settings, 'CLERK_JWT_KEY', '')
    monkeypatch.setattr(auth_module, '_clerk_verifier', None)
    if unavailable:
        client.headers['Authorization'] = 'Bearer signed.jwt.token'
    checked = 0
    for template, operations in app.openapi()['paths'].items():
        if not template.startswith('/api/seller/'):
            continue
        path = re.sub(r'\{[^}]+\}', lambda _: str(uuid.uuid4()), template)
        for method in operations:
            checked += 1
            response = await client.request(method, path, json={}, headers={'Idempotency-Key': 'auth-matrix'})
            assert response.status_code == (503 if unavailable else 401), (method, path, response.text)
            assert response.json()['error']['code'] == ('AUTH_UNAVAILABLE' if unavailable else 'UNAUTHORIZED')
    assert checked >= 20, 'Private route inventory unexpectedly empty or incomplete'
