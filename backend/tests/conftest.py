import os
import socket
from collections.abc import AsyncIterator, Iterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

pytest_plugins = ("buyer_postgres_support",)

# Clear provider inputs before importing the app: a developer's .env must never
# turn an offline verification run into a live database or paid API call.
for name in (
    "DATABASE_URL", "DIRECT_URL", "PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD",
    "GEMINI_API_KEY", "CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY", "CLERK_WEBHOOK_SECRET",
    "CLERK_ISSUER", "CLERK_JWT_KEY", "CLERK_AUTHORIZED_PARTY", "CLERK_AUDIENCE", "ORDER_LINK_ENCRYPTION_KEY",
    "PAYMENT_MARKER_SECRET", "PAYMENT_IDENTITY_SECRET",
):
    os.environ[name] = ""
os.environ["ENV"] = "test"
os.environ["PUBLIC_BUYER_ACCESS_POLICY"] = ""
os.environ["DEBUG"] = "false"
os.environ["API_PREFIX"] = "/api"
os.environ["PGPORT"] = "5432"
os.environ["PGSSLMODE"] = "require"
os.environ["CORS_ORIGINS"] = '["http://localhost:5173"]'
os.environ["GEMINI_MODEL"] = "gemini-2.5-flash"

from app.api.routes import _in_memory_items  # noqa: E402
from app.core.auth import SellerIdentity, get_seller_identity  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def verified_seller_identity(monkeypatch: pytest.MonkeyPatch) -> None:
    """Bounded authentication seam for storage-only API tests."""
    monkeypatch.setitem(app.dependency_overrides, get_seller_identity, lambda: SellerIdentity("pilot_seller"))


@pytest.fixture(autouse=True)
def isolated_offline_state(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    connect = socket.socket.connect
    connect_ex = socket.socket.connect_ex

    def reject_network(connection: socket.socket, address: tuple[str, int]) -> None:
        # Windows asyncio uses a loopback socket pair to wake its event loop.
        if address[0] in ("127.0.0.1", "::1"):
            return connect(connection, address)
        raise AssertionError("External network access is disabled in unit tests; mock the provider.")

    def reject_network_ex(connection: socket.socket, address: tuple[str, int]) -> int:
        if address[0] in ("127.0.0.1", "::1"):
            return connect_ex(connection, address)
        raise AssertionError("External network access is disabled in unit tests; mock the provider.")

    monkeypatch.setattr(socket.socket, "connect", reject_network)
    monkeypatch.setattr(socket.socket, "connect_ex", reject_network_ex)
    original = [item.model_copy(deep=True) for item in _in_memory_items]
    try:
        yield
    finally:
        _in_memory_items[:] = original


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
