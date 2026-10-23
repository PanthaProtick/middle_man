import logging
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass

engine = None
AsyncSessionLocal = None

db_url = settings.effective_database_url

if db_url and settings.is_database_configured:
    # Ensure asyncpg driver prefix is used
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)

    connect_args = {}
    # Neon PgBouncer pooler recommendation: disable statement caching to prevent prepared statement conflicts
    if "-pooler" in db_url or "pooler" in db_url:
        connect_args["statement_cache_size"] = 0

    try:
        engine = create_async_engine(
            db_url, echo=settings.DEBUG, hide_parameters=True, future=True, pool_pre_ping=True, connect_args=connect_args
        )
        AsyncSessionLocal = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
        )
        logger.info("Configured Async Database Engine for Neon Postgres.")
    except Exception as e:
        logger.error(f"Failed to create database engine: {e}")
elif db_url:
    logger.info(
        "DATABASE_URL contains placeholder values. Neon database features will operate in standby mode until credentials are provided."
    )
else:
    logger.warning("DATABASE_URL is not set. Database features will operate in standby mode.")


async def get_db() -> AsyncGenerator[AsyncSession | None, None]:
    if AsyncSessionLocal is None:
        yield None
        return
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
