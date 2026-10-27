import base64
import json
import math
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from urllib.error import URLError
from urllib.request import Request, urlopen

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from fastapi import HTTPException, status

# Clerk documents a 5000ms clock-skew allowance. Bound nbf tolerance to that
# window; expiration remains strict so this does not extend session lifetime.
NOT_BEFORE_SKEW_SECONDS = 5


@dataclass(frozen=True)
class SellerIdentity:
    owner_id: str


class AuthenticationError(HTTPException):
    def __init__(self, message: str = "Missing or invalid seller identity") -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": message},
        )


class AuthenticationUnavailableError(HTTPException):
    def __init__(self, message: str = "Identity verification unavailable") -> None:
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "AUTH_UNAVAILABLE", "message": message},
        )


def _b64url_decode(s: str) -> bytes:
    padding_needed = 4 - (len(s) % 4)
    if padding_needed != 4:
        s += "=" * padding_needed
    return base64.urlsafe_b64decode(s.encode("ascii"))


def _jwk_to_rsa_public_key(jwk: Dict[str, Any]) -> rsa.RSAPublicKey:
    try:
        n_bytes = _b64url_decode(jwk["n"])
        e_bytes = _b64url_decode(jwk["e"])
        n_int = int.from_bytes(n_bytes, byteorder="big")
        e_int = int.from_bytes(e_bytes, byteorder="big")
        return rsa.RSAPublicNumbers(e=e_int, n=n_int).public_key()
    except Exception as exc:
        raise AuthenticationError("Invalid public key in JWKS") from exc


class ClerkTokenVerifier:
    def __init__(
        self,
        issuer: Optional[str] = None,
        jwks: Optional[Dict[str, Any]] = None,
        jwt_key_pem: Optional[str] = None,
        authorized_party: Optional[str] = None,
        audience: Optional[str] = None,
    ) -> None:
        self.issuer = issuer.rstrip("/") if issuer else None
        self.jwt_key_pem = jwt_key_pem.strip() if jwt_key_pem else None
        self.authorized_party = authorized_party
        self.audience = audience
        self._keys_by_kid: Dict[str, rsa.RSAPublicKey] = {}
        self._static_pem_key: Optional[rsa.RSAPublicKey] = None

        if self.jwt_key_pem:
            try:
                loaded = load_pem_public_key(self.jwt_key_pem.encode("utf-8"))
                if isinstance(loaded, rsa.RSAPublicKey):
                    self._static_pem_key = loaded
            except Exception as exc:
                raise AuthenticationError("Invalid static JWT PEM key") from exc

        if jwks and "keys" in jwks:
            self._load_jwks(jwks)

    def _load_jwks(self, jwks: Dict[str, Any]) -> None:
        keys: List[Dict[str, Any]] = jwks.get("keys", [])
        for k in keys:
            kid = k.get("kid")
            if kid and k.get("kty") == "RSA":
                self._keys_by_kid[kid] = _jwk_to_rsa_public_key(k)

    def _refresh_jwks(self) -> None:
        if not self.issuer:
            return
        jwks_url = f"{self.issuer}/.well-known/jwks.json"
        try:
            req = Request(jwks_url, headers={"User-Agent": "dev-template-auth"})
            with urlopen(req, timeout=5) as response:
                if response.status != 200:
                    raise AuthenticationUnavailableError("Failed to fetch JWKS from identity provider")
                raw = response.read()
                data = json.loads(raw.decode("utf-8"))
                self._load_jwks(data)
        except AuthenticationUnavailableError:
            raise
        except (URLError, TimeoutError, OSError) as exc:
            raise AuthenticationUnavailableError("Network error contacting identity provider") from exc
        except Exception as exc:
            raise AuthenticationUnavailableError("Unexpected error fetching identity provider keys") from exc

    def _get_public_key(self, kid: Optional[str]) -> rsa.RSAPublicKey:
        if self._static_pem_key is not None:
            return self._static_pem_key

        if kid and kid in self._keys_by_kid:
            return self._keys_by_kid[kid]

        # Key not in cache: attempt refresh
        self._refresh_jwks()

        if kid and kid in self._keys_by_kid:
            return self._keys_by_kid[kid]

        # If kid was not specified but only 1 key exists in JWKS:
        if not kid and len(self._keys_by_kid) == 1:
            return next(iter(self._keys_by_kid.values()))

        raise AuthenticationError("Unknown or missing key identifier (kid)")

    def verify_token(self, token: str) -> SellerIdentity:
        parts = token.strip().split(".")
        if len(parts) != 3:
            raise AuthenticationError("Malformed token structure")

        header_b64, payload_b64, sig_b64 = parts

        try:
            header_json = _b64url_decode(header_b64)
            header = json.loads(header_json.decode("utf-8"))
        except Exception as exc:
            raise AuthenticationError("Malformed token header") from exc

        if not isinstance(header, dict):
            raise AuthenticationError("Malformed token header")
        if header.get("alg") != "RS256":
            raise AuthenticationError(f"Unsupported token algorithm: {header.get('alg')}")

        try:
            payload_json = _b64url_decode(payload_b64)
            payload = json.loads(payload_json.decode("utf-8"))
        except Exception as exc:
            raise AuthenticationError("Malformed token payload") from exc
        if not isinstance(payload, dict):
            raise AuthenticationError("Malformed token payload")

        try:
            signature = _b64url_decode(sig_b64)
        except Exception as exc:
            raise AuthenticationError("Malformed token signature") from exc

        kid = header.get("kid")
        if kid is not None and (not isinstance(kid, str) or not kid):
            raise AuthenticationError("Invalid key identifier")
        public_key = self._get_public_key(kid)

        signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
        try:
            public_key.verify(
                signature,
                signing_input,
                padding.PKCS1v15(),
                hashes.SHA256(),
            )
        except InvalidSignature as exc:
            raise AuthenticationError("Invalid token signature") from exc

        # Check expiration
        exp = payload.get("exp")
        if isinstance(exp, bool) or not isinstance(exp, (int, float)) or (
            isinstance(exp, float) and not math.isfinite(exp)
        ):
            raise AuthenticationError("Token missing or invalid expiration (exp) claim")
        now = time.time()
        if now >= exp:
            raise AuthenticationError("Token has expired")
        nbf = payload.get("nbf")
        if nbf is not None and (
            isinstance(nbf, bool) or not isinstance(nbf, (int, float))
            or (isinstance(nbf, float) and not math.isfinite(nbf))
            or now + NOT_BEFORE_SKEW_SECONDS < nbf
        ):
            raise AuthenticationError("Token is not yet valid")

        # Check issuer
        if self.issuer:
            token_iss = payload.get("iss")
            if not isinstance(token_iss, str) or token_iss != self.issuer:
                raise AuthenticationError("Token issuer mismatch")

        # Check audience / authorized party if configured
        if self.audience:
            token_aud = payload.get("aud")
            aud_list = [token_aud] if isinstance(token_aud, str) else (token_aud or [])
            if not isinstance(aud_list, list) or self.audience not in aud_list:
                raise AuthenticationError("Token audience mismatch")

        if self.authorized_party:
            token_azp = payload.get("azp")
            if token_azp != self.authorized_party:
                raise AuthenticationError("Token authorized party mismatch")

        sub = payload.get("sub")
        if not sub or not isinstance(sub, str):
            raise AuthenticationError("Token missing subject (sub) claim")

        return SellerIdentity(owner_id=sub)
