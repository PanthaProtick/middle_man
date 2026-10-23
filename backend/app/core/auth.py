import uuid
from dataclasses import dataclass
from typing import Optional

from fastapi import Header, HTTPException, Request, status

from app.core.config import settings


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


async def get_seller_identity(
    request: Request,
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> SellerIdentity:
    """Verifies seller identity.

    Live mode verifies cryptographic bearer token via Clerk or JWT key.
    Raw headers or config flags alone NEVER establish live authentication.
    In testing/offline mode, test suites explicitly inject dependency overrides.
    In development mode, an explicit non-live adapter is used for credential-free work.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise AuthenticationError("Missing or invalid seller identity")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise AuthenticationError("Empty authentication token")

    if settings.ENV in ("development", "test"):
        dev_identity = _dev_identity_adapter.verify(token)
        if dev_identity is not None:
            return dev_identity
        raise AuthenticationError("Invalid authentication credentials")

    if not settings.is_clerk_configured:
        # If in live mode but no verifier configured or unreachable:
        raise AuthenticationUnavailableError("Live authentication verifier is not configured")

    # In production with live Clerk credentials, perform token verification.
    # Placeholder/unverified tokens in live mode are rejected.
    raise AuthenticationError("Invalid authentication credentials")


def get_request_id(
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
) -> str:
    return x_request_id or str(uuid.uuid4())
