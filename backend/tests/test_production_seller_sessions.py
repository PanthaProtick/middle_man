"""Production HTTP denials with local signatures and no hosted Clerk calls."""
import pytest
from test_seller_auth_integration import _generate_rsa_key_pair, _make_token

import app.core.auth as auth_module
from app.core.auth import ClerkTokenVerifier
from app.core.config import settings


@pytest.mark.asyncio
@pytest.mark.parametrize("case", ["expired", "issuer", "party", "missing_party", "signature", "dev"])
async def test_production_rejects_untrusted_sessions(client, monkeypatch, case):
    issuer = "https://clerk.shop.example"
    party = "https://shop.example"
    key, jwk = _generate_rsa_key_pair()
    monkeypatch.setattr(settings, "ENV", "production")
    monkeypatch.setattr(settings, "CLERK_ISSUER", issuer)
    monkeypatch.setattr(settings, "CLERK_AUTHORIZED_PARTY", party)
    monkeypatch.setattr(auth_module, "_clerk_verifier", ClerkTokenVerifier(
        issuer=issuer, authorized_party=party, jwks={"keys": [jwk]},
    ))
    claims = {} if case == "missing_party" else {"azp": "https://foreign.example" if case == "party" else party}
    signing_key = _generate_rsa_key_pair()[0] if case == "signature" else key
    token = _make_token(
        signing_key, "seller-alpha", "https://foreign.example" if case == "issuer" else issuer,
        exp_delta=-60 if case == "expired" else 3600, **claims,
    )
    if case == "dev":
        token = "dev-seller-alpha"
    response = await client.get("/api/seller/shop", headers={
        "Authorization": f"Bearer {token}", "X-Seller-ID": "seller-beta",
        "X-Shop-ID": "foreign-shop",
    })
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"
