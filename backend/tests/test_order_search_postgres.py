from test_order_search import _create_order, _submit_buyer


async def test_postgres_order_search_matches_pages_and_exports_same_set(postgres_buyer):
    client, _, _, order = postgres_buyer
    await _create_order(client, order["payment_account_id"], "Leather Backpack", "pg-search-other")
    second = await _create_order(
        client, order["payment_account_id"], "Mechanical Keyboard Two", "pg-search-second"
    )
    third = await _create_order(
        client, order["payment_account_id"], "Mechanical Keyboard Three", "pg-search-third"
    )
    await _submit_buyer(client, order, key="pg-search-buyer")

    product = await client.get(
        "/api/seller/orders", params={"search": "mechanical", "limit": 2}
    )
    assert product.status_code == 200
    first_page = product.json()
    assert len(first_page["items"]) == 2
    assert first_page["next_cursor"] is not None
    second_page = await client.get(
        "/api/seller/orders",
        params={"search": "mechanical", "limit": 2, "cursor": first_page["next_cursor"]},
    )
    assert second_page.status_code == 200
    paged = first_page["items"] + second_page.json()["items"]
    assert second_page.json()["next_cursor"] is None
    assert {item["id"] for item in paged} == {order["id"], second["id"], third["id"]}

    buyer = await client.get("/api/seller/orders", params={"search": "+880 1711-111111"})
    assert buyer.status_code == 200
    assert [item["id"] for item in buyer.json()["items"]] == [order["id"]]

    fragment = await client.get("/api/seller/orders", params={"search": "0171"})
    assert fragment.status_code == 200
    assert fragment.json()["items"] == []

    exported = await client.get("/api/seller/orders/export", params={"search": "rahim"})
    assert exported.status_code == 200
    assert exported.headers["X-Export-Count"] == "1"
    assert order["id"] in exported.text
    assert "Leather Backpack" not in exported.text
