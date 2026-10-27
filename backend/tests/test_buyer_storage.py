import datetime
import uuid

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.database import Base
from app.models.entities import (
    BuyerRevisionTable,
    LinkMeasurementTable,
    OrderTable,
    PaymentAccountTable,
    ShopTable,
)


def test_schema_metadata_contains_buyer_tables_and_constraints() -> None:
    tables = Base.metadata.tables
    assert "buyer_revisions" in tables
    assert "link_measurements" in tables

    rev_t = tables["buyer_revisions"]
    assert "order_id" in rev_t.c
    assert "revision_number" in rev_t.c
    assert "buyer_name" in rev_t.c
    assert "contact_number_raw" in rev_t.c
    assert "contact_number_canonical" in rev_t.c
    assert "payment_provider" in rev_t.c
    assert "payment_trx_id" in rev_t.c
    assert "payment_sender_raw" in rev_t.c
    assert "payment_sender_canonical" in rev_t.c
    assert "payment_amount_minor" in rev_t.c

    fk_targets = [fk.target_fullname for fk in rev_t.foreign_keys]
    assert "orders.id" in fk_targets

    meas_t = tables["link_measurements"]
    assert "token_lookup_digest" in meas_t.c
    assert "event_type" in meas_t.c
    assert "is_bot_or_repeat" in meas_t.c


def test_buyer_revision_storage_and_order_association() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        now = datetime.datetime.now(datetime.timezone.utc)
        # Create shop
        shop_id = str(uuid.uuid4())
        shop = ShopTable(id=shop_id, owner_id="owner_storage_test", display_name="Storage Shop")
        session.add(shop)

        # Create account
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

        # Create order
        order_id = str(uuid.uuid4())
        order = OrderTable(
            id=order_id,
            shop_id=shop_id,
            payment_account_id=acc_id,
            token_lookup_digest="digest-test-storage",
            encrypted_portal_token="enc-dummy",
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
            expires_at=now + datetime.timedelta(hours=48),
            completed_at=None,
        )
        session.add(order)
        session.commit()

        # Add buyer revision
        rev_id = str(uuid.uuid4())
        rev = BuyerRevisionTable(
            id=rev_id,
            order_id=order_id,
            revision_number=1,
            claim_accepted_at=now,
            buyer_name="Sabbir Ahmed",
            contact_number_raw="০১৭১১-২২৩৩৪৪",
            contact_number_canonical="01711223344",
            address_raw="Flat 4B, Banani DOHS, Dhaka",
            address_district="Dhaka",
            address_thana="Banani",
            address_area="Banani DOHS",
            address_street_line=None,
            address_landmark=None,
            payment_provider="bkash",
            payment_trx_id="TRX-SUBMIT-1",
            payment_sender_raw="+880 1899-999999",
            payment_sender_canonical="01899999999",
            payment_amount_minor=100000,
            payment_claimed_at=now,
            source="buyer",
            actor="buyer",
            reason=None,
            created_at=now,
        )
        session.add(rev)

        # Update order to pending
        order.lifecycle = "pending"
        order.buyer_revision = 1
        order.first_submitted_at = now
        order.version = 2
        order.updated_at = now

        # Add link measurement
        meas_id = str(uuid.uuid4())
        measurement = LinkMeasurementTable(
            id=meas_id,
            token_lookup_digest="digest-test-storage",
            event_type="submission",
            is_bot_or_repeat=False,
            created_at=now,
        )
        session.add(measurement)

        session.commit()

        # Verify revision persisted correctly
        saved_rev = session.scalar(select(BuyerRevisionTable).where(BuyerRevisionTable.id == rev_id))
        assert saved_rev is not None
        assert saved_rev.order_id == order_id
        assert saved_rev.buyer_name == "Sabbir Ahmed"
        assert saved_rev.contact_number_canonical == "01711223344"
        assert saved_rev.payment_sender_canonical == "01899999999"
        assert saved_rev.payment_amount_minor == 100000
        assert saved_rev.payment_provider == "bkash"

        # Verify order updated
        saved_order = session.scalar(select(OrderTable).where(OrderTable.id == order_id))
        assert saved_order is not None
        assert saved_order.lifecycle == "pending"
        assert saved_order.buyer_revision == 1
        assert saved_order.version == 2

        # Verify measurement persisted
        saved_meas = session.scalar(select(LinkMeasurementTable).where(LinkMeasurementTable.id == meas_id))
        assert saved_meas is not None
        assert saved_meas.token_lookup_digest == "digest-test-storage"
        assert saved_meas.event_type == "submission"
