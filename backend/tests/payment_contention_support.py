"""Shared support helpers for payment contention and outage PostgreSQL tests."""
import asyncio
import datetime
from typing import Any, Coroutine, Dict, Tuple

from asyncpg import Connection
from buyer_postgres_support import wait_for_order_waiters
from httpx import AsyncClient, Response
from test_public_order_routes import _create_test_order


async def setup_competing_claim_case(
    client: AsyncClient, trx_id: str = "CONTEND1"
) -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
    """Create two pending orders with identical payment claims and one receipt (AC20)."""
    order1: Dict[str, Any] = await _create_test_order(client)
    res2: Response = await client.post(
        "/api/seller/orders",
        json={
            "product_name": "Rival Order",
            "total_minor": 1200000,
            "required_advance_minor": 200000,
            "payment_account_id": order1["payment_account_id"],
        },
        headers={"Idempotency-Key": f"rival-order-{trx_id}"},
    )
    assert res2.status_code == 201, res2.text
    order2: Dict[str, Any] = res2.json()

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    claim = {
        "buyer_name": "Competing Buyer",
        "contact_number": "01711111111",
        "address": {"raw_text": "Dhanmondi, Dhaka"},
        "payment_claim": {
            "provider": "bkash",
            "trx_id": trx_id,
            "sender_number": "01822222222",
            "amount_minor": 200000,
        },
    }
    sub1: Response = await client.post(
        f"/api/public/orders/{order1['portal_token']}/submission",
        json=claim,
        headers={"Idempotency-Key": f"sub1-{trx_id}"},
    )
    assert sub1.status_code == 200, sub1.text

    sub2: Response = await client.post(
        f"/api/public/orders/{order2['portal_token']}/submission",
        json=claim,
        headers={"Idempotency-Key": f"sub2-{trx_id}"},
    )
    assert sub2.status_code == 200, sub2.text

    tx_res: Response = await client.post(
        "/api/seller/transactions",
        json={
            "payment_account_id": order1["payment_account_id"],
            "provider": "bkash",
            "trx_id": trx_id,
            "amount_minor": 200000,
            "sender_number": "01822222222",
            "occurred_at": now_iso,
        },
        headers={"Idempotency-Key": f"tx-{trx_id}"},
    )
    assert tx_res.status_code == 201, tx_res.text
    receipt: Dict[str, Any] = tx_res.json()
    assert receipt["reconciliation_state"] == "unmatched"
    comparison: Dict[str, Any] = (await client.get(f"/api/seller/transactions/{receipt['id']}")).json()
    assert comparison["allocated_order_id"] is None
    refreshed_order_1: Dict[str, Any] = (await client.get(f"/api/seller/orders/{order1['id']}")).json()
    refreshed_order_2: Dict[str, Any] = (await client.get(f"/api/seller/orders/{order2['id']}")).json()
    return refreshed_order_1, refreshed_order_2, receipt


async def setup_single_claim_case(
    client: AsyncClient, trx_id: str = "SINGLE1", amount_minor: int = 200000
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Create a pending order and a single matching receipt."""
    order: Dict[str, Any] = await _create_test_order(client)
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    claim = {
        "buyer_name": "Test Buyer",
        "contact_number": "01711111111",
        "address": {"raw_text": "Gulshan, Dhaka"},
        "payment_claim": {
            "provider": "bkash",
            "trx_id": trx_id,
            "sender_number": "01822222222",
            "amount_minor": 200000,
        },
    }
    sub: Response = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json=claim,
        headers={"Idempotency-Key": f"sub-{trx_id}"},
    )
    assert sub.status_code == 200, sub.text

    tx_res: Response = await client.post(
        "/api/seller/transactions",
        json={
            "payment_account_id": order["payment_account_id"],
            "provider": "bkash",
            "trx_id": trx_id,
            "amount_minor": amount_minor,
            "sender_number": "01822222222",
            "occurred_at": now_iso,
        },
        headers={"Idempotency-Key": f"tx-{trx_id}"},
    )
    assert tx_res.status_code == 201, tx_res.text
    receipt: Dict[str, Any] = tx_res.json()
    refreshed_order: Dict[str, Any] = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    return refreshed_order, receipt


async def order_decision(
    client: AsyncClient,
    order: Dict[str, Any],
    receipt: Dict[str, Any] | None = None,
    action: str = "confirm",
    key: str = "decision",
    expected_version: int | None = None,
) -> Response:
    """Call POST /api/seller/orders/{id}/decisions."""
    payload: Dict[str, Any] = {
        "action": action,
        "expected_version": expected_version if expected_version is not None else order["version"],
        "reason": f"Decision {action} test",
    }
    if action == "confirm":
        assert receipt is not None
        payload.update({
            "expected_transaction_version": receipt.get("version"),
            "transaction_id": receipt.get("id"),
            "accepted_amount_minor": receipt.get("amount_minor"),
        })
    return await client.post(
        f"/api/seller/orders/{order['id']}/decisions",
        json=payload,
        headers={"Idempotency-Key": key},
    )


async def execute_under_shop_barrier(
    connection: Connection,
    shop_id: str,
    coroutines: list[Coroutine[Any, Any, Response]],
) -> list[Response]:
    """Hold competing operations behind shop lock until all waiters queue, then release simultaneously."""
    await connection.execute("BEGIN")
    await connection.execute("SELECT id FROM shops WHERE id=$1 FOR UPDATE", shop_id)
    tasks = [asyncio.create_task(c) for c in coroutines]
    try:
        await wait_for_order_waiters(connection, len(coroutines))
    finally:
        await connection.execute("COMMIT")
        return list(await asyncio.gather(*tasks))
