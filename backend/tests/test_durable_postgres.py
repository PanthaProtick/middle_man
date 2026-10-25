from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import settings
from app.core.database import EXPECTED_SCHEMA_TABLES, check_schema_inventory
from app.core.tokens import (
    LinkEncryptionKeyIncompatibleError,
    check_link_encryption_readiness,
    get_utc_now,
)
from app.models.entities import ShopTable
from app.models.order import OrderInput
from app.models.seller import AccountInput, ShopInput
from app.services.order_service import OrderService
from app.services.payment_marker_protection import (
    PaymentMarkerKeyIncompatibleError,
    check_payment_marker_readiness,
    reject_used_identity,
    verify_marker_key,
)
from app.services.seller_service import SellerDomainException, SellerService, _memory_shops


def test_migrations_directory_inventory() -> None:
    migrations_dir = Path(__file__).parents[1] / "migrations"
    migration_files = sorted(migrations_dir.glob("*.sql"))
    assert len(migration_files) == 18
    prefixes = [f.name[:4] for f in migration_files]
    expected_prefixes = [f"{i:04d}" for i in range(1, 19)]
    assert prefixes == expected_prefixes

    all_sql = "\n".join(f.read_text(encoding="utf-8").lower() for f in migration_files)
    for table_name in EXPECTED_SCHEMA_TABLES:
        assert "create table" in all_sql
        assert table_name in all_sql


@pytest.mark.asyncio
async def test_schema_inventory_and_adapter_restart(postgres_buyer) -> None:
    """Exercises real PostgreSQL adapter queries, schema inventory, and restart durability."""
    client, connection, sessions, order = postgres_buyer

    # 1. Verify schema inventory against real PostgreSQL
    async with sessions() as session:
        all_present, missing = await check_schema_inventory(session)
        assert all_present is True
        assert len(missing) == 0

    # 2. Exercise adapter writes
    unique_owner = f"seller_restart_{order['id'][:8]}"
    async with sessions() as session:
        service = SellerService(db=session)
        shop, code = await service.create_shop(
            owner_id=unique_owner,
            input_data=ShopInput(display_name="Durable Restart Shop"),
            idempotency_key=f"restart-key-{unique_owner}",
        )
        assert code == 201
        created_shop_id = shop.id
        await session.commit()

    # 3. Simulate process / adapter restart (new session factory, no shared state)
    engine = session.bind
    new_sessions = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

    async with new_sessions() as fresh_session:
        fresh_service = SellerService(db=fresh_session)
        persisted_shop = await fresh_service.get_shop_by_owner(unique_owner)
        assert persisted_shop is not None
        assert persisted_shop.id == created_shop_id
        assert persisted_shop.display_name == "Durable Restart Shop"

    # 4. Outage mid-acceptance / transaction rollback regression against PostgreSQL:
    # A failed / rolled-back transaction never writes to memory and never commits
    async with new_sessions() as outage_session:
        outage_session.add(
            ShopTable(
                id="outage-shop-uuid",
                owner_id="rolled_back_seller",
                display_name="Rolled Back Shop",
            )
        )
        await outage_session.flush()
        await outage_session.rollback()

    async with new_sessions() as verify_session:
        verify_service = SellerService(db=verify_session)
        assert await verify_service.get_shop_by_owner("rolled_back_seller") is None

    assert "rolled_back_seller" not in _memory_shops


@pytest.mark.asyncio
async def test_order_link_independent_encryption_restart_and_clerk_rotation(
    postgres_buyer, monkeypatch: pytest.MonkeyPatch
) -> None:
    """AC04 / AC39: Order link remains recoverable across Clerk rotation and restart, and fails explicitly on bad key."""
    client, connection, sessions, _ = postgres_buyer

    app_key = "durable-postgres-app-encryption-key-material"
    clerk_key_1 = "sk_test_postgres_clerk_key_one"
    clerk_key_2 = "sk_test_postgres_clerk_key_two_after_rotation"

    monkeypatch.setattr(settings, "ORDER_LINK_ENCRYPTION_KEY", app_key)
    monkeypatch.setattr(settings, "CLERK_SECRET_KEY", clerk_key_1)
    monkeypatch.setattr(settings, "SELF_TEST_MODE", True)

    # 0. Clean isolated schema orders before initializing key
    async with sessions() as session:
        await session.execute(text("DELETE FROM orders"))
        await session.commit()

    # 1. Create shop, payment account, and order
    async with sessions() as session:
        seller_svc = SellerService(db=session)
        shop, _ = await seller_svc.create_shop(
            owner_id="link_encryption_seller",
            input_data=ShopInput(display_name="Encryption Test Shop"),
            idempotency_key="enc-shop-key",
        )
        acc, _ = await seller_svc.create_payment_account(
            shop_id=shop.id,
            owner_id="link_encryption_seller",
            input_data=AccountInput(
                provider="bkash",
                account_type="personal",
                receiving_number="01711111111",
                label="Primary bKash",
            ),
            idempotency_key="enc-acc-key",
        )
        order_svc = OrderService(db=session)
        order, code = await order_svc.create_order(
            shop_id=shop.id,
            owner_id="link_encryption_seller",
            input_data=OrderInput(
                product_name="Encrypted Link Item",
                total_minor=50000,
                required_advance_minor=10000,
                payment_account_id=acc.id,
            ),
            idempotency_key="enc-order-key",
        )
        assert code == 201
        created_order_id = order.id
        original_portal_token = order.portal_token
        await session.commit()

    # 2. Simulate application restart and Clerk credential rotation
    monkeypatch.setattr(settings, "CLERK_SECRET_KEY", clerk_key_2)
    engine = session.bind
    fresh_sessions = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

    # Startup compatibility check passes with active key
    await check_link_encryption_readiness(cfg=settings, session_factory=fresh_sessions)

    # Order recovery retrieves intact portal token
    async with fresh_sessions() as fresh_session:
        fresh_order_svc = OrderService(db=fresh_session)
        recovered_order = await fresh_order_svc.get_order(
            shop_id=shop.id,
            order_id=created_order_id,
        )
        assert recovered_order is not None
        assert recovered_order.portal_token == original_portal_token
        assert recovered_order.portal_url == f"/orders/{original_portal_token}"

    # 3. Simulate incompatible application key configuration
    monkeypatch.setattr(settings, "ORDER_LINK_ENCRYPTION_KEY", "incompatible-key-material")
    with pytest.raises(LinkEncryptionKeyIncompatibleError):
        await check_link_encryption_readiness(cfg=settings, session_factory=fresh_sessions)


@pytest.mark.asyncio
async def test_payment_marker_independent_secret_restart_and_clerk_rotation(
    postgres_buyer, monkeypatch: pytest.MonkeyPatch
) -> None:
    """AC17 / AC42: Consumed-payment marker rejects reuse across Clerk rotation and restart, and fails closed on bad marker key."""
    from app.models.entities import UsedPaymentMarkerTable
    from app.services.reconciliation import compute_payment_digest

    client, connection, sessions, _ = postgres_buyer

    marker_secret = "durable-postgres-marker-secret-32bytes!"
    clerk_key_1 = "sk_test_postgres_clerk_key_alpha"
    clerk_key_2 = "sk_test_postgres_clerk_key_bravo_after_rotation"

    monkeypatch.setattr(settings, "PAYMENT_MARKER_SECRET", marker_secret)
    monkeypatch.setattr(settings, "PAYMENT_IDENTITY_SECRET", "")
    monkeypatch.setattr(settings, "CLERK_SECRET_KEY", clerk_key_1)
    monkeypatch.setattr(settings, "SELF_TEST_MODE", True)

    # 1. Create shop and bind payment marker key
    async with sessions() as session:
        seller_svc = SellerService(db=session)
        shop, _ = await seller_svc.create_shop(
            owner_id="marker_rotation_seller",
            input_data=ShopInput(display_name="Marker Rotation Shop"),
            idempotency_key="marker-shop-key",
        )
        shop_id = shop.id
        await verify_marker_key(session, shop_id)

        # Record a consumed payment marker under this shop
        digest = compute_payment_digest(shop_id, "bkash", "TRX_DURABLE_USED_01")
        session.add(
            UsedPaymentMarkerTable(
                id="marker-durable-1",
                shop_id=shop_id,
                provider="bkash",
                transaction_digest=digest,
                created_at=get_utc_now(),
            )
        )
        await session.commit()

    # 2. Simulate application restart and Clerk credential rotation
    monkeypatch.setattr(settings, "CLERK_SECRET_KEY", clerk_key_2)
    engine = session.bind
    fresh_sessions = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

    # Startup compatibility check passes with active marker secret
    await check_payment_marker_readiness(cfg=settings, session_factory=fresh_sessions)

    # Consumed payment marker still rejects reuse after Clerk rotation
    async with fresh_sessions() as fresh_session:
        with pytest.raises(SellerDomainException) as exc_info:
            await reject_used_identity(fresh_session, shop_id, "bkash", "TRX_DURABLE_USED_01")
        assert exc_info.value.status_code == 409
        assert exc_info.value.detail["code"] == "PAYMENT_USED"

        # Unused payment identity succeeds
        await reject_used_identity(fresh_session, shop_id, "bkash", "TRX_DURABLE_NEW_02")

    # 3. Simulate incompatible marker secret configuration: fails closed
    monkeypatch.setattr(settings, "PAYMENT_MARKER_SECRET", "incompatible-marker-secret-32bytes!")
    with pytest.raises(PaymentMarkerKeyIncompatibleError):
        await check_payment_marker_readiness(cfg=settings, session_factory=fresh_sessions)

    async with fresh_sessions() as bad_session:
        with pytest.raises(SellerDomainException) as exc_info2:
            await verify_marker_key(bad_session, shop_id)
        assert exc_info2.value.status_code == 503
        assert exc_info2.value.detail["code"] == "PAYMENT_MARKER_KEY_UNAVAILABLE"


