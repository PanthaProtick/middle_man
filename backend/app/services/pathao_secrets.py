"""Dedicated key material; never fall back to an authentication or payment key."""
import json

from cryptography.fernet import Fernet, InvalidToken
from pydantic import ValidationError

from app.core.config import settings
from app.models.pathao import MerchantCredentials
from app.services.seller_service import SellerDomainException


def unavailable() -> SellerDomainException:
    return SellerDomainException(503, 'PATHAO_KEY_UNAVAILABLE',
                                 'Courier encryption key is missing or incompatible. Contact the operator.')


def cipher() -> Fernet:
    key = settings.PATHAO_CREDENTIAL_ENCRYPTION_KEY.strip()
    unrelated = (settings.ORDER_LINK_ENCRYPTION_KEY, settings.CLERK_SECRET_KEY,
                 settings.CLERK_JWT_KEY, settings.PAYMENT_MARKER_SECRET, settings.PAYMENT_IDENTITY_SECRET)
    try:
        if not key or key in unrelated:
            raise ValueError
        return Fernet(key.encode('ascii'))
    except (ValueError, UnicodeError):
        raise unavailable() from None


def seal(credentials: MerchantCredentials) -> str:
    values = {name: value.get_secret_value() for name, value in credentials}
    return cipher().encrypt(json.dumps(values).encode()).decode()


def unseal(encrypted: str | None) -> MerchantCredentials:
    try:
        if encrypted is None:
            raise ValueError
        return MerchantCredentials.model_validate_json(cipher().decrypt(encrypted.encode()))
    except (InvalidToken, ValueError, ValidationError):
        raise unavailable() from None
