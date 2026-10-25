import base64
import json
import time

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

from app.core.auth import (
    AuthenticationError,
    AuthenticationUnavailableError,
    ClerkTokenVerifier,
    SellerIdentity,
)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _generate_rsa_key_pair():
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    public_key = private_key.public_key()
    pub_numbers = public_key.public_numbers()
    e_bytes = pub_numbers.e.to_bytes((pub_numbers.e.bit_length() + 7) // 8, byteorder="big")
    n_bytes = pub_numbers.n.to_bytes((pub_numbers.n.bit_length() + 7) // 8, byteorder="big")
    jwk = {
        "kty": "RSA",
        "kid": "test-key-id",
        "use": "sig",
        "alg": "RS256",
        "n": _b64url_encode(n_bytes),
        "e": _b64url_encode(e_bytes),
    }
    return private_key, jwk


def _create_token(
    private_key,
    headers: dict,
    payload: dict,
) -> str:
    header_b64 = _b64url_encode(json.dumps(headers).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature = private_key.sign(
        signing_input,
        padding.PKCS1v15(),
        hashes.SHA256(),
    )
    sig_b64 = _b64url_encode(signature)
    return f"{header_b64}.{payload_b64}.{sig_b64}"


def test_verify_valid_token_returns_seller_identity():
    private_key, jwk = _generate_rsa_key_pair()
    issuer = "https://clerk.example.com"
    verifier = ClerkTokenVerifier(
        issuer=issuer,
        jwks={"keys": [jwk]},
    )

    token = _create_token(
        private_key,
        headers={"alg": "RS256", "kid": "test-key-id", "typ": "JWT"},
        payload={
            "sub": "user_seller_123",
            "iss": issuer,
            "exp": int(time.time()) + 3600,
            "iat": int(time.time()),
        },
    )

    identity = verifier.verify_token(token)
    assert isinstance(identity, SellerIdentity)
    assert identity.owner_id == "user_seller_123"


@pytest.mark.parametrize("header,payload", [
    ([], {}),
    ({"alg": "RS256", "kid": []}, {}),
    ({"alg": "RS256"}, []),
    ({"alg": "RS256"}, {"exp": "tomorrow", "sub": "seller"}),
    ({"alg": "RS256"}, {"exp": True, "sub": "seller"}),
    ({"alg": "RS256"}, {"exp": float("inf"), "sub": "seller"}),
    ({"alg": "RS256"}, {"exp": 2000000000, "nbf": 2000000000, "sub": "seller"}),
    ({"alg": "RS256"}, {"exp": 1000, "sub": "seller"}),
])
def test_invalid_claim_shapes_and_time_boundaries_return_401(header, payload, monkeypatch):
    monkeypatch.setattr("app.core.clerk_verifier.time.time", lambda: 1000)
    private_key, jwk = _generate_rsa_key_pair()
    verifier = ClerkTokenVerifier(jwks={"keys": [jwk]})
    token = _create_token(private_key, header, payload)
    with pytest.raises(AuthenticationError) as exc:
        verifier.verify_token(token)
    assert exc.value.status_code == 401


def test_verify_valid_token_with_jwt_key_pem():
    private_key, _ = _generate_rsa_key_pair()
    pem_bytes = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    pem_str = pem_bytes.decode("utf-8")
    verifier = ClerkTokenVerifier(jwt_key_pem=pem_str)

    token = _create_token(
        private_key,
        headers={"alg": "RS256", "typ": "JWT"},
        payload={
            "sub": "user_seller_pem_456",
            "exp": int(time.time()) + 3600,
            "iat": int(time.time()),
        },
    )

    identity = verifier.verify_token(token)
    assert isinstance(identity, SellerIdentity)
    assert identity.owner_id == "user_seller_pem_456"


def test_expired_token_raises_authentication_error():
    private_key, jwk = _generate_rsa_key_pair()
    verifier = ClerkTokenVerifier(jwks={"keys": [jwk]})

    token = _create_token(
        private_key,
        headers={"alg": "RS256", "kid": "test-key-id", "typ": "JWT"},
        payload={
            "sub": "user_seller_123",
            "exp": int(time.time()) - 10,
        },
    )

    with pytest.raises(AuthenticationError) as exc_info:
        verifier.verify_token(token)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail["code"] == "UNAUTHORIZED"


def test_issuer_mismatch_raises_authentication_error():
    private_key, jwk = _generate_rsa_key_pair()
    verifier = ClerkTokenVerifier(
        issuer="https://clerk.expected.com",
        jwks={"keys": [jwk]},
    )

    token = _create_token(
        private_key,
        headers={"alg": "RS256", "kid": "test-key-id", "typ": "JWT"},
        payload={
            "sub": "user_seller_123",
            "iss": "https://clerk.attacker.com",
            "exp": int(time.time()) + 3600,
        },
    )

    with pytest.raises(AuthenticationError) as exc_info:
        verifier.verify_token(token)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail["code"] == "UNAUTHORIZED"


def test_tampered_signature_raises_authentication_error():
    private_key, jwk = _generate_rsa_key_pair()
    verifier = ClerkTokenVerifier(jwks={"keys": [jwk]})

    token = _create_token(
        private_key,
        headers={"alg": "RS256", "kid": "test-key-id", "typ": "JWT"},
        payload={
            "sub": "user_seller_123",
            "exp": int(time.time()) + 3600,
        },
    )

    # Tamper with the last few characters of signature
    tampered_token = token[:-4] + "AAAA"

    with pytest.raises(AuthenticationError) as exc_info:
        verifier.verify_token(tampered_token)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail["code"] == "UNAUTHORIZED"


def test_network_failure_on_key_refresh_raises_authentication_unavailable(monkeypatch):
    from urllib.error import URLError

    def mock_urlopen(*args, **kwargs):
        raise URLError("Connection refused")

    monkeypatch.setattr("app.core.clerk_verifier.urlopen", mock_urlopen)

    private_key, _ = _generate_rsa_key_pair()
    verifier = ClerkTokenVerifier(issuer="https://clerk.example.com", jwks={"keys": []})

    token = _create_token(
        private_key,
        headers={"alg": "RS256", "kid": "new-kid", "typ": "JWT"},
        payload={
            "sub": "user_seller_123",
            "iss": "https://clerk.example.com",
            "exp": int(time.time()) + 3600,
        },
    )

    with pytest.raises(AuthenticationUnavailableError) as exc_info:
        verifier.verify_token(token)
    assert exc_info.value.status_code == 503
    assert exc_info.value.detail["code"] == "AUTH_UNAVAILABLE"


def test_key_refresh_discovers_new_key_and_verifies_token(monkeypatch):
    private_key, jwk = _generate_rsa_key_pair()
    issuer = "https://clerk.example.com"

    class MockResponse:
        status = 200

        def read(self):
            return json.dumps({"keys": [jwk]}).encode("utf-8")

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_val, exc_tb):
            pass

    def mock_urlopen(req, timeout=5):
        assert req.full_url == f"{issuer}/.well-known/jwks.json"
        return MockResponse()

    monkeypatch.setattr("app.core.clerk_verifier.urlopen", mock_urlopen)

    # Initial verifier has empty keys
    verifier = ClerkTokenVerifier(issuer=issuer, jwks={"keys": []})

    token = _create_token(
        private_key,
        headers={"alg": "RS256", "kid": "test-key-id", "typ": "JWT"},
        payload={
            "sub": "user_refreshed_seller",
            "iss": issuer,
            "exp": int(time.time()) + 3600,
        },
    )

    identity = verifier.verify_token(token)
    assert identity.owner_id == "user_refreshed_seller"
