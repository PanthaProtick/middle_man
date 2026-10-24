import base64
import datetime
import hashlib
import secrets
from typing import Optional, Tuple

from cryptography.fernet import Fernet
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings, settings


class LinkEncryptionUnavailableError(HTTPException):
    def __init__(
        self,
        message: str = "Order link encryption key is required in integration mode, but is not configured.",
        *,
        code: str = "LINK_ENCRYPTION_UNAVAILABLE",
    ) -> None:
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": code, "message": message},
        )


class LinkEncryptionKeyIncompatibleError(LinkEncryptionUnavailableError):
    def __init__(
        self,
        message: str = "Encrypted order link cannot be decrypted with the active encryption key.",
    ) -> None:
        super().__init__(
            message=message,
            code="LINK_ENCRYPTION_KEY_INCOMPATIBLE",
        )


def validate_link_encryption_config(cfg: Settings) -> Tuple[bool, str]:
    """Validates order link encryption configuration without disclosing secrets."""
    raw = cfg.ORDER_LINK_ENCRYPTION_KEY.strip()
    if not raw:
        return False, "Order link encryption key is missing. Set ORDER_LINK_ENCRYPTION_KEY environment variable."
    if not cfg.is_order_link_encryption_configured:
        return False, "Order link encryption key contains placeholder values. Set a non-placeholder secret key."
    return True, ""


def get_utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def _get_fernet_cipher(cfg: Optional[Settings] = None) -> Fernet:
    active_cfg = cfg or settings
    if active_cfg.is_durable_mode:
        valid, reason = validate_link_encryption_config(active_cfg)
        if not valid:
            raise LinkEncryptionUnavailableError(
                message=f"Order link encryption is required in integration mode: {reason}"
            )
        secret = active_cfg.ORDER_LINK_ENCRYPTION_KEY
    else:
        if active_cfg.is_order_link_encryption_configured:
            secret = active_cfg.ORDER_LINK_ENCRYPTION_KEY
        else:
            secret = "standby-offline-dev-order-link-key"
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_token(token: str, cfg: Optional[Settings] = None) -> str:
    return _get_fernet_cipher(cfg).encrypt(token.encode("utf-8")).decode("utf-8")


def decrypt_token(encrypted: str, cfg: Optional[Settings] = None) -> str:
    cipher = _get_fernet_cipher(cfg)
    try:
        return cipher.decrypt(encrypted.encode("utf-8")).decode("utf-8")
    except Exception as exc:
        raise LinkEncryptionKeyIncompatibleError() from exc


def generate_portal_token_materials(cfg: Optional[Settings] = None) -> Tuple[str, str, str]:
    """Generates an opaque portal token, its SHA-256 lookup digest, and its encrypted representation."""
    portal_token = secrets.token_urlsafe(32)
    digest = hashlib.sha256(portal_token.encode("utf-8")).hexdigest()
    encrypted = encrypt_token(portal_token, cfg=cfg)
    return portal_token, digest, encrypted


async def inspect_link_encryption_compatibility(
    session: AsyncSession,
    cfg: Optional[Settings] = None,
) -> None:
    """Samples existing OrderTable records to verify their encrypted tokens can be decrypted with active key."""
    from sqlalchemy import select

    from app.models.entities import OrderTable

    stmt = select(OrderTable.encrypted_portal_token).where(
        OrderTable.encrypted_portal_token != ""
    ).limit(20)
    result = await session.execute(stmt)
    rows = result.scalars().all()
    for encrypted in rows:
        try:
            decrypt_token(encrypted, cfg=cfg)
        except Exception as exc:
            raise LinkEncryptionKeyIncompatibleError(
                message="Existing encrypted order links cannot be decrypted with the configured ORDER_LINK_ENCRYPTION_KEY."
            ) from exc


async def check_link_encryption_readiness(
    cfg: Optional[Settings] = None,
    session_factory: Optional[async_sessionmaker[AsyncSession]] = None,
) -> None:
    """Validates link encryption config and checks existing-record compatibility if durable database is available."""
    active_cfg = cfg or settings
    if not active_cfg.is_durable_mode:
        return

    valid, reason = validate_link_encryption_config(active_cfg)
    if not valid:
        raise LinkEncryptionUnavailableError(
            message=f"Order link encryption is required in integration mode: {reason}"
        )

    from app.core.database import AsyncSessionLocal

    factory = session_factory if session_factory is not None else AsyncSessionLocal
    if factory is not None:
        async with factory() as session:
            await inspect_link_encryption_compatibility(session, cfg=active_cfg)

