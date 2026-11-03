"""Real HTTP requests to independent processes sharing one disposable PostgreSQL DB."""
import asyncio
import datetime
import os

import asyncpg
from buyer_postgres_support import PAYLOAD, wait_for_order_waiters
from payment_contention_support import order_decision, setup_competing_claim_case
from test_public_order_routes import _create_test_order


async def test_confirmed_submission_and_buyer_replay_survive_process_replacement(instances, instance_database):
    _, connection = instance_database
    async with instances.start() as first, instances.start() as second:
        order = await _create_test_order(first)
        assert (await second.get(f"/api/seller/orders/{order['id']}")).json()["portal_token"] == order["portal_token"]
        payload = {"product_name": "Explicitly confirmed", "total_minor": 1200000,
                   "required_advance_minor": 200000, "payment_account_id": order["payment_account_id"]}
        path = "/api/seller/order-submissions/durable.confirmed-action"
        # Hold the real shop lock until both independent workers reach the write.
        await connection.execute("BEGIN")
        await connection.execute("SELECT id FROM shops WHERE id=$1 FOR UPDATE", order["shop_id"])
        tasks = [asyncio.create_task(client.post(path, json=payload)) for client in (first, second)]
        try:
            await wait_for_order_waiters(connection, 2)
        finally:
            await connection.execute("COMMIT")
            responses = await asyncio.gather(*tasks)
        assert [response.status_code for response in responses] == [201, 201], [r.text for r in responses]
        assert responses[0].json() == responses[1].json()
        saved = responses[0].json()
        public = f"/api/public/orders/{saved['portal_token']}"
        submissions = await asyncio.gather(*[
            client.post(public + "/submission", json=PAYLOAD, headers={"Idempotency-Key": "buyer-submit"})
            for client in (first, second)
        ])
        assert [response.status_code for response in submissions] == [200, 200]
        assert submissions[0].json() == submissions[1].json()
    # Both original engines, event loops, and memory stores have ceased to exist.
    async with instances.start() as replacement:
        recovered = await replacement.get(path)
        assert recovered.json()["state"] == "succeeded"
        assert recovered.json()["order"] == saved
        assert (await replacement.post(path, json=payload)).json() == saved
        changed = await replacement.post(path, json={**payload, "product_name": "Unconfirmed change"})
        assert changed.status_code == 409
        replay = await replacement.post(public + "/submission", json=PAYLOAD,
                                        headers={"Idempotency-Key": "buyer-submit"})
        assert replay.json() == submissions[0].json()
        correction = await replacement.post(public + "/submission", json=PAYLOAD,
                                            headers={"Idempotency-Key": "new-action"})
        assert correction.status_code == 409
        current = await replacement.get(f"/api/seller/orders/{saved['id']}")
        assert current.json()["lifecycle"] == "pending"
        assert current.json()["portal_token"] == saved["portal_token"]


async def test_receipt_single_use_and_decision_replay_across_processes(instances, instance_database):
    _, connection = instance_database
    async with instances.start() as first, instances.start() as second:
        one, two, receipt = await setup_competing_claim_case(first, "INSTANCE-RACE")
        for client, order in ((first, one), (second, two)):
            blocked = await order_decision(client, order, receipt, key="unreviewed")
            assert blocked.status_code == 409
            assert blocked.json()["error"]["code"] == "COMPETING_CLAIMS"
        path = f"/api/seller/transactions/{receipt['id']}/resolve"
        payloads = [{"expected_version": receipt["version"], "reason": "Seller reviewed competing claim",
                     "selected_observation_id": receipt["observations"][0]["id"], "selected_order_id": order["id"]}
                    for order in (one, two)]
        await connection.execute("BEGIN")
        await connection.execute("SELECT id FROM shops WHERE id=$1 FOR UPDATE", one["shop_id"])
        tasks = [asyncio.create_task(client.post(path, json=payloads[index],
                                               headers={"Idempotency-Key": f"resolve-{index}"}))
                 for index, client in enumerate((first, second))]
        try:
            await wait_for_order_waiters(connection, 2)
        finally:
            await connection.execute("COMMIT")
            responses = await asyncio.gather(*tasks)
        assert sorted(r.status_code for r in responses) == [200, 409], [r.text for r in responses]
        winner = next(index for index, response in enumerate(responses) if response.status_code == 200)
    async with instances.start() as replacement:
        replay = await replacement.post(path, json=payloads[winner], headers={"Idempotency-Key": f"resolve-{winner}"})
        assert replay.status_code == 200
        assert replay.json() == responses[winner].json()
        state = (await replacement.get(f"/api/seller/transactions/{receipt['id']}")).json()
        assert state["allocated_order_id"] == (one, two)[winner]["id"]
        loser = (one, two)[1 - winner]
        assert (await order_decision(replacement, loser, receipt, key="reuse-receipt")).status_code == 409
        assert (await replacement.get(f"/api/seller/orders/{loser['id']}")).json()["lifecycle"] == "pending"


async def test_database_loss_never_reports_committed_success(instances, instance_database):
    _, connection = instance_database
    async with instances.start() as first, instances.start() as second:
        order = await _create_test_order(first)
        payload = {"payment_account_id": order["payment_account_id"], "provider": "bkash",
                   "trx_id": "OUTAGE-RETRY", "amount_minor": 200000, "sender_number": "01822222222",
                   "occurred_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}
        # Remove database access from existing and new connections, then restore it.
        database = await connection.fetchval("SELECT current_database()")
        admin = await asyncpg.connect(os.environ["BUYER_TEST_POSTGRES_URL"], ssl=False)
        await admin.execute(f'ALTER DATABASE "{database}" ALLOW_CONNECTIONS false')
        await admin.execute("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>$2", database, connection.get_server_pid())
        try:
            failed = await first.post("/api/seller/transactions", json=payload,
                                      headers={"Idempotency-Key": "outage-retry"})
            assert failed.status_code == 503, failed.text
        finally:
            await admin.execute(f'ALTER DATABASE "{database}" ALLOW_CONNECTIONS true')
            await admin.close()
        recovered = await second.post("/api/seller/transactions", json=payload,
                                      headers={"Idempotency-Key": "outage-retry"})
        assert recovered.status_code == 201, recovered.text
        replay = await first.post("/api/seller/transactions", json=payload,
                                  headers={"Idempotency-Key": "outage-retry"})
        assert replay.status_code == 201
        assert replay.json() == recovered.json()
