import pytest
from httpx import AsyncClient
from test_transaction_routes import _setup_shop_and_account
from test_transaction_routes import (  # noqa: F401
    clean_stores as clean_stores,
)
from test_transaction_routes import (
    second_seller_client as second_seller_client,
)
from test_transaction_routes import (
    seller_client as seller_client,
)


async def _record(
    client: AsyncClient,
    account_id: str,
    trx_id: str,
    *,
    sender: str | None = '01712345678',
    occurred: str | None = '2026-10-24T10:00:00Z',
    amount: int = 10000,
    provider: str = 'bkash',
    expected: int = 201,
) -> dict:
    response = await client.post(
        '/api/seller/transactions',
        json={
            'payment_account_id': account_id,
            'provider': provider,
            'trx_id': trx_id,
            'amount_minor': amount,
            'sender_number': sender,
            'occurred_at': occurred,
        },
    )
    assert response.status_code == expected, response.text
    return response.json()


async def _ids(client: AsyncClient, **params: object) -> list[str]:
    response = await client.get('/api/seller/transactions', params=params)
    assert response.status_code == 200, response.text
    return [item['id'] for item in response.json()['items']]


@pytest.mark.asyncio
async def test_search_matches_exact_trx_and_receipt_ids(seller_client: AsyncClient) -> None:
    setup = await _setup_shop_and_account(seller_client)
    receipt = await _record(seller_client, setup['account_id'], 'TRX-ALPHA')
    await _record(seller_client, setup['account_id'], 'TRX-BETA')

    assert await _ids(seller_client, search='  trx-alpha ') == [receipt['id']]
    assert await _ids(seller_client, search=f' {receipt["id"].upper()} ') == [receipt['id']]
    assert await _ids(seller_client, search='TRX-ALP') == []
    assert await _ids(seller_client, search=receipt['id'][:8]) == []
    assert set(await _ids(seller_client, search='   ')) == set(
        item['id'] for item in (await seller_client.get('/api/seller/transactions')).json()['items']
    )

@pytest.mark.asyncio
async def test_search_normalizes_full_payment_sender_numbers(seller_client: AsyncClient) -> None:
    setup = await _setup_shop_and_account(seller_client)
    sender = await _record(seller_client, setup['account_id'], 'SENDER-TRX', sender='01799998877')
    await _record(seller_client, setup['account_id'], 'OTHER-SENDER', sender='01812345678')

    for term in ('+880 1799-998877', '8801799998877', '০১৭৯৯৯৯৮৮৭৭', '01799998877'):
        assert await _ids(seller_client, search=term) == [sender['id']], term
    for fragment in ('0179', '1799998877', '0179999'):
        assert await _ids(seller_client, search=fragment) == [], fragment


@pytest.mark.asyncio
async def test_search_matches_receiving_account_identity_within_shop(
    seller_client: AsyncClient, second_seller_client: AsyncClient
) -> None:
    setup = await _setup_shop_and_account(seller_client, receiving_number='01711111111')
    second_account = await seller_client.post(
        '/api/seller/payment-accounts',
        json={'provider': 'nagad', 'receiving_number': '01822223333', 'label': 'Shop Nagad'},
    )
    assert second_account.status_code == 201, second_account.text
    nagad_account_id = second_account.json()['id']
    receipt = await _record(
        seller_client, nagad_account_id, 'NAGAD-RECEIPT', sender='01911112222', provider='nagad'
    )
    await _record(seller_client, setup['account_id'], 'BKASH-RECEIPT', sender='01911112222')

    assert await _ids(seller_client, search='shop nagad') == [receipt['id']]
    assert await _ids(seller_client, search=' +880 1822-223333 ') == [receipt['id']]
    assert await _ids(seller_client, search='0182222') == []
    assert await _ids(seller_client, search='Primary bKash') != []
    assert receipt['id'] not in await _ids(seller_client, search='Primary bKash')

    setup_b = await _setup_shop_and_account(
        second_seller_client, display_name='Shop B', receiving_number='01855556666'
    )
    await _record(second_seller_client, setup_b['account_id'], 'FOREIGN-TRX', sender='01700000000')

    assert await _ids(seller_client, search='FOREIGN-TRX') == []
    assert await _ids(seller_client, search='01855556666') == []

async def _add_account(client: AsyncClient, provider: str, number: str, label: str) -> str:
    response = await client.post(
        '/api/seller/payment-accounts',
        json={'provider': provider, 'receiving_number': number, 'label': label},
    )
    assert response.status_code == 201, response.text
    return response.json()['id']


@pytest.mark.asyncio
async def test_search_combines_with_reconciliation_filters_and_excludes_retained(
    seller_client: AsyncClient,
) -> None:
    from app.core.tokens import get_utc_now
    from app.services.transaction_store import _memory_transactions

    setup = await _setup_shop_and_account(seller_client)
    account_id = setup['account_id']
    complete = await _record(seller_client, account_id, 'FILTER-COMPLETE')
    conflicted = await _record(seller_client, account_id, 'FILTER-CONFLICT', sender='01812345678')
    await _record(seller_client, account_id, 'FILTER-CONFLICT', sender='01812345678', amount=90000, expected=200)
    incomplete = await _record(
        seller_client, account_id, 'FILTER-INCOMPLETE', sender=None, occurred=None
    )
    used = await _record(seller_client, account_id, 'FILTER-USED', sender='01912345678')
    _memory_transactions[used['id']]['reconciliation_state'] = 'used'

    assert set(await _ids(seller_client, search='primary', review='conflicted')) == {conflicted['id']}
    assert await _ids(seller_client, search='primary', review='incomplete') == [incomplete['id']]
    # The inbox's Incomplete option sends parse=incomplete, not review.
    assert await _ids(seller_client, search='primary', parse='incomplete') == [incomplete['id']]
    assert await _ids(seller_client, search='FILTER-INCOMPLETE', parse='incomplete') == [incomplete['id']]
    assert await _ids(seller_client, search='FILTER-INCOMPLETE', parse='valid') == []
    assert await _ids(seller_client, search='primary', used='used') == [used['id']]
    assert set(await _ids(seller_client, search='primary', parse='valid')) == {
        complete['id'], conflicted['id'], used['id'],
    }
    assert await _ids(seller_client, search='FILTER-USED', used='unmatched') == []
    assert await _ids(seller_client, search='FILTER-USED', used='used') == [used['id']]

    _memory_transactions[complete['id']]['retained_at'] = get_utc_now()
    assert await _ids(seller_client, search='FILTER-COMPLETE') == []
    assert await _ids(seller_client, search='FILTER-USED') == [used['id']]


@pytest.mark.asyncio
async def test_search_filters_before_pagination_and_keeps_the_cursor_query(
    seller_client: AsyncClient,
) -> None:
    setup = await _setup_shop_and_account(seller_client)
    first_account = setup['account_id']
    second_account = await _add_account(
        seller_client, 'nagad', '01822223333', 'Second Nagad'
    )
    matching: list[str] = []
    for index in range(6):
        receipt = await _record(seller_client, first_account, f'PRIMARY-{index}', amount=10000 + index)
        matching.append(receipt['id'])
        await _record(
            seller_client, second_account, f'SECOND-{index}', amount=50000 + index,
            sender='01822223333', provider='nagad',
        )

    seen: list[str] = []
    cursor: str | None = None
    while True:
        params: dict[str, object] = {'search': 'primary bKash', 'limit': 2}
        if cursor:
            params['cursor'] = cursor
        page = (await seller_client.get('/api/seller/transactions', params=params)).json()
        seen.extend(item['id'] for item in page['items'])
        cursor = page['next_cursor']
        if not cursor:
            break
        assert len(page['items']) == 2

    assert sorted(seen) == sorted(matching)
    single = (
        await seller_client.get('/api/seller/transactions', params={'search': 'primary bKash', 'limit': 10})
    ).json()
    assert single['next_cursor'] is None


@pytest.mark.asyncio
async def test_search_ignores_raw_sms_text_and_never_matches_missing_senders(
    seller_client: AsyncClient,
) -> None:
    setup = await _setup_shop_and_account(seller_client)
    sms = 'bKash: You have received Tk 150.00 from 01799998877. TrxID SYNTHETIC1 at 2026-10-24T12:00:00+06:00'
    imported = await seller_client.post(
        '/api/seller/transactions/sms-import',
        json={'payment_account_id': setup['account_id'], 'messages': [sms]},
        headers={'Idempotency-Key': 'search-sms'},
    )
    assert imported.status_code == 200, imported.text
    receipt_id = imported.json()['items'][0]['receipt_id']

    assert await _ids(seller_client, search='SYNTHETIC1') == [receipt_id]
    assert await _ids(seller_client, search='received Tk') == []
    assert await _ids(seller_client, search='bKash: You have received') == []

    await _record(seller_client, setup['account_id'], 'NO-SENDER', sender=None, occurred=None)
    assert await _ids(seller_client, search='01') == []

    overlong = await seller_client.get('/api/seller/transactions', params={'search': 'x' * 201})
    assert overlong.status_code == 422
