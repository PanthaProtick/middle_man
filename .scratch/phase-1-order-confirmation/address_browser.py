"""Synthetic, loopback-only ticket 14 browser harness; no live Gemini calls."""
import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend/tests"))
import buyer_browser_demo as demo  # noqa: E402

from app.services.address_provider import get_address_provider  # noqa: E402


class SyntheticProvider:
    async def extract(self, address: str) -> str:
        await asyncio.sleep(0.8)
        if "unavailable" in address:
            raise TimeoutError()
        return json.dumps({"district": "Dhaka", "thana": None, "area": "Mirpur", "street_line": "Road 1", "landmark": None, "needs_clarification": True, "clarification_question": "Please check the road and thana."})


demo.metadata = ROOT / ".cache/address-browser.json"
demo.app.dependency_overrides[get_address_provider] = lambda: SyntheticProvider()

if __name__ == "__main__":
    demo.uvicorn.run(demo.app, host="127.0.0.1", port=8014, access_log=False)
