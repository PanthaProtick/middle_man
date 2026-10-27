from collections.abc import AsyncIterator, Iterator

import httpx
import pytest
from fastapi import FastAPI, Request

from app.core.config import settings
from app.core.public_admission import PublicAdmissionMiddleware
from app.main import app


@pytest.fixture(autouse=True)
def fresh_worker(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setattr(app, "middleware_stack", None)
    yield


@pytest.mark.asyncio
async def test_stream_is_rejected_before_reading_remaining_chunks(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "PUBLIC_REQUEST_MAX_BYTES", 8)

    async def chunks() -> AsyncIterator[bytes]:
        yield b"123456789"
        raise AssertionError("Oversized stream must not be drained")

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/public/orders/invalid/submission", content=chunks())
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PUBLIC_BODY_TOO_LARGE"
    assert "invalid" not in response.text
    assert response.headers["cache-control"] == "no-store, private"


@pytest.mark.asyncio
@pytest.mark.parametrize("length", [None, "1", "invalid"])
async def test_stream_limit_counts_actual_bytes(monkeypatch: pytest.MonkeyPatch, length: str | None) -> None:
    monkeypatch.setattr(settings, "PUBLIC_REQUEST_MAX_BYTES", 8)

    async def chunks() -> AsyncIterator[bytes]:
        yield b"1234"
        yield b"56789"
        raise AssertionError("Must stop at overflowing chunk")

    headers = {} if length is None else {"Content-Length": length}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/public/orders/another-invalid/submission", content=chunks(), headers=headers)
    assert response.status_code == 413


@pytest.mark.asyncio
async def test_declared_oversize_does_not_read_body(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "PUBLIC_REQUEST_MAX_BYTES", 8)

    async def chunks() -> AsyncIterator[bytes]:
        raise AssertionError("Declared oversized request must not be read")
        yield b""

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/public/orders/invalid/evidence", content=chunks(),
                                     headers={"Content-Length": "9"})
    assert response.status_code == 413


@pytest.mark.asyncio
async def test_quota_covers_rotating_invalid_tokens_and_recovers(monkeypatch: pytest.MonkeyPatch) -> None:
    clock = [100.0]
    monkeypatch.setattr("app.core.public_admission.monotonic", lambda: clock[0])
    monkeypatch.setattr(settings, "PUBLIC_REQUESTS_PER_WINDOW", 2)
    monkeypatch.setattr(settings, "PUBLIC_REQUEST_WINDOW_SECONDS", 10)
    # Fresh middleware instance isolates this worker's quota from other API tests.
    guarded = PublicAdmissionMiddleware(app)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=guarded), base_url="http://test") as client:
        first = await client.get("/api/public/orders/invalid-one")
        second = await client.get("/api/public/orders/invalid-two")
        assert first.status_code != 429
        assert second.status_code != 429
        rejected = await client.get("/api/public/orders/private-token", headers={"X-Forwarded-For": "different"})
        assert rejected.status_code == 429
        assert rejected.headers["retry-after"] == "10"
        assert rejected.json()["error"]["code"] == "PUBLIC_RATE_LIMITED"
        assert "private-token" not in rejected.text
        assert "different" not in rejected.text
        assert (await client.get("/api/health")).status_code != 429
        clock[0] += 10
        assert (await client.get("/api/public/orders/invalid-three")).status_code != 429


@pytest.mark.asyncio
async def test_exact_body_limit_reaches_route(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "PUBLIC_REQUEST_MAX_BYTES", 8)
    target = FastAPI()

    @target.post("/api/public/orders/{token}/{action}")
    async def echo(token: str, action: str, request: Request) -> dict[str, int]:
        return {"bytes": len(await request.body())}

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=PublicAdmissionMiddleware(target)), base_url="http://test") as client:
        normal = await client.post("/api/public/orders/token/submission", content=b"12345678")
        assert normal.json() == {"bytes": 8}
        rejected = await client.post("/api/public/orders/token/evidence", content=b"123456789")
        assert rejected.status_code == 413
