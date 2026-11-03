"""Loopback-only synthetic server for cross-process durability tests (never deployed)."""
import os

import uvicorn

from app.core.auth import SellerIdentity, get_seller_identity
from app.main import app


def identity() -> SellerIdentity:
    return SellerIdentity(owner_id="durability-seller")


if __name__ == "__main__":
    assert os.environ["ENV"] == "test" and os.environ["SELF_TEST_MODE"] == "true"
    app.dependency_overrides[get_seller_identity] = identity
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=int(os.environ["DURABILITY_PORT"]),
                                           log_level="warning", access_log=False))
    server.run()
