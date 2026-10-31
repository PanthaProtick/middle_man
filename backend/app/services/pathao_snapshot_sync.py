"""Retired full hierarchy synchronization worker.

Full catalog hierarchy crawling has been decommissioned in favor of on-demand buyer
location queries. Scheduled workers and entry points now execute as no-ops without
making external provider requests.
"""
import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from app.models.pathao import Environment

logger = logging.getLogger(__name__)


async def run_one(shop: str, env: Environment, manual: bool = False,
                  bind: AsyncEngine | AsyncConnection | None = None) -> None:
    """Retired sync entry point. No-op without provider requests."""
    logger.info('Pathao catalogue synchronization is retired; skipping crawl for shop %s (%s).', shop, env)


async def run_due() -> None:
    """Retired scheduled worker entry point. No-op without provider requests."""
    logger.info('Pathao catalogue synchronization is retired; no background sync needed.')


if __name__ == '__main__':
    asyncio.run(run_due())
