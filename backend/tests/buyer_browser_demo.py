"""Controlled synthetic browser acceptance, never a deployment entry point.

From the root, set BUYER_TEST_POSTGRES_URL to disposable loopback PostgreSQL,
build the frontend, then run backend/.venv/Scripts/python.exe
backend/tests/buyer_browser_demo.py [--resume]. Metadata is in .cache/buyer-browser.json.
All provider inputs are cleared by the offline test bootstrap. Only this launcher
injects public permission. It serves the production frontend on 127.0.0.1:8013.
"""
import asyncio
import json
import os
import re
import sys
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
import asyncpg  # noqa: E402
import conftest  # noqa: E402,F401 -- clear provider settings before app import
import uvicorn  # noqa: E402
from fastapi import Request  # noqa: E402
from fastapi.responses import FileResponse, JSONResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from test_public_order_routes import _create_test_order  # noqa: E402

from app.core.auth import SellerIdentity, get_seller_identity  # noqa: E402
from app.core.database import get_db  # noqa: E402
from app.core.public_gate import allow_synthetic_buyer_demo, verify_public_access_gate  # noqa: E402
from app.main import app  # noqa: E402

metadata = ROOT / ".cache/buyer-browser.json"
url = os.environ["BUYER_TEST_POSTGRES_URL"]
assert urlparse(url).hostname in ("127.0.0.1", "localhost", "::1")
resume = "--resume" in sys.argv
schema = json.loads(metadata.read_text())["schema"] if resume else "buyer_browser_" + uuid.uuid4().hex
assert re.fullmatch(r"buyer_browser_[0-9a-f]{32}", schema)
engine = create_async_engine(url.replace("postgresql://", "postgresql+asyncpg://"), connect_args={"ssl": False, "server_settings": {"search_path": schema}})
sessions = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
faults = {"drop_submission": False, "fail_read": False, "hold_read": False}


async def database():
    async with sessions() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@asynccontextmanager
async def lifespan(_app):
    if not resume:
        connection = await asyncpg.connect(url, ssl=False)
        try:
            await connection.execute(f'CREATE SCHEMA "{schema}"')
            await connection.execute(f'SET search_path TO "{schema}"')
            for migration in sorted((ROOT / "backend/migrations").glob("*.sql")):
                await connection.execute(migration.read_text())
        finally:
            await connection.close()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            order = await _create_test_order(client)
        metadata.write_text(json.dumps({"schema": schema, "order": order}))
    yield
    await engine.dispose()


app.router.lifespan_context = lifespan
app.dependency_overrides[get_db] = database
app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id="synthetic-browser")
app.dependency_overrides[verify_public_access_gate] = allow_synthetic_buyer_demo


@app.middleware("http")
async def synthetic_faults(request: Request, call_next):
    if request.url.path.startswith("/api/public/orders"):
        if request.method == "GET":
            while faults["hold_read"]:
                await asyncio.sleep(0.05)
            if faults["fail_read"]:
                faults["fail_read"] = False
                return JSONResponse({"error": {"code": "SYNTHETIC_OUTAGE", "message": "Synthetic read unavailable"}}, status_code=503)
        response = await call_next(request)
        if request.method == "POST" and faults["drop_submission"] and response.status_code == 200:
            faults["drop_submission"] = False
            faults["fail_read"] = True
            return JSONResponse({"error": {"code": "SYNTHETIC_LOST_RESPONSE", "message": "Synthetic response lost after commit"}}, status_code=503)
        return response
    return await call_next(request)


@app.post("/__test__/faults")
async def configure_faults(body: dict[str, bool]):
    for key, value in body.items():
        if key in faults:
            faults[key] = value
    return faults


app.mount("/assets", StaticFiles(directory=ROOT / "frontend/dist/assets"))


@app.get("/orders/{token}")
async def buyer_page(token: str):
    return FileResponse(ROOT / "frontend/dist/index.html", headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"})


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8013, access_log=False)
