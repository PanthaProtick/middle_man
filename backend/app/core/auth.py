import uuid
from typing import Optional

from fastapi import Header, Request

from app.core.clerk_verifier import (
    AuthenticationError,
    AuthenticationUnavailableError,
    ClerkTokenVerifier,
    SellerIdentity,
)
from app.core.config import settings

__all__ = [
    "SellerIdentity",
    "AuthenticationError",
    "AuthenticationUnavailableError",
    "ClerkTokenVerifier",
    "NonLiveDevIdentityAdapter",
    "get_clerk_verifier",
    "get_seller_identity",
    "get_request_id",
]


class NonLiveDevIdentityAdapter:
    """Explicit non-live development identity adapter for credential-free development.

    Never active in live production environment. Request headers alone never establish live authentication.
    """
    def __init__(self, default_owner_id: str = "dev_pilot_seller") -> None:
        self.default_owner_id = default_owner_id

    def verify(self, token: str) -> Optional[SellerIdentity]:
        if token.startswith("dev-") or token == "mock-seller-token":
            owner = token.removeprefix("dev-") if token.startswith("dev-") else self.default_owner_id
            return SellerIdentity(owner_id=owner or self.default_owner_id)
        return None


_dev_identity_adapter = NonLiveDevIdentityAdapter()
_clerk_verifier: Optional[ClerkTokenVerifier] = None


def get_clerk_verifier() -> ClerkTokenVerifier:
    global _clerk_verifier
    if _clerk_verifier is None:
        if not settings.CLERK_ISSUER.strip():
            raise AuthenticationUnavailableError("Trusted identity issuer is not configured")
        try:
            _clerk_verifier = ClerkTokenVerifier(
                issuer=settings.CLERK_ISSUER,
                jwt_key_pem=settings.CLERK_JWT_KEY,
                authorized_party=settings.CLERK_AUTHORIZED_PARTY or None,
                audience=settings.CLERK_AUDIENCE or None,
            )
        except AuthenticationError as exc:
            raise AuthenticationUnavailableError("Identity verifier configuration is invalid") from exc
    return _clerk_verifier


async def get_seller_identity(
    request: Request,
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> SellerIdentity:
    """Verifies seller identity.

    Live/durable mode verifies cryptographic bearer token via Clerk or JWT key.
    Raw headers or config flags alone NEVER establish live authentication.
    In testing/offline mode, test suites explicitly inject dependency overrides.
    In development mode, an explicit non-live adapter is used for credential-free work.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise AuthenticationError("Missing or invalid seller identity")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise AuthenticationError("Empty authentication token")

    # In durable integration mode or production: default mock token never grants access
    if settings.is_durable_mode and (token == "mock-seller-token" or token.startswith("dev-")):
        raise AuthenticationError("Development seller tokens are not permitted in durable mode")

    # In production or when live/integration verifier is configured:
    if settings.is_durable_mode or settings.is_clerk_verifier_configured or _clerk_verifier is not None:
        if token.startswith("dev-") or token == "mock-seller-token":
            raise AuthenticationError("Dev or mock tokens are not permitted when identity verifier is configured")

        if not settings.is_clerk_verifier_configured and _clerk_verifier is None:
            raise AuthenticationUnavailableError("Live authentication verifier is not configured")

        return get_clerk_verifier().verify_token(token)

    # In offline development or unit testing without configured verifier:
    if settings.ENV in ("development", "test"):
        dev_identity = _dev_identity_adapter.verify(token)
        if dev_identity is not None:
            return dev_identity
        if "." in token:
            raise AuthenticationUnavailableError("Identity verification unavailable")
        raise AuthenticationError("Invalid authentication credentials")

    raise AuthenticationUnavailableError("Live authentication verifier is not configured")


def get_request_id(
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
) -> str:
    return x_request_id or str(uuid.uuid4())
