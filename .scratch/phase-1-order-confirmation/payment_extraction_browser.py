"""Synthetic ticket 15 acceptance launcher; inherits offline bootstrap and isolated schema."""
import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend/tests'))
import buyer_browser_demo as demo  # noqa: E402
from app.services.payment_provider import get_payment_provider  # noqa: E402

class SyntheticPaymentProvider:
    async def extract(self, image: bytes, media_type: str) -> str:
        await asyncio.sleep(1)
        return json.dumps(dict(is_payment_screenshot=True, provider='bkash', trx_id='SYNTHETIC123', amount_minor=100000, sender_number='01712345678', receiver_number=None, occurred_at=None, unreadable_fields=['receiver_number','occurred_at']))

demo.metadata = ROOT / '.cache/payment-extraction-browser.json'
demo.app.dependency_overrides[get_payment_provider] = lambda: SyntheticPaymentProvider()
if __name__ == '__main__':
    demo.uvicorn.run(demo.app, host='127.0.0.1', port=8015, access_log=False)
