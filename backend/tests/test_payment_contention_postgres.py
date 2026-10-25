"""Contention and race serialization boundary tests against real PostgreSQL loopback instances.

Coverage targets: AC20, AC22, AC23.
"""
import datetime
from typing import Any, Dict

from httpx import Response
from payment_contention_support import (
    execute_under_shop_barrier,
    order_decision,
    setup_competing_claim_case,
    setup_single_claim_case,
)
from test_public_order_routes import _create_test_order


async def test_competing_orders_contend_for_single_receipt_allocates_exactly_once(postgres_buyer: Any) -> None:
    """AC20 & AC22: Two competing orders claim one receipt.

    1. Manual order decisions are blocked with 409 COMPETING_CLAIMS without first-submitter winner.
    2. Concurrent resolution decisions contend for the receipt, allocating it exactly once.
    """
    client, connection, _, _ = postgres_buyer
    order1, order2, receipt = await setup_competing_claim_case(client, "RACE_AC20")

    # 1. AC20: Neither seller can silently bypass review via order decision endpoint
    dec1: Response = await order_decision(client, order1, receipt, action="confirm", key="bypass-1")
    assert dec1.status_code == 409
    assert dec1.json()["error"]["code"] == "COMPETING_CLAIMS"

    dec2: Response = await order_decision(client, order2, receipt, action="confirm", key="bypass-2")
    assert dec2.status_code == 409
    assert dec2.json()["error"]["code"] == "COMPETING_CLAIMS"

    # Both orders remain pending and unallocated
    assert (await client.get(f"/api/seller/orders/{order1['id']}")).json()["lifecycle"] == "pending"
    assert (await client.get(f"/api/seller/orders/{order2['id']}")).json()["lifecycle"] == "pending"
    assert await connection.fetchval("SELECT count(*) FROM allocations") == 0
    assert await connection.fetchval("SELECT count(*) FROM used_payment_markers") == 0

    # 2. AC22: Concurrent actors resolve the receipt selecting different orders
    obs_id: str = receipt["observations"][0]["id"]
    resolve_path: str = f"/api/seller/transactions/{receipt['id']}/resolve"

    async def resolve_for_order(order_id: str, key: str) -> Response:
        return await client.post(
            resolve_path,
            json={
                "expected_version": receipt["version"],
                "reason": f"Seller selected order {order_id}",
                "selected_observation_id": obs_id,
                "selected_order_id": order_id,
            },
            headers={"Idempotency-Key": key},
        )

    responses = await execute_under_shop_barrier(
        connection,
        order1["shop_id"],
        [
            resolve_for_order(order1["id"], "resolve-actor-1"),
            resolve_for_order(order2["id"], "resolve-actor-2"),
        ],
    )

    # One winner (200 OK), one loser (409 Conflict)
    assert sorted(r.status_code for r in responses) == [200, 409], [r.text for r in responses]

    # Database guarantees exactly one allocation and one used payment marker
    assert await connection.fetchval("SELECT count(*) FROM allocations") == 1
    assert await connection.fetchval("SELECT count(*) FROM used_payment_markers") == 1

    # Check order states: exactly one confirmed, one remains pending
    o1_fresh: Dict[str, Any] = (await client.get(f"/api/seller/orders/{order1['id']}")).json()
    o2_fresh: Dict[str, Any] = (await client.get(f"/api/seller/orders/{order2['id']}")).json()
    lifecycles = {o1_fresh["lifecycle"], o2_fresh["lifecycle"]}
    assert lifecycles == {"confirmed", "pending"}

    # Receipt is allocated to the winner
    rec_fresh: Dict[str, Any] = (await client.get(f"/api/seller/transactions/{receipt['id']}")).json()
    assert rec_fresh["allocated_order_id"] in (order1["id"], order2["id"])


async def test_concurrent_manual_decision_and_automatic_matching_contention(postgres_buyer: Any) -> None:
    """AC22: Concurrent manual decision and automatic reconciliation contend for receipt, allocating at most once."""
    client, connection, _, _ = postgres_buyer
    order, receipt = await setup_single_claim_case(client, "RACE_MAN_AUTO", amount_minor=150000)

    # Manual decision accepting the receipt with exception
    async def manual_decision_actor() -> Response:
        return await order_decision(client, order, receipt, action="confirm", key="manual-race-key")

    # Completing the transaction details to trigger automatic reconciliation matching
    async def auto_matching_actor() -> Response:
        return await client.patch(
            f"/api/seller/transactions/{receipt['id']}",
            json={
                "expected_version": receipt["version"],
                "reason": "Completed receipt details for match",
                "amount_minor": 200000,
                "sender_number": "01822222222",
                "occurred_at": order["created_at"],
            },
            headers={"Idempotency-Key": "auto-match-race-key"},
        )

    responses = await execute_under_shop_barrier(
        connection,
        order["shop_id"],
        [manual_decision_actor(), auto_matching_actor()],
    )

    # One winner (200), one loser (409 Conflict on stale version or already allocated)
    assert sorted(r.status_code for r in responses) == [200, 409], [r.text for r in responses]

    # Exactly one allocation and marker in database
    assert await connection.fetchval("SELECT count(*) FROM allocations") == 1
    assert await connection.fetchval("SELECT count(*) FROM used_payment_markers") == 1

    final_order: Dict[str, Any] = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    assert final_order["lifecycle"] == "confirmed"
    assert final_order["version"] == order["version"] + 1


async def test_concurrent_cancellation_and_transaction_matching_race_serializes(postgres_buyer: Any) -> None:
    """AC23: Concurrent cancellation and transaction matching race serializes without double use or stale acceptance."""
    client, connection, _, _ = postgres_buyer
    order: Dict[str, Any] = await _create_test_order(client)
    now_iso: str = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # Buyer submits claim for an exact match
    claim: Dict[str, Any] = {
        "buyer_name": "Racing Buyer",
        "contact_number": "01711111111",
        "address": {"raw_text": "Mohakhali, Dhaka"},
        "payment_claim": {
            "provider": "bkash",
            "trx_id": "RACE_CANCEL_MATCH",
            "sender_number": "01822222222",
            "amount_minor": 200000,
        },
    }
    sub_res: Response = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json=claim,
        headers={"Idempotency-Key": "sub-race-cancel"},
    )
    assert sub_res.status_code == 200, sub_res.text
    refreshed_order: Dict[str, Any] = (await client.get(f"/api/seller/orders/{order['id']}")).json()

    # Actor 1 cancels order with expected_version
    async def cancel_actor() -> Response:
        return await order_decision(
            client, refreshed_order, action="cancel", key="cancel-match-race", expected_version=refreshed_order["version"]
        )

    # Actor 2 posts matching transaction which triggers automatic reconciliation
    async def match_actor() -> Response:
        return await client.post(
            "/api/seller/transactions",
            json={
                "payment_account_id": order["payment_account_id"],
                "provider": "bkash",
                "trx_id": "RACE_CANCEL_MATCH",
                "amount_minor": 200000,
                "sender_number": "01822222222",
                "occurred_at": now_iso,
            },
            headers={"Idempotency-Key": "match-tx-race"},
        )

    responses = await execute_under_shop_barrier(
        connection,
        order["shop_id"],
        [cancel_actor(), match_actor()],
    )

    # Valid serial outcomes:
    # If cancel wins: cancel returns 200, transaction returns 201 (unallocated, 0 allocations, 0 markers).
    # If match wins: transaction returns 201 (order confirmed), cancel returns 409 (stale version, 1 allocation).
    allocations_count: int = await connection.fetchval("SELECT count(*) FROM allocations")
    markers_count: int = await connection.fetchval("SELECT count(*) FROM used_payment_markers")
    final_order: Dict[str, Any] = (await client.get(f"/api/seller/orders/{order['id']}")).json()

    if final_order["lifecycle"] == "confirmed":
        assert responses[0].status_code == 409
        assert responses[1].status_code == 201
        assert allocations_count == 1
        assert markers_count == 1
    else:
        assert final_order["lifecycle"] == "cancelled"
        assert responses[0].status_code == 200
        assert responses[1].status_code == 201
        assert allocations_count == 0
        assert markers_count == 0


async def test_concurrent_cancellation_and_manual_confirmation_race_serializes(postgres_buyer: Any) -> None:
    """AC23: Concurrent cancellation and confirmation race serializes cleanly without double write or stale version."""
    client, connection, _, _ = postgres_buyer
    order, receipt = await setup_single_claim_case(client, "RACE_CANCEL_CONFIRM", amount_minor=250000)

    # Actor 1 cancels with current expected_version
    async def cancel_actor() -> Response:
        return await order_decision(
            client, order, action="cancel", key="race-cancel", expected_version=order["version"]
        )

    # Actor 2 confirms with current expected_version
    async def confirm_actor() -> Response:
        return await order_decision(
            client, order, receipt, action="confirm", key="race-confirm", expected_version=order["version"]
        )

    responses = await execute_under_shop_barrier(
        connection,
        order["shop_id"],
        [cancel_actor(), confirm_actor()],
    )

    # One action succeeds (200), the second action gets 409 conflict (stale version)
    assert sorted(r.status_code for r in responses) == [200, 409], [r.text for r in responses]

    final_order: Dict[str, Any] = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    assert final_order["version"] == order["version"] + 1

    allocations_count: int = await connection.fetchval("SELECT count(*) FROM allocations")
    markers_count: int = await connection.fetchval("SELECT count(*) FROM used_payment_markers")

    if final_order["lifecycle"] == "confirmed":
        assert allocations_count == 1
        assert markers_count == 1
    else:
        assert final_order["lifecycle"] == "cancelled"
        assert allocations_count == 0
        assert markers_count == 0
