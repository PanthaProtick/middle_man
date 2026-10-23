from typing import Optional

from fastapi import Header, HTTPException, Request, status

from app.core.config import settings


class PublicAccessGateError(HTTPException):
    def __init__(
        self,
        status_code: int = status.HTTP_503_SERVICE_UNAVAILABLE,
        code: str = "PUBLIC_ACCESS_POLICY_UNSETTLED",
        message: str = "Public buyer access is disabled until access/projection policy is settled",
    ) -> None:
        super().__init__(
            status_code=status_code,
            detail={"code": code, "message": message},
        )


async def verify_public_access_gate(
    request: Request,
    test_gate_disabled: Optional[str] = Header(None, alias="X-Test-Public-Gate-Disabled"),
) -> bool:
    """Gate guarding public buyer operations at the public-order boundary.

    AC44: Keep live public operations disabled until buyer-access/projection policy is settled.
    In testing and development, explicit non-live permission is permitted unless explicitly disabled.
    In live production environments, public access fails closed with 503 until policy is finalized.
    """
    if test_gate_disabled == "true":
        raise PublicAccessGateError()

    if settings.ENV == "production":
        raise PublicAccessGateError()

    return True
