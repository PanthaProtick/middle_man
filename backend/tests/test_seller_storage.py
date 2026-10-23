import uuid

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import Base
from app.models.entities import PaymentAccountTable, ShopTable


def test_schema_metadata_contains_required_tables_and_constraints() -> None:
    tables = Base.metadata.tables
    assert "shops" in tables
    assert "payment_accounts" in tables
    assert "idempotency_records" in tables

    # Check ShopTable constraints
    shop_t = tables["shops"]
    assert "owner_id" in shop_t.c
    assert any(idx.unique for idx in shop_t.indexes if "owner_id" in idx.columns)

    # Check PaymentAccountTable foreign key
    account_t = tables["payment_accounts"]
    fk_targets = [fk.target_fullname for fk in account_t.foreign_keys]
    assert "shops.id" in fk_targets


def test_shop_owner_uniqueness_enforced_in_relational_schema() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        shop1 = ShopTable(id=str(uuid.uuid4()), owner_id="duplicate_owner", display_name="Shop 1")
        session.add(shop1)
        session.commit()

        # Attempt to insert a second shop with the same owner_id
        shop2 = ShopTable(id=str(uuid.uuid4()), owner_id="duplicate_owner", display_name="Shop 2")
        session.add(shop2)
        with pytest.raises(IntegrityError):
            session.commit()


def test_payment_account_foreign_key_and_versioning() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        # Create shop
        shop_id = str(uuid.uuid4())
        shop = ShopTable(id=shop_id, owner_id="owner_acc", display_name="Acc Shop")
        session.add(shop)
        session.commit()

        # Create account
        acc_id = str(uuid.uuid4())
        acc = PaymentAccountTable(
            id=acc_id,
            shop_id=shop_id,
            provider="bkash",
            receiving_number="01711223344",
            label="Default",
            is_active=True,
            version=1,
        )
        session.add(acc)
        session.commit()

        # Update account version
        saved = session.scalar(select(PaymentAccountTable).where(PaymentAccountTable.id == acc_id))
        assert saved is not None
        assert saved.version == 1
        saved.version += 1
        saved.label = "Renamed"
        session.commit()

        updated = session.scalar(select(PaymentAccountTable).where(PaymentAccountTable.id == acc_id))
        assert updated is not None
        assert updated.version == 2
        assert updated.label == "Renamed"
