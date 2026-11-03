"""Public lifespan and request-session cleanup against real PostgreSQL."""
import asyncio
from contextlib import aclosing, nullcontext

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core import database
from app.core.database_engine import create_database_engine
from app.main import app, lifespan


@pytest.mark.parametrize("aborted", [False, True])
async def test_lifespan_releases_idle_connections(instance_database, monkeypatch, aborted):
    url, connection = instance_database
    engine = create_database_engine(url)
    monkeypatch.setattr(database, "engine", engine)
    try:
        with pytest.raises(RuntimeError, match="Interrupted application lifespan") if aborted else nullcontext():
            async with lifespan(app):
                async with engine.connect() as session:
                    await session.execute(text("SET application_name = 'lifespan_cleanup'"))
                    await session.commit()
                if aborted:
                    raise RuntimeError("Interrupted application lifespan")
        assert await connection.fetchval(
            "SELECT count(*) FROM pg_stat_activity WHERE application_name='lifespan_cleanup'"
        ) == 0
        # Disposal also permits a fresh lifespan on the current runtime.
        async with lifespan(app), engine.connect() as session:
            assert await session.scalar(text("SELECT 42")) == 42
    finally:
        await engine.dispose()


async def test_cancelled_request_releases_transaction_and_connection(instance_database, monkeypatch):
    url, connection = instance_database
    engine = create_database_engine(url)
    monkeypatch.setattr(database, "AsyncSessionLocal", async_sessionmaker(engine))
    started = asyncio.Event()

    async def request():
        async with aclosing(database.get_db()) as dependency:
            session = await anext(dependency)
            await session.execute(text("SELECT pg_advisory_xact_lock(123456789)"))
            started.set()
            await asyncio.Event().wait()

    task = asyncio.create_task(request())
    try:
        await asyncio.wait_for(started.wait(), 5)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert await connection.fetchval("SELECT pg_try_advisory_lock(123456789)")
        await connection.execute("SELECT pg_advisory_unlock(123456789)")
        # The same factory remains usable after cancellation.
        async with aclosing(database.get_db()) as dependency:
            session = await anext(dependency)
            assert await session.scalar(text("SELECT 42")) == 42
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        await engine.dispose()
