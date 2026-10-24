"""Synthetic browser acceptance in a unique loopback PostgreSQL schema."""
import json
import sys
from contextlib import asynccontextmanager

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend/tests'))
import buyer_browser_demo as demo  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from test_structured_retention_postgres import confirm_case  # noqa: E402

demo.metadata = ROOT / '.cache/structured-retention-browser.json'
original_lifespan = demo.lifespan


@asynccontextmanager
async def lifespan(app):
    async with original_lifespan(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
            order, receipt = await confirm_case(client)
            pending = (await client.post('/api/seller/orders', json={
                'product_name': 'Keep unresolved order', 'total_minor': 1200000,
                'required_advance_minor': 200000, 'payment_account_id': order['payment_account_id']},
                headers={'Idempotency-Key': 'browser-pending'})).json()
            response = await client.post(f"/api/public/orders/{pending['portal_token']}/submission", json={
                'buyer_name': 'Synthetic unresolved buyer', 'contact_number': '01711111111',
                'address': {'raw_text': 'Synthetic unresolved address'}, 'payment_claim': {
                'provider': 'bkash', 'trx_id': 'EXCEPTION', 'sender_number': '01822222222',
                'amount_minor': 200000}}, headers={'Idempotency-Key': 'browser-pending-claim'})
            assert response.status_code == 200, response.text
        async with demo.sessions() as db:
            await db.execute(text("UPDATE orders SET completed_at='2024-02-29T13:00:00Z' WHERE id=:id"), {'id': order['id']})
            await db.commit()
        demo.metadata.write_text(json.dumps({'schema': demo.schema, 'order': order, 'pending': pending, 'receipt': receipt}))
        yield


demo.app.router.lifespan_context = lifespan
if __name__ == '__main__':
    demo.uvicorn.run(demo.app, host='127.0.0.1', port=8019, access_log=False)
