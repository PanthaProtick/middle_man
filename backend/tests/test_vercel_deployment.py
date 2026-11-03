"""Local deployment seams; hosted routing remains ticket 09 acceptance."""
import importlib
import tomllib
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.core.config import Settings


@pytest.mark.asyncio
async def test_configured_entrypoint_serves_api_and_rejects_foreign_preview_origin():
    manifest = tomllib.loads(Path("pyproject.toml").read_text(encoding="utf-8"))
    module, attribute = manifest["tool"]["vercel"]["entrypoint"].split(":")
    app = getattr(importlib.import_module(module), attribute)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://api.example") as client:
        health = await client.get("/api/health")
        assert health.status_code == 200
        for origin, expected in [("http://localhost:5173", 200), ("https://foreign-preview.vercel.app", 400)]:
            response = await client.options("/api/health", headers={
                "Origin": origin, "Access-Control-Request-Method": "GET",
            })
            assert response.status_code == expected
            assert response.headers.get("access-control-allow-origin") == (origin if expected == 200 else None)


@pytest.mark.parametrize("overrides", [
    {"ENV": "production"},
    {"PATHAO_PRODUCTION_BOOKING_ENABLED": True},
    {"DATABASE_URL": "postgresql+asyncpg://isolated.example/db"},
    {"PGHOST": "isolated.example", "PGUSER": "preview"},
])
def test_preview_rejects_production_mode_or_unapproved_durable_access(overrides):
    with pytest.raises(ValidationError, match="Vercel preview"):
        Settings(_env_file=None, VERCEL_ENV="preview", **overrides)


def test_preview_defaults_to_offline_and_allows_explicit_isolated_self_test():
    assert not Settings(_env_file=None, VERCEL_ENV="preview").is_durable_mode
    cfg = Settings(_env_file=None, VERCEL_ENV="preview", SELF_TEST_MODE=True,
                   DATABASE_URL="postgresql+asyncpg://isolated.example/db")
    assert cfg.is_durable_mode


def test_vercel_production_cannot_skip_production_readiness():
    with pytest.raises(ValidationError, match="Vercel production requires ENV=production"):
        Settings(_env_file=None, VERCEL_ENV="production", ENV="development")
    assert Settings(_env_file=None, VERCEL_ENV="production", ENV="production").is_durable_mode
