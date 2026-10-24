import asyncio

from test_order_export import check_buyer_csv

from app.core.auth import SellerIdentity, get_seller_identity
from app.main import app


async def test_postgres_export_buyer_and_balances(postgres_buyer):
    client, _, _, order = postgres_buyer
    await check_buyer_csv(client, order)


async def test_postgres_export_budget_survives_sessions(postgres_buyer):
    client, _, _, order = postgres_buyer
    for _ in range(10):
        response = await client.get('/api/seller/orders/export')
        assert response.status_code == 200, response.text
        assert order['id'] in response.text
    limited = await client.get('/api/seller/orders/export')
    assert limited.status_code == 429
    assert limited.json()['error']['code'] == 'EXPORT_RATE_LIMIT'


async def test_postgres_scope_and_unavailable_error(postgres_buyer):
    client, connection, _, order = postgres_buyer
    await connection.execute("""CREATE FUNCTION refuse_exports() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'synthetic export outage'; END $$;
        CREATE TRIGGER refuse_exports BEFORE INSERT ON audit_events
        FOR EACH ROW WHEN (NEW.action = 'order_export') EXECUTE FUNCTION refuse_exports();""")
    response = await client.get('/api/seller/orders/export')
    assert response.status_code == 503
    assert response.json()['error']['code'] == 'EXPORT_UNAVAILABLE'
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id='foreign-export')
    response = await client.get('/api/seller/orders/export')
    assert response.status_code == 200
    assert order['id'] not in response.text
    assert (await client.get(f"/api/seller/orders/{order['id']}/summary")).status_code == 404


async def test_postgres_concurrent_exports_admit_only_ten(postgres_buyer):
    client, _, _, _ = postgres_buyer
    results = await asyncio.gather(*(client.get('/api/seller/orders/export') for _ in range(11)))
    assert sorted(result.status_code for result in results) == [200] * 10 + [429]
