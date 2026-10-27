import datetime

import pytest
from httpx import AsyncClient
from test_payment_exceptions import exception_case
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401

from app.api.public_orders import get_buyer_clock
from app.core.tokens import get_utc_now
from app.main import app
from app.services.order_service import _memory_orders


def _buyer_submission(buyer_name: str, contact: str, trx_id: str) -> dict:
    return {
        "buyer_name": buyer_name,
        "contact_number": contact,
        "address": {"raw_text": "House 1, Dhaka"},
        "payment_claim": {
            "provider": "bkash",
            "trx_id": trx_id,
            "sender_number": "01811112222",
            "amount_minor": 200000,
        },
    }


@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_expired_predecessor_replacement_preserves_expired_status_and_denies_actions(client: AsyncClient):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"

    # Advance clock past 48 hours to trigger expiry
    base_time = get_utc_now()
    past_deadline = base_time + datetime.timedelta(hours=49)
    app.dependency_overrides[get_buyer_clock] = lambda: (lambda: past_deadline)

    # Read order to trigger expiry transition
    get_res = await client.get(f"/api/public/orders/{order['portal_token']}")
    assert get_res.status_code == 200
    assert get_res.json()["lifecycle"] == "expired"

    # Refresh order details from seller side
    seller_order = (await client.get(path)).json()
    assert seller_order["lifecycle"] == "expired"

    # Replace the expired order
    replace_res = await client.post(
        path + "/replacement",
        json={
            "expected_version": seller_order["version"],
            "reason": "Expired deal revived under new terms",
            "order": {
                "product_name": "Fresh Deal After Expiry",
                "total_minor": 1600000,
                "required_advance_minor": 200000,
                "payment_account_id": order["payment_account_id"],
            },
        },
        headers={"Idempotency-Key": "replace-expired-order"},
    )
    assert replace_res.status_code == 201
    new_order = replace_res.json()

    # Predecessor projection remains terminal expired (NOT cancelled)
    pred_res = await client.get(f"/api/public/orders/{order['portal_token']}")
    assert pred_res.status_code == 200
    assert "location" not in pred_res.headers
    pred_pub = pred_res.json()
    assert pred_pub["lifecycle"] == "expired"
    assert "expired" in pred_pub["status_message"].lower()
    assert new_order["id"] not in pred_res.text
    assert new_order["portal_token"] not in pred_res.text

    # Predecessor cannot submit (returns 410 gone)
    sub_res = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json=_buyer_submission("Late Submitter", "01711112222", "TXEXP1"),
        headers={"Idempotency-Key": "sub-on-expired-pred"},
    )
    assert sub_res.status_code == 410
    assert sub_res.json()["error"]["code"] == "EXPIRED_SUBMISSION"



@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_revoked_and_deleted_predecessor_remains_denied(client: AsyncClient):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"

    # Replace order
    rep_res = await client.post(
        path + "/replacement",
        json={
            "expected_version": order["version"],
            "reason": "Replacement before revocation check",
            "order": {
                "product_name": "Replacement Target",
                "total_minor": 1200000,
                "required_advance_minor": 200000,
                "payment_account_id": order["payment_account_id"],
            },
        },
        headers={"Idempotency-Key": "replace-then-revoke"},
    )
    assert rep_res.status_code == 201

    pred_seller = (await client.get(path)).json()
    assert pred_seller["lifecycle"] == "cancelled"

    # Predecessor can be explicitly revoked by seller
    rev_res = await client.post(
        path + "/revoke-link",
        json={"expected_version": pred_seller["version"]},
        headers={"Idempotency-Key": "revoke-cancelled-pred"},
    )
    assert rev_res.status_code == 200

    # Public access to predecessor is now 410 BUYER_LINK_REVOKED
    pub_res = await client.get(f"/api/public/orders/{order['portal_token']}")
    assert pub_res.status_code == 410
    assert pub_res.json()["error"]["code"] == "BUYER_LINK_REVOKED"

    # Submission and upload are also blocked with 410 BUYER_LINK_REVOKED
    sub_res = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json=_buyer_submission("Revoked Submitter", "01711112222", "TXREV1"),
        headers={"Idempotency-Key": "sub-on-revoked-pred"},
    )
    assert sub_res.status_code == 410
    assert sub_res.json()["error"]["code"] == "BUYER_LINK_REVOKED"

    # Test soft-deleted / purged record returns 410 RECORD_UNAVAILABLE
    purged_order = await _create_test_order(client)
    _memory_orders[purged_order["id"]]["retained_at"] = get_utc_now()
    del_res = await client.get(f"/api/public/orders/{purged_order['portal_token']}")
    assert del_res.status_code == 410
    assert del_res.json()["error"]["code"] == "RECORD_UNAVAILABLE"


@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_allocated_confirmed_predecessor_retains_replacement_restrictions(client: AsyncClient):
    order, receipt = await exception_case(client)
    path = f"/api/seller/orders/{order['id']}"

    # Confirm order
    conf_res = await client.post(
        path + "/decisions",
        json={
            "action": "confirm",
            "expected_version": order["version"],
            "expected_transaction_version": receipt["version"],
            "transaction_id": receipt["id"],
            "accepted_amount_minor": receipt["amount_minor"],
            "reason": "Advance confirmed",
        },
        headers={"Idempotency-Key": "conf-pred-restriction"},
    )
    assert conf_res.status_code == 200
    confirmed = conf_res.json()
    assert confirmed["lifecycle"] == "confirmed"

    # Attempting replacement returns 409 PAYMENT_RESOLUTION_REQUIRED
    rep_res = await client.post(
        path + "/replacement",
        json={
            "expected_version": confirmed["version"],
            "reason": "Attempting replacement after confirmation",
            "order": {
                "product_name": "Illegal Replacement",
                "total_minor": 1500000,
                "required_advance_minor": 300000,
                "payment_account_id": order["payment_account_id"],
            },
        },
        headers={"Idempotency-Key": "rep-on-confirmed-pred"},
    )
    assert rep_res.status_code == 409
    assert rep_res.json()["error"]["code"] == "PAYMENT_RESOLUTION_REQUIRED"

    # Original order terms and allocation remain intact
    unaltered = (await client.get(path)).json()
    assert unaltered["lifecycle"] == "confirmed"
    assert unaltered["replaced_by_order_id"] is None

    # Payment single-use guarantee: confirmed receipt cannot be re-allocated to another order
    other_order_res = await client.post(
        "/api/seller/orders",
        json={
            "product_name": "Distinct Other Order",
            "total_minor": 1200000,
            "required_advance_minor": 200000,
            "payment_account_id": order["payment_account_id"],
        },
        headers={"Idempotency-Key": "setup-distinct-other-order"},
    )
    assert other_order_res.status_code == 201
    other_order = other_order_res.json()

    sub_other = await client.post(
        f"/api/public/orders/{other_order['portal_token']}/submission",
        json=_buyer_submission("Other Buyer", "01722223333", "TXOTHER"),
        headers={"Idempotency-Key": "sub-other-order"},
    )
    assert sub_other.status_code == 200

    other_path = f"/api/seller/orders/{other_order['id']}"
    pending_other = (await client.get(other_path)).json()
    dup_conf_res = await client.post(
        other_path + "/decisions",
        json={
            "action": "confirm",
            "expected_version": pending_other["version"],
            "expected_transaction_version": receipt["version"] + 1,
            "transaction_id": receipt["id"],
            "accepted_amount_minor": receipt["amount_minor"],
            "reason": "Attempting double allocation of same receipt",
        },
        headers={"Idempotency-Key": "dup-conf-attempt"},
    )
    assert dup_conf_res.status_code == 409
    assert dup_conf_res.json()["error"]["code"] == "PAYMENT_USED"
