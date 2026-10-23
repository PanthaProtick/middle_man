import datetime
import uuid

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import Base
from app.models.entities import OrderTable, PaymentAccountTable, ShopTable


def test_schema_metadata_contains_orders_table_and_constraints() -> None:
    tables = Base.metadata.tables
    assert "orders" in tables

    order_t = tables["orders"]
    assert "shop_id" in order_t.c
    assert "payment_account_id" in order_t.c
    assert "token_lookup_digest" in order_t.c
    assert "encrypted_portal_token" in order_t.c
    assert "product_name" in order_t.c
    assert "total_minor" in order_t.c
    assert "required_advance_minor" in order_t.c
    assert "account_provider" in order_t.c
    assert "account_receiving_number" in order_t.c
    assert "account_label" in order_t.c
    assert "lifecycle" in order_t.c
    assert "version" in order_t.c
    assert "expires_at" in order_t.c

    # Check foreign keys
    fk_targets = [fk.target_fullname for fk in order_t.foreign_keys]
    assert "shops.id" in fk_targets
    assert "payment_accounts.id" in fk_targets

    # Check unique index on token_lookup_digest
    unique_cols = [
        col.name
        for idx in order_t.indexes
        if idx.unique
        for col in idx.columns
    ]
    assert "token_lookup_digest" in unique_cols


def test_order_token_digest_uniqueness_and_account_foreign_key() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        # Create shop and payment account
        shop_id = str(uuid.uuid4())
        shop = ShopTable(id=shop_id, owner_id="owner_storage_test", display_name="Storage Shop")
        session.add(shop)

        acc_id = str(uuid.uuid4())
        acc = PaymentAccountTable(
            id=acc_id,
            shop_id=shop_id,
            provider="bkash",
            receiving_number="01711223344",
            label="Storage Account",
            is_active=True,
            version=1,
        )
        session.add(acc)
        session.commit()

        # Create order
        order_id = str(uuid.uuid4())
        now = datetime.datetime.now(datetime.timezone.utc)
        expires_at = now + datetime.timedelta(hours=48)
        digest = "digest-unique-12345"

        order = OrderTable(
            id=order_id,
            shop_id=shop_id,
            payment_account_id=acc_id,
            token_lookup_digest=digest,
            encrypted_portal_token="enc-token-123",
            product_name="Leather Boots",
            total_minor=500000,
            required_advance_minor=100000,
            account_provider="bkash",
            account_receiving_number="01711223344",
            account_label="Storage Account",
            lifecycle="awaiting_buyer",
            version=1,
            created_at=now,
            updated_at=now,
            expires_at=expires_at,
            completed_at=None,
        )
        session.add(order)
        session.commit()

        # Check saved order
        saved = session.scalar(select(OrderTable).where(OrderTable.id == order_id))
        assert saved is not None
        assert saved.product_name == "Leather Boots"
        assert saved.total_minor == 500000
        assert saved.account_provider == "bkash"

        # Duplicate token_lookup_digest must raise IntegrityError
        dup_order = OrderTable(
            id=str(uuid.uuid4()),
            shop_id=shop_id,
            payment_account_id=acc_id,
            token_lookup_digest=digest,  # duplicate!
            encrypted_portal_token="enc-token-456",
            product_name="Different Boots",
            total_minor=400000,
            required_advance_minor=50000,
            account_provider="bkash",
            account_receiving_number="01711223344",
            account_label="Storage Account",
            lifecycle="awaiting_buyer",
            version=1,
            created_at=now,
            updated_at=now,
            expires_at=expires_at,
            completed_at=None,
        )
        session.add(dup_order)
        with pytest.raises(IntegrityError):
            session.commit()
