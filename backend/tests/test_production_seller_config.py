import pytest

from app.core.config import Settings
from app.core.readiness import ProductionReadinessError, validate_seller_auth_readiness


def production_settings(**overrides):
    values = dict(
        ENV="production", CLERK_ISSUER="https://clerk.shop.example",
        CLERK_AUTHORIZED_PARTY="https://shop.example",
        CORS_ORIGINS=["https://shop.example"],
    )
    return Settings(_env_file=None, **(values | overrides))


@pytest.mark.parametrize("overrides", [
    {"CLERK_AUTHORIZED_PARTY": ""},
    {"CLERK_AUTHORIZED_PARTY": "https://foreign.example"},
    {"CLERK_AUTHORIZED_PARTY": "https://shop.example/"},
    {"CORS_ORIGINS": ["*"]},
    {"CORS_ORIGINS": ["https://shop.example", "http://localhost:5173"]},
    {"CLERK_ISSUER": "https://clerk.shop.example/path"},
    {"CLERK_ISSUER": "https://user:password@clerk.shop.example"},
    {"CLERK_ISSUER": "https://FOO.CLERK.ACCOUNTS.DEV"},
])
def test_production_rejects_incompatible_session_trust(overrides):
    with pytest.raises(ProductionReadinessError):
        validate_seller_auth_readiness(production_settings(**overrides))


def test_production_accepts_exact_frontend_origin_without_backend_secret():
    validate_seller_auth_readiness(production_settings())
