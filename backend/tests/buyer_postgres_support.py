"""Opt-in PostgreSQL tests: isolated schemas, loopback only, no application credentials."""
import asyncio
import os
import uuid
from pathlib import Path
from urllib.parse import urlparse

import asyncpg
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from test_public_order_routes import _create_test_order

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.database import get_db
from app.main import app

PAYLOAD = {
    "buyer_name": "Synthetic Buyer", "contact_number": "০১৭১১১১১১১১",
    "address": {"raw_text": "Synthetic address, Dhaka"},
    "payment_claim": {"provider": "bkash", "trx_id": "CASE-sensitive", "sender_number": "+880 1822-222222", "amount_minor": 3000000000},
}


async def wait_for_order_waiters(connection, count):
    for _ in range(200):
        await connection.execute("SELECT pg_stat_clear_snapshot()")
        waiting = await connection.fetchval("SELECT count(*) FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%orders%'")
        if waiting >= count:
            return
        await asyncio.sleep(0.01)
    pytest.fail(f"Expected {count} requests waiting on real order locks")


@pytest.fixture
async def postgres_buyer():
    url = os.environ.get("BUYER_TEST_POSTGRES_URL")
    if not url:
        pytest.skip("Set BUYER_TEST_POSTGRES_URL to a disposable loopback PostgreSQL target")
    assert urlparse(url).hostname in ("127.0.0.1", "localhost", "::1"), "Only loopback targets are permitted"
    schema = "buyer_test_" + uuid.uuid4().hex
    connection = await asyncpg.connect(url, ssl=False)
    await connection.execute(f'CREATE SCHEMA "{schema}"')
    await connection.execute(f'SET search_path TO "{schema}"')
    for migration in sorted((Path(__file__).parents[1] / "migrations").glob("*.sql")):
        await connection.execute(migration.read_text(encoding="utf-8"))
    engine = create_async_engine(url.replace("postgresql://", "postgresql+asyncpg://"), connect_args={"ssl": False, "server_settings": {"search_path": schema}})
    sessions = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

    async def database():
        async with sessions() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = database
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id="synthetic-postgres")
    # The test controls permission explicitly; the default-deny gate is tested separately.
    from app.core.public_gate import verify_public_access_gate
    app.dependency_overrides[verify_public_access_gate] = lambda: True
    try:
        async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as client:
            order = await _create_test_order(client)
            yield client, connection, sessions, order
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()
        await connection.execute(f'DROP SCHEMA "{schema}" CASCADE')
        await connection.close()
