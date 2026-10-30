"""Shared HTTP setup helpers for review-assistance reason tests."""
import datetime
from typing import Optional

from httpx import AsyncClient

from app.services.buyer_service import _memory_buyer_revisions
from app.services.order_service import _memory_orders
from app.services.transaction_store import _memory_transactions

CLAIM_SENDER = "01711111111"
OTHER_SENDER = "01799999999"


async def create_order(
    client: AsyncClient, account_id: str, *, key: str,
    total_minor: int = 1_200_000, advance_minor: int = 200_000,
) -> dict:
    response = await client.post(
        "/api/seller/orders",
        json={
            "product_name": "Private Product Name",
            "total_minor": total_minor,
            "required_advance_minor": advance_minor,
            "payment_account_id": account_id,
        },
        headers={"Idempotency-Key": key},
    )
    assert response.status_code == 201
    return response.json()


async def create_account(
    client: AsyncClient, *, key: str, receiving_number: str = "01712345678",
) -> dict:
    response = await client.post(
        "/api/seller/payment-accounts",
        json={"provider": "bkash", "receiving_number": receiving_number, "label": "Secondary"},
        headers={"Idempotency-Key": key},
    )
    assert response.status_code == 201
    return response.json()


async def submit_claim(
    client: AsyncClient, order: dict, *, trx_id: str = "TX12345",
    sender: Optional[str] = CLAIM_SENDER, amount_minor: int = 200_000,
    buyer_name: str = "Private Buyer Name",
) -> dict:
    payload = {
        "buyer_name": buyer_name,
        "contact_number": "01711111111",
        "address": {"raw_text": "Private Address, Dhanmondi, Dhaka"},
        "payment_claim": {
            "provider": "bkash",
            "trx_id": trx_id,
            "amount_minor": amount_minor,
        },
    }
    if sender is not None:
        payload["payment_claim"]["sender_number"] = sender
    response = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json=payload,
        headers={"Idempotency-Key": f"claim-{order['id']}-{trx_id}"},
    )
    assert response.status_code == 200
    return response.json()


async def record_receipt(
    client: AsyncClient, *, key: str, trx_id: str = "TX12345",
    account_id: Optional[str] = None, order: Optional[dict] = None,
    amount_minor: int = 200_000, sender: Optional[str] = CLAIM_SENDER,
    occurred_at: Optional[datetime.datetime] = None,
) -> dict:
    payload = {
        "payment_account_id": account_id or order["payment_account_id"],
        "provider": "bkash",
        "trx_id": trx_id,
        "amount_minor": amount_minor,
    }
    if sender is not None:
        payload["sender_number"] = sender
    if occurred_at is not None:
        payload["occurred_at"] = occurred_at.isoformat()
    response = await client.post(
        "/api/seller/transactions", json=payload, headers={"Idempotency-Key": key},
    )
    assert response.status_code in (200, 201)
    return response.json()


def order_created_at(order_id: str) -> datetime.datetime:
    return _memory_orders[order_id]["created_at"]


def claim_submitted_at(order_id: str) -> datetime.datetime:
    return _memory_buyer_revisions[order_id][-1]["claim_accepted_at"]


def make_receipt_complete(order_id: str, receipt_id: str, *, sender: str = CLAIM_SENDER) -> None:
    _memory_transactions[receipt_id].update(
        sender_number_canonical=sender,
        occurred_at=order_created_at(order_id),
    )
