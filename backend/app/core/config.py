import json
from typing import List, Union

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _has_placeholder(val: str, specific: list[str]) -> bool:
    if not val:
        return True
    lowered = val.lower()
    return any(ind in lowered for ind in specific + ["placeholder", "<", ">"])


class Settings(BaseSettings):
    PROJECT_NAME: str = "Dev Template API"
    ENV: str = "development"
    DEBUG: bool = True
    API_PREFIX: str = "/api"

    # Self-test integration mode (requires durable storage, real auth, private evidence)
    SELF_TEST_MODE: bool = False

    # Database (Neon Serverless Postgres)
    DATABASE_URL: str = ""
    DIRECT_URL: str = ""
    PGHOST: str = ""
    PGDATABASE: str = ""
    PGUSER: str = ""
    PGPASSWORD: str = ""
    PGPORT: int = 5432
    PGSSLMODE: str = "require"

    # Clerk Authentication
    CLERK_SECRET_KEY: str = ""
    CLERK_PUBLISHABLE_KEY: str = ""
    CLERK_WEBHOOK_SECRET: str = ""
    CLERK_ISSUER: str = ""
    CLERK_JWT_KEY: str = ""

    # Google Gemini API
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Order Link Encryption
    ORDER_LINK_ENCRYPTION_KEY: str = ""

    # Payment Marker Protection
    PAYMENT_MARKER_SECRET: str = ""
    PAYMENT_IDENTITY_SECRET: str = ""

    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    @property
    def effective_database_url(self) -> str:
        """Returns DATABASE_URL or constructs asyncpg connection string from individual PG* fields."""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        if self.PGHOST and self.PGUSER:
            password_part = f":{self.PGPASSWORD}" if self.PGPASSWORD else ""
            db_part = f"/{self.PGDATABASE}" if self.PGDATABASE else "/neondb"
            ssl_part = f"?sslmode={self.PGSSLMODE}" if self.PGSSLMODE else "?sslmode=require"
            return f"postgresql+asyncpg://{self.PGUSER}{password_part}@{self.PGHOST}:{self.PGPORT}{db_part}{ssl_part}"
        return ""

    @property
    def is_database_configured(self) -> bool:
        """Checks if a valid, non-placeholder database connection is configured."""
        url = self.effective_database_url
        if not url:
            return False
        placeholder_indicators = [
            "ep-sample",
            "ep-your-endpoint",
            "npg_password",
            "npg_your_password",
            "<endpoint>",
            "<user>",
            "<password>",
            "your-endpoint",
        ]
        if any(indicator in url for indicator in placeholder_indicators):
            return False
        return True

    @property
    def is_durable_mode(self) -> bool:
        """Determines whether durable persistence is strictly required.

        In offline development, memory fallbacks are allowed.
        In self-test integration mode or production, durable persistence is required.
        """
        return self.ENV == "production" or self.SELF_TEST_MODE

    @property
    def is_clerk_configured(self) -> bool:
        """Checks if Clerk authentication secret key is provided and not a placeholder."""
        key = self.CLERK_SECRET_KEY.strip()
        if not key:
            return False
        if key.startswith("sk_test_your_") or key == "your-clerk-secret-key" or "<" in key:
            return False
        return True

    @property
    def is_order_link_encryption_configured(self) -> bool:
        """Checks if a dedicated application key for link encryption is provided and not a placeholder."""
        key = self.ORDER_LINK_ENCRYPTION_KEY.strip()
        return bool(key) and not _has_placeholder(
            key, ["your-encryption-key", "your-order-link-encryption-key"]
        )

    @property
    def effective_payment_marker_secret(self) -> str:
        """Returns the primary marker secret or identity alias."""
        return self.PAYMENT_MARKER_SECRET.strip() or self.PAYMENT_IDENTITY_SECRET.strip()

    @property
    def is_payment_marker_protection_configured(self) -> bool:
        """Checks if a dedicated secret for payment marker protection is provided and not a placeholder."""
        secret = self.effective_payment_marker_secret
        return bool(secret) and not _has_placeholder(
            secret,
            ["your-marker-secret", "your-payment-marker-secret", "your-payment-identity-secret"],
        )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: object) -> object:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
