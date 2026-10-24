from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.database import EXPECTED_SCHEMA_TABLES, check_schema_inventory
from app.models.seller import ShopInput
from app.services.seller_service import SellerService, _memory_shops


def test_migrations_directory_inventory() -> None:
    migrations_dir = Path(__file__).parents[1] / "migrations"
    migration_files = sorted(migrations_dir.glob("*.sql"))
    assert len(migration_files) == 17
    prefixes = [f.name[:4] for f in migration_files]
    expected_prefixes = [f"{i:04d}" for i in range(1, 18)]
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
        service_outage = SellerService(db=outage_session)
        await service_outage.create_shop(
            owner_id="rolled_back_seller",
            input_data=ShopInput(display_name="Rolled Back Shop"),
            idempotency_key="rollback-key",
        )
        await outage_session.rollback()

    async with new_sessions() as verify_session:
        verify_service = SellerService(db=verify_session)
        assert await verify_service.get_shop_by_owner("rolled_back_seller") is None

    assert "rolled_back_seller" not in _memory_shops
