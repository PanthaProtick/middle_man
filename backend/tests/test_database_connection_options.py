import inspect

import asyncpg
import pytest

from app.core.database_engine import create_database_engine


@pytest.mark.parametrize("scheme", ["postgres", "postgresql", "postgresql+asyncpg"])
@pytest.mark.parametrize("mode", ["require", "verify-full", "disable"])
def test_libpq_tls_options_reach_asyncpg_without_unsupported_keywords(scheme: str, mode: str) -> None:
    engine = create_database_engine(f"{scheme}://seller:password@localhost/testdb?sslmode={mode}")
    args, kwargs = engine.sync_engine.dialect.create_connect_args(engine.url)
    inspect.signature(asyncpg.connect).bind(*args, **kwargs)
    assert kwargs["ssl"] == mode
    assert kwargs["database"] == "testdb"


def test_conflicting_tls_options_fail_instead_of_silently_weakening_tls() -> None:
    with pytest.raises(ValueError, match="Conflicting"):
        create_database_engine("postgresql://seller:password@localhost/testdb?sslmode=verify-full&ssl=disable")


def test_channel_binding_requirement_uses_a_capable_async_driver() -> None:
    engine = create_database_engine(
        "postgresql://seller:password@localhost/testdb?sslmode=verify-full&channel_binding=require"
    )
    assert engine.dialect.is_async
    assert engine.dialect.driver == "psycopg"
    _, kwargs = engine.sync_engine.dialect.create_connect_args(engine.url)
    assert kwargs["channel_binding"] == "require"
    assert kwargs["sslmode"] == "verify-full"
