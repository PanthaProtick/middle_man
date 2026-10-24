"""Synthetic ticket 17 acceptance; isolated loopback PostgreSQL, cleared provider settings."""
import sys
from contextlib import asynccontextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend/tests'))
import buyer_browser_demo as demo  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from test_order_export import check_buyer_csv  # noqa: E402
from test_public_order_routes import _create_test_order  # noqa: E402

demo.metadata = ROOT / '.cache/order-export-browser.json'
original_lifespan = demo.lifespan


@asynccontextmanager
async def lifespan(app):
    async with original_lifespan(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
            await check_buyer_csv(client, await _create_test_order(client))
        yield


demo.app.router.lifespan_context = lifespan
if __name__ == '__main__':
    demo.uvicorn.run(demo.app, host='127.0.0.1', port=8017, access_log=False)
