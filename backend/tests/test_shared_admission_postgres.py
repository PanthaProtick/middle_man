"""Real PostgreSQL and independent HTTP workers: no simulated shared quota."""

import asyncio

from test_public_order_routes import _create_test_order


async def test_aggregate_budget_survives_concurrency_and_worker_replacement(instances, instance_database):
    _, connection = instance_database
    config = {"PUBLIC_REQUESTS_PER_WINDOW": "3", "PUBLIC_REQUEST_WINDOW_SECONDS": "300"}
    async with instances.start(**config) as first, instances.start(**config) as second:
        order = await _create_test_order(first)
        path = f"/api/public/orders/{order['portal_token']}"
        responses = await asyncio.gather(*[
            client.get(path, headers={"X-Forwarded-For": f"192.0.2.{index}"})
            for index, client in enumerate((first, second) * 6)
        ])
        assert sorted(r.status_code for r in responses) == [200] * 3 + [429] * 9
        rejected = next(r for r in responses if r.status_code == 429)
        assert rejected.headers["retry-after"] == "300"
        assert rejected.json()["error"]["code"] == "PUBLIC_RATE_LIMITED"
        assert order["portal_token"] not in rejected.text
        # Neither rotating tokens nor preflight-like methods grant another budget.
        assert (await first.get("/api/public/orders/another-token")).status_code == 429
        assert (await second.options(path)).status_code == 429
        assert (await first.get("/api/health")).status_code == 200
    async with instances.start(**config) as replacement:
        assert (await replacement.get(path)).status_code == 429
        # Advance the database-owned expiration without waiting five minutes.
        await connection.execute("UPDATE public_admission SET expires_at=now()-interval '1 second'")
        assert (await replacement.get(path)).status_code == 200


async def test_shared_control_failure_returns_private_retryable_error(instances, instance_database):
    _, connection = instance_database
    async with instances.start() as client:
        await connection.execute("ALTER TABLE public_admission RENAME TO unavailable_admission")
        response = await client.post("/api/public/orders/sensitive-token/submission", json={})
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "PUBLIC_ADMISSION_UNAVAILABLE"
        assert response.headers["retry-after"] == "5"
        assert response.headers["cache-control"] == "no-store, private"
        assert "sensitive-token" not in response.text
        assert "public_admission" not in response.text
        await connection.execute("ALTER TABLE unavailable_admission RENAME TO public_admission")
        assert (await client.get("/api/public/orders/invalid")).status_code != 503


async def test_shared_control_lock_timeout_does_not_admit(instances, instance_database):
    _, connection = instance_database
    async with instances.start() as client:
        order = await _create_test_order(client)
        path = f"/api/public/orders/{order['portal_token']}"
        assert (await client.get(path)).status_code == 200
        await connection.execute("BEGIN")
        await connection.execute("SELECT * FROM public_admission FOR UPDATE")
        try:
            response = await client.get(path)
            assert response.status_code == 503
            assert response.json()["error"]["code"] == "PUBLIC_ADMISSION_UNAVAILABLE"
        finally:
            await connection.execute("ROLLBACK")
        assert (await client.get(path)).status_code == 200


async def test_shared_admission_preserves_body_bounds_and_link_authority(instances):
    async with instances.start(PUBLIC_REQUEST_MAX_BYTES="8") as client:
        order = await _create_test_order(client)
        path = f"/api/public/orders/{order['portal_token']}"
        assert (await client.post(path + "/submission", content=b"123456789")).status_code == 413
        assert (await client.get(path)).json()["lifecycle"] == "awaiting_buyer"
        assert (await client.get("/api/public/orders/invalid-token")).status_code == 404
