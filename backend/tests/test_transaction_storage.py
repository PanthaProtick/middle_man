import datetime
import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import Base
from app.models.entities import (
    PaymentAccountTable,
    ReceivedTransactionTable,
    ShopTable,
)


def test_schema_metadata_contains_received_transaction_tables_and_constraints() -> None:
    tables = Base.metadata.tables
    assert "received_transactions" in tables
    assert "transaction_observations" in tables

    tx_table = tables["received_transactions"]
    assert "shop_id" in tx_table.c
    assert "payment_account_id" in tx_table.c
    assert "provider" in tx_table.c
    assert "trx_id" in tx_table.c
    assert "amount_minor" in tx_table.c
    assert "sender_number_raw" in tx_table.c
    assert "sender_number_canonical" in tx_table.c
    assert "occurred_at" in tx_table.c
    assert "reconciliation_state" in tx_table.c
    assert "has_conflict" in tx_table.c
    assert "version" in tx_table.c

    obs_table = tables["transaction_observations"]
    assert "transaction_id" in obs_table.c
    assert "payment_account_id" in obs_table.c
    assert "source" in obs_table.c
    assert "actor" in obs_table.c
    assert "amount_minor" in obs_table.c
    assert "parse_state" in obs_table.c
    assert "conflict_state" in obs_table.c

    # Foreign keys
    tx_fks = [fk.target_fullname for fk in tx_table.foreign_keys]
    assert "shops.id" in tx_fks
    assert "payment_accounts.id" in tx_fks

    obs_fks = [fk.target_fullname for fk in obs_table.foreign_keys]
    assert "received_transactions.id" in obs_fks
    assert "payment_accounts.id" in obs_fks


def test_received_transaction_unique_identity_per_shop() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        # Create Shop A and Account A
        shop_a = ShopTable(id=str(uuid.uuid4()), owner_id="owner_a", display_name="Shop A")
        session.add(shop_a)
        acc_a = PaymentAccountTable(
            id=str(uuid.uuid4()),
            shop_id=shop_a.id,
            provider="bkash",
            receiving_number="01711111111",
            label="bKash Merchant",
        )
        session.add(acc_a)

        # Create Shop B and Account B
        shop_b = ShopTable(id=str(uuid.uuid4()), owner_id="owner_b", display_name="Shop B")
        session.add(shop_b)
        acc_b = PaymentAccountTable(
            id=str(uuid.uuid4()),
            shop_id=shop_b.id,
            provider="bkash",
            receiving_number="01722222222",
            label="Shop B bKash",
        )
        session.add(acc_b)
        session.commit()

        now = datetime.datetime.now(datetime.timezone.utc)
        trx_id = "TRX123456"

        # Shop A adds transaction TRX123456
        tx_a = ReceivedTransactionTable(
            id=str(uuid.uuid4()),
            shop_id=shop_a.id,
            payment_account_id=acc_a.id,
            provider="bkash",
            trx_id=trx_id,
            amount_minor=100000,
            sender_number_raw="01700000000",
            sender_number_canonical="01700000000",
            occurred_at=now,
            reconciliation_state="unmatched",
            has_conflict=False,
            version=1,
            created_at=now,
            updated_at=now,
        )
        session.add(tx_a)
        session.commit()

        # Shop B can add the same provider + TRX123456 without conflict (independent shops)
        tx_b = ReceivedTransactionTable(
            id=str(uuid.uuid4()),
            shop_id=shop_b.id,
            payment_account_id=acc_b.id,
            provider="bkash",
            trx_id=trx_id,
            amount_minor=50000,
            sender_number_raw="01800000000",
            sender_number_canonical="01800000000",
            occurred_at=now,
            reconciliation_state="unmatched",
            has_conflict=False,
            version=1,
            created_at=now,
            updated_at=now,
        )
        session.add(tx_b)
        session.commit()

        # Shop A attempting to insert duplicate (shop_id, provider, trx_id) must fail unique constraint
        duplicate_tx = ReceivedTransactionTable(
            id=str(uuid.uuid4()),
            shop_id=shop_a.id,
            payment_account_id=acc_a.id,
            provider="bkash",
            trx_id=trx_id,
            amount_minor=100000,
            reconciliation_state="unmatched",
            has_conflict=False,
            version=1,
            created_at=now,
            updated_at=now,
        )
        session.add(duplicate_tx)
        with pytest.raises(IntegrityError):
            session.commit()
