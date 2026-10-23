import base64
import datetime
import hashlib
import secrets
from typing import Tuple

from cryptography.fernet import Fernet

from app.core.config import settings


def get_utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def _get_fernet_cipher() -> Fernet:
    secret = settings.CLERK_SECRET_KEY or "fallback-secret-seed-for-order-encryption-key"
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_token(token: str) -> str:
    return _get_fernet_cipher().encrypt(token.encode("utf-8")).decode("utf-8")


def decrypt_token(encrypted: str) -> str:
    return _get_fernet_cipher().decrypt(encrypted.encode("utf-8")).decode("utf-8")


def generate_portal_token_materials() -> Tuple[str, str, str]:
    """Generates an opaque portal token, its SHA-256 lookup digest, and its encrypted representation."""
    portal_token = secrets.token_urlsafe(32)
    digest = hashlib.sha256(portal_token.encode("utf-8")).hexdigest()
    encrypted = encrypt_token(portal_token)
    return portal_token, digest, encrypted
