import base64
import json

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

from app.core.clerk_verifier import AuthenticationError, ClerkTokenVerifier


@pytest.mark.parametrize(('not_before', 'expires', 'accepted'), [
    (1000, 1060, True),
    (1004.999, 1060, True),
    (1005, 1060, True),
    (1005.001, 1060, False),
    (1060, 1120, False),
    (995, 1000, False),
    (True, 1060, False),
    ('tomorrow', 1060, False),
    (float('inf'), 1060, False),
])
def test_signed_token_not_before_has_bounded_skew_without_extending_expiry(
    monkeypatch, not_before, expires, accepted,
):
    monkeypatch.setattr('app.core.clerk_verifier.time.time', lambda: 1000.0)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()
    verifier = ClerkTokenVerifier(jwt_key_pem=pem, issuer='https://issuer.test',
                                  audience='seller', authorized_party='http://localhost:5173')

    def encode(value):
        return base64.urlsafe_b64encode(value).rstrip(b'=')

    header = encode(json.dumps({'alg': 'RS256'}).encode())
    payload = encode(json.dumps({'sub': 'seller-alpha', 'nbf': not_before, 'exp': expires,
                                 'iss': 'https://issuer.test', 'aud': 'seller',
                                 'azp': 'http://localhost:5173'}).encode())
    body = header + b'.' + payload
    signature = key.sign(body, padding.PKCS1v15(), hashes.SHA256())
    token = (body + b'.' + encode(signature)).decode()
    if accepted:
        assert verifier.verify_token(token).owner_id == 'seller-alpha'
    else:
        with pytest.raises(AuthenticationError):
            verifier.verify_token(token)
