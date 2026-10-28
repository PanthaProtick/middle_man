import datetime

import pytest
from test_transaction_search import _ids, _record


@pytest.mark.asyncio
async def test_postgres_recorded_dates_filter_before_keyset_paging(postgres_buyer) -> None:
    client, connection, _, order = postgres_buyer
    ids = []
    for index, timestamp in enumerate([
        '2026-10-26T17:59:59+00:00', '2026-10-26T18:00:00+00:00',
        '2026-10-27T17:59:59+00:00', '2026-10-27T18:00:00+00:00',
    ]):
        receipt = await _record(client, order['payment_account_id'], f'PG-DATE-{index}', occurred=None)
        ids.append(receipt['id'])
        await connection.execute('UPDATE received_transactions SET created_at = $1 WHERE id = $2',
                                 datetime.datetime.fromisoformat(timestamp), receipt['id'])
    params = {'from_date': '2026-10-27', 'to_date': '2026-10-27',
              'search': 'merchant', 'parse': 'incomplete', 'used': 'unmatched', 'limit': 1}
    page = (await client.get('/api/seller/transactions', params=params)).json()
    assert [row['id'] for row in page['items']] == [ids[2]]
    # Cursor ordering survives the anchor leaving the active reconciliation filter.
    await connection.execute("UPDATE received_transactions SET reconciliation_state = 'used' WHERE id = $1", ids[2])
    page = (await client.get('/api/seller/transactions', params={
        **params, 'cursor': page['next_cursor'],
    })).json()
    assert [row['id'] for row in page['items']] == [ids[1]]
    assert page['next_cursor'] is None
    # Retention also cannot turn a valid ordering anchor into a first-page restart.
    params.pop('used')
    page = (await client.get('/api/seller/transactions', params=params)).json()
    assert [row['id'] for row in page['items']] == [ids[2]]
    await connection.execute('UPDATE received_transactions SET retained_at = now() WHERE id = $1', ids[2])
    page = (await client.get('/api/seller/transactions', params={
        **params, 'cursor': page['next_cursor'],
    })).json()
    assert [row['id'] for row in page['items']] == [ids[1]]
    assert page['next_cursor'] is None


@pytest.mark.asyncio
async def test_postgres_search_matches_fields_pages_and_skips_retained(postgres_buyer) -> None:
    client, connection, _, order = postgres_buyer
    account_id = order['payment_account_id']
    matching: list[str] = []
    for index in range(3):
        receipt = await _record(
            client, account_id, f'PG-SEARCH-{index}', sender='01799998877', amount=20000 + index
        )
        matching.append(receipt['id'])
    other = await _record(client, account_id, 'PG-OTHER', sender='01812345678')

    assert await _ids(client, search=' pg-search-1 ') == [matching[1]]
    assert await _ids(client, search=matching[2].upper()) == [matching[2]]
    assert await _ids(client, search='PG-SEARCH') == []
    assert set(await _ids(client, search='merchant primary')) == {*matching, other['id']}
    assert set(await _ids(client, search='+880 1799-998877')) == set(matching)
    assert await _ids(client, search='0179') == []
    # The fixture account receiving number identifies every receipt on that account.
    assert set(await _ids(client, search='01712345678')) == {*matching, other['id']}

    paged: list[str] = []
    cursor = None
    while True:
        params: dict[str, object] = {'search': 'merchant', 'limit': 2}
        if cursor:
            params['cursor'] = cursor
        page = (await client.get('/api/seller/transactions', params=params)).json()
        paged.extend(item['id'] for item in page['items'])
        cursor = page['next_cursor']
        if not cursor:
            break
    assert sorted(paged) == sorted([*matching, other['id']])

    await connection.execute(
        'UPDATE received_transactions SET retained_at = now() WHERE id = $1', matching[0]
    )
    assert matching[0] not in await _ids(client, search=matching[0])
    assert await _ids(client, search='PG-SEARCH-0') == []


@pytest.mark.asyncio
async def test_postgres_search_never_leaks_another_shops_account_identity(postgres_buyer) -> None:
    client, connection, _, order = postgres_buyer
    shop_id = await connection.fetchval('SELECT id FROM shops LIMIT 1')
    owned = await _record(client, order['payment_account_id'], 'OWNED-TRX', sender='01799998877')
    await connection.execute(
        "INSERT INTO shops (id, owner_id, display_name, created_at, updated_at) "
        "VALUES ('foreign-shop', 'foreign-owner', 'Foreign Shop', now(), now())"
    )
    await connection.execute(
        "INSERT INTO payment_accounts (id, shop_id, provider, receiving_number, label, is_active, version, created_at, updated_at) "
        "VALUES ('foreign-account', 'foreign-shop', 'nagad', '01855556666', 'Foreign Nagad', true, 1, now(), now())"
    )
    # The seller's own receipt must not become findable through another shop's account identity.
    await connection.execute(
        "INSERT INTO received_transactions (id, shop_id, payment_account_id, provider, trx_id, amount_minor, "
        "sender_number_canonical, reconciliation_state, has_conflict, version, created_at, updated_at) "
        "VALUES ('cross-account-receipt', $1, 'foreign-account', 'nagad', 'CROSS-ACCOUNT-TRX', 5000, "
        "'01911112222', 'unmatched', false, 1, now(), now())",
        shop_id,
    )
    await connection.execute(
        "INSERT INTO received_transactions (id, shop_id, payment_account_id, provider, trx_id, amount_minor, "
        "sender_number_canonical, reconciliation_state, has_conflict, version, created_at, updated_at) "
        "VALUES ('foreign-receipt', 'foreign-shop', 'foreign-account', 'nagad', 'FOREIGN-TRX', 5000, "
        "'01911112222', 'unmatched', false, 1, now(), now())"
    )

    assert await _ids(client, search='foreign nagad') == []
    assert await _ids(client, search='01855556666') == []
    # The shop's own record stays findable by its own identifier.
    assert await _ids(client, search='CROSS-ACCOUNT-TRX') == ['cross-account-receipt']
    # Another shop's receipt is never visible, even by its exact identifiers.
    assert await _ids(client, search='FOREIGN-TRX') == []
    assert await _ids(client, search='foreign-receipt') == []
    assert await _ids(client, search='owned-trx') == [owned['id']]
