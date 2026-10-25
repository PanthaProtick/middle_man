from fastapi import HTTPException, status

from app.core.config import settings


class PublicAccessGateError(HTTPException):
    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "PUBLIC_ACCESS_POLICY_UNSETTLED", "message": "Public buyer access is disabled until access/projection policy is settled"},
        )


async def verify_public_access_gate() -> bool:
    """Explicit local self-test consent; token and lifecycle checks remain in services."""
    if (
        settings.SELF_TEST_MODE
        and settings.ENV in ("development", "test")
        and settings.PUBLIC_BUYER_ACCESS_POLICY == "self_test_link_possession"
    ):
        return True
    raise PublicAccessGateError()


async def allow_synthetic_buyer_demo() -> bool:
    """Explicit dependency override for controlled, credential-free demonstrations only."""
    if settings.ENV not in ("development", "test") or settings.is_database_configured or settings.is_clerk_configured:
        raise PublicAccessGateError()
    return True
