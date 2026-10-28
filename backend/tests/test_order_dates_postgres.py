import datetime

from test_order_search import _create_order

_UTC = datetime.timezone.utc


async def test_postgres_order_dates_match_list_and_export(postgres_buyer):
    client, connection, _, order = postgres_buyer
    in_range = await _create_order(
        client, order["payment_account_id"], "Dated Keyboard", "pg-date-in"
    )
    outside = await _create_order(
        client, order["payment_account_id"], "Dated Outside", "pg-date-out"
    )
    for created_at, order_id in (
        (datetime.datetime(2026, 10, 19, 18, tzinfo=_UTC), in_range["id"]),
        (datetime.datetime(2026, 10, 20, 18, tzinfo=_UTC), outside["id"]),
    ):
        await connection.execute(
            "UPDATE orders SET created_at = $1 WHERE id = $2", created_at, order_id
        )

    listing = await client.get(
        "/api/seller/orders",
        params={"from_date": "2026-10-20", "to_date": "2026-10-20"},
    )
    assert listing.status_code == 200, listing.text
    assert [item["id"] for item in listing.json()["items"]] == [in_range["id"]]

    exported = await client.get(
        "/api/seller/orders/export",
        params={"from_date": "2026-10-20", "to_date": "2026-10-20"},
    )
    assert exported.status_code == 200, exported.text
    assert exported.headers["X-Export-Count"] == "1"
    assert in_range["id"] in exported.text
    assert outside["id"] not in exported.text
