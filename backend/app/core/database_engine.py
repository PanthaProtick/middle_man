from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine


def create_database_engine(raw_url: str, *, debug: bool = False) -> AsyncEngine:
    url = make_url(raw_url)
    if url.drivername not in {"postgres", "postgresql", "postgresql+asyncpg", "postgresql+psycopg"}:
        raise ValueError("Unsupported database driver")
    for option in ("sslmode", "ssl", "channel_binding"):
        if option in url.query and not isinstance(url.query[option], str):
            raise ValueError(f"Database {option} must have exactly one value")
    if "sslmode" in url.query and "ssl" in url.query and url.query["sslmode"] != url.query["ssl"]:
        raise ValueError("Conflicting ssl and sslmode database options")
    if "channel_binding" in url.query:
        # libpq supports channel binding; asyncpg must never silently discard it.
        if "ssl" in url.query:
            ssl = url.query["ssl"]
            assert isinstance(ssl, str)
            url = url.difference_update_query(["ssl"]).update_query_dict({"sslmode": ssl})
        return create_async_engine(
            url.set(drivername="postgresql+psycopg"), echo=debug,
            hide_parameters=True, pool_pre_ping=True,
            connect_args={"prepare_threshold": None} if "pooler" in (url.host or "") else {},
        )
    mode = url.query.get("sslmode")
    if mode is not None:
        if not isinstance(mode, str):
            raise ValueError("Database sslmode must have exactly one value")
        url = url.difference_update_query(["sslmode"]).update_query_dict({"ssl": mode})
    connect_args = {"statement_cache_size": 0} if "pooler" in (url.host or "") else {}
    return create_async_engine(
        url.set(drivername="postgresql+asyncpg"), echo=debug,
        hide_parameters=True, pool_pre_ping=True, connect_args=connect_args,
    )
