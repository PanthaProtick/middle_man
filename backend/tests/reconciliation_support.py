import uuid

import pytest

from app.core.tokens import get_utc_now
from app.services.order_service import reset_order_memory_store
from app.services.seller_service import _memory_accounts, _memory_shops, reset_memory_store
from app.services.transaction_store import reset_transaction_memory_store


@pytest.fixture(autouse=True)
def clean_stores():
    reset_memory_store()
    reset_order_memory_store()
    reset_transaction_memory_store()


@pytest.fixture
def base_setup():
    shop_id = str(uuid.uuid4())
    owner_id = "test-owner"
    _memory_shops[owner_id] = {
        "id": shop_id,
        "owner_id": owner_id,
        "display_name": "Test Shop",
        "created_at": get_utc_now(),
        "updated_at": get_utc_now(),
    }
    acc_id = str(uuid.uuid4())
    _memory_accounts[acc_id] = {
        "id": acc_id,
        "shop_id": shop_id,
        "provider": "bkash",
        "receiving_number": "01711111111",
        "label": "Primary bKash",
        "is_active": True,
        "version": 1,
        "created_at": get_utc_now(),
        "updated_at": get_utc_now(),
    }
    return {"shop_id": shop_id, "owner_id": owner_id, "account_id": acc_id}
