import base64
import json
import time
from contextlib import contextmanager
from io import BytesIO

import pytest
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from httpx import AsyncClient

import app.core.auth as auth_module
from app.core.auth import ClerkTokenVerifier
from app.core.config import settings
from app.services.seller_service import reset_memory_store


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _generate_rsa_key_pair():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()
    pub_numbers = public_key.public_numbers()
    e_bytes = pub_numbers.e.to_bytes((pub_numbers.e.bit_length() + 7) // 8, byteorder="big")
    n_bytes = pub_numbers.n.to_bytes((pub_numbers.n.bit_length() + 7) // 8, byteorder="big")
    jwk = {
        "kty": "RSA",
        "kid": "integration-key",
        "use": "sig",
        "alg": "RS256",
        "n": _b64url_encode(n_bytes),
        "e": _b64url_encode(e_bytes),
    }
    return private_key, jwk


def _make_token(private_key, sub: str, issuer: str, exp_delta: int = 3600, **claims) -> str:
    header = {"alg": "RS256", "kid": "integration-key", "typ": "JWT"}
    payload = {
        "sub": sub,
        "iss": issuer,
        "exp": int(time.time()) + exp_delta,
        "iat": int(time.time()),
        **claims,
    }
    header_b64 = _b64url_encode(json.dumps(header).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload).encode("utf-8"))
    sig = private_key.sign(f"{header_b64}.{payload_b64}".encode("ascii"), padding.PKCS1v15(), hashes.SHA256())
    return f"{header_b64}.{payload_b64}.{_b64url_encode(sig)}"


@pytest.fixture(autouse=True)
def clean_memory_store():
    reset_memory_store()
    yield
    reset_memory_store()


@pytest.mark.asyncio
async def test_durable_mode_rejects_mock_token(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "SELF_TEST_MODE", True)

    resp_mock = await client.get(
        "/api/seller/shop",
        headers={"Authorization": "Bearer mock-seller-token"},
    )
    assert resp_mock.status_code == 401
    assert resp_mock.json()["error"]["code"] == "UNAUTHORIZED"
    resp_dev = await client.get("/api/seller/shop", headers={"Authorization": "Bearer dev-pilot_seller"})
    assert resp_dev.status_code == 401
    assert resp_dev.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_dev_and_mock_tokens_rejected_when_verifier_configured(client: AsyncClient, monkeypatch):
    issuer = "https://clerk.integration.example.com"
    monkeypatch.setattr(settings, "CLERK_ISSUER", issuer)
    _, jwk = _generate_rsa_key_pair()
    verifier = ClerkTokenVerifier(issuer=issuer, jwks={"keys": [jwk]})
    monkeypatch.setattr(auth_module, "_clerk_verifier", verifier)

    resp_dev = await client.get(
        "/api/seller/shop",
        headers={"Authorization": "Bearer dev-pilot-seller"},
    )
    assert resp_dev.status_code == 401
    assert resp_dev.json()["error"]["code"] == "UNAUTHORIZED"

    resp_mock = await client.get(
        "/api/seller/shop",
        headers={"Authorization": "Bearer mock-seller-token"},
    )
    assert resp_mock.status_code == 401
    assert resp_mock.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_unavailable_verifier_returns_503(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "CLERK_ISSUER", "")
    monkeypatch.setattr(settings, "CLERK_JWT_KEY", "")
    monkeypatch.setattr(auth_module, "_clerk_verifier", None)

    resp = await client.get(
        "/api/seller/shop",
        headers={"Authorization": "Bearer some.jwt.token"},
    )
    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "AUTH_UNAVAILABLE"


@pytest.mark.asyncio
@pytest.mark.parametrize("issuer,key", [("", "invalid-pem"), ("https://clerk.example.com", "invalid-pem")])
async def test_incomplete_or_invalid_verifier_configuration_returns_503(client, monkeypatch, issuer, key):
    monkeypatch.setattr(settings, "CLERK_ISSUER", issuer)
    monkeypatch.setattr(settings, "CLERK_JWT_KEY", key)
    monkeypatch.setattr(auth_module, "_clerk_verifier", None)
    response = await client.get("/api/seller/shop", headers={"Authorization": "Bearer signed.jwt.token"})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "AUTH_UNAVAILABLE"


@pytest.mark.asyncio
async def test_invalid_or_expired_real_token_returns_401(client: AsyncClient, monkeypatch):
    issuer = "https://clerk.integration.example.com"
    monkeypatch.setattr(settings, "CLERK_ISSUER", issuer)

    private_key, jwk = _generate_rsa_key_pair()
    verifier = ClerkTokenVerifier(issuer=issuer, jwks={"keys": [jwk]})
    monkeypatch.setattr(auth_module, "_clerk_verifier", verifier)

    # Expired token
    expired_token = _make_token(private_key, sub="clerk_seller_1", issuer=issuer, exp_delta=-100)
    resp_expired = await client.get(
        "/api/seller/shop",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert resp_expired.status_code == 401
    assert resp_expired.json()["error"]["code"] == "UNAUTHORIZED"

    # Tampered signature
    valid_token = _make_token(private_key, sub="clerk_seller_1", issuer=issuer)
    tampered_token = valid_token[:-4] + "ZZZZ"
    resp_tampered = await client.get(
        "/api/seller/shop",
        headers={"Authorization": f"Bearer {tampered_token}"},
    )
    assert resp_tampered.status_code == 401
    assert resp_tampered.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_real_token_creates_and_reads_owning_shop_with_isolation(client: AsyncClient, monkeypatch):
    issuer = "https://clerk.integration.example.com"
    monkeypatch.setattr(settings, "CLERK_ISSUER", issuer)

    private_key, jwk = _generate_rsa_key_pair()
    verifier = ClerkTokenVerifier(issuer=issuer, jwks={"keys": [jwk]})
    monkeypatch.setattr(auth_module, "_clerk_verifier", verifier)

    seller1_token = _make_token(private_key, sub="clerk_user_seller_alpha", issuer=issuer)
    seller2_token = _make_token(private_key, sub="clerk_user_seller_beta", issuer=issuer)

    # 1. Seller 1 initially has setup_needed: True
    resp1_init = await client.get("/api/seller/shop", headers={"Authorization": f"Bearer {seller1_token}"})
    assert resp1_init.status_code == 200
    assert resp1_init.json()["setup_needed"] is True
    assert resp1_init.json()["shop"] is None

    # 2. Seller 1 creates a shop
    resp1_create = await client.post(
        "/api/seller/shop",
        headers={"Authorization": f"Bearer {seller1_token}", "Idempotency-Key": "shop-create-alpha"},
        json={"display_name": "Alpha's Boutique"},
    )
    assert resp1_create.status_code == 201
    shop1_id = resp1_create.json()["shop"]["id"]
    assert resp1_create.json()["shop"]["owner_id"] == "clerk_user_seller_alpha"
    assert resp1_create.json()["shop"]["display_name"] == "Alpha's Boutique"

    # 3. Seller 2 checks shop -> isolated! setup_needed is True, no access to Seller 1's shop
    resp2_init = await client.get("/api/seller/shop", headers={"Authorization": f"Bearer {seller2_token}"})
    assert resp2_init.status_code == 200
    assert resp2_init.json()["setup_needed"] is True
    assert resp2_init.json()["shop"] is None

    # 4. Seller 2 creates their own shop
    resp2_create = await client.post(
        "/api/seller/shop",
        headers={"Authorization": f"Bearer {seller2_token}", "Idempotency-Key": "shop-create-beta"},
        json={"display_name": "Beta's Electronics"},
    )
    assert resp2_create.status_code == 201
    shop2_id = resp2_create.json()["shop"]["id"]
    assert shop2_id != shop1_id
    assert resp2_create.json()["shop"]["owner_id"] == "clerk_user_seller_beta"
    assert resp2_create.json()["shop"]["display_name"] == "Beta's Electronics"

    # 5. Seller 1 reads shop -> returns Alpha's Boutique, strictly isolated
    resp1_read = await client.get("/api/seller/shop", headers={"Authorization": f"Bearer {seller1_token}"})
    assert resp1_read.status_code == 200
    assert resp1_read.json()["setup_needed"] is False
    assert resp1_read.json()["shop"]["id"] == shop1_id
    assert resp1_read.json()["shop"]["display_name"] == "Alpha's Boutique"


@pytest.mark.asyncio
@pytest.mark.parametrize("constraint,value", [
    ("CLERK_AUTHORIZED_PARTY", "https://seller.example.com"),
    ("CLERK_AUDIENCE", "seller-api"),
])
async def test_configured_session_constraints_reject_foreign_tokens(client, monkeypatch, constraint, value):
    issuer = "https://clerk.integration.example.com"
    private_key, jwk = _generate_rsa_key_pair()
    monkeypatch.setattr(settings, "CLERK_ISSUER", issuer)
    monkeypatch.setattr(settings, "CLERK_JWT_KEY", "")
    monkeypatch.setattr(settings, constraint, value)
    monkeypatch.setattr(auth_module, "_clerk_verifier", None)
    @contextmanager
    def trusted_keys(request, timeout):
        assert request.full_url == f"{issuer}/.well-known/jwks.json"
        response = BytesIO(json.dumps({"keys": [jwk]}).encode())
        response.status = 200
        yield response

    monkeypatch.setattr("app.core.clerk_verifier.urlopen", trusted_keys)
    token = _make_token(private_key, "foreign_seller", issuer)
    response = await client.get("/api/seller/shop", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"
    assert "shop" not in response.json()
    claim = "azp" if constraint == "CLERK_AUTHORIZED_PARTY" else "aud"
    valid_token = _make_token(private_key, "owning_seller", issuer, **{claim: value})
    valid_response = await client.get("/api/seller/shop", headers={"Authorization": f"Bearer {valid_token}"})
    assert valid_response.status_code == 200
    assert valid_response.json()["setup_needed"] is True
