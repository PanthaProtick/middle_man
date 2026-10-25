import json
import re
from pathlib import Path
from typing import List, Literal, Union

from pydantic import Field, field_validator
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
    PUBLIC_BUYER_ACCESS_POLICY: Literal["", "self_test_link_possession"] = ""
    PUBLIC_REQUEST_MAX_BYTES: int = Field(default=64 * 1024, gt=0)
    PUBLIC_UPLOAD_MAX_BYTES: int = Field(default=6 * 1024 * 1024, gt=0)
    PUBLIC_REQUESTS_PER_WINDOW: int = Field(default=600, gt=0)
    PUBLIC_REQUEST_WINDOW_SECONDS: int = Field(default=60, gt=0)

    # Evidence Storage
    EVIDENCE_STORAGE_DIR: str = ".evidence"

    @property
    def effective_evidence_storage_path(self) -> Path:
        """Returns the resolved Path for evidence storage.
        If relative, anchors to the repository root if running from backend or repository.
        """
        p = Path(self.EVIDENCE_STORAGE_DIR)
        if p.is_absolute():
            return p
        repo_root = Path(__file__).resolve().parents[3]
        if (repo_root / ".git").exists() or (repo_root / "package.json").exists():
            return (repo_root / p).resolve()
        return p.resolve()

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
    CLERK_AUTHORIZED_PARTY: str = ""
    CLERK_AUDIENCE: str = ""

    # Google Gemini API
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    @property
    def ai_enabled(self) -> bool:
        """Self-test policy overrides provider credentials and cached suggestions."""
        return not self.SELF_TEST_MODE

    @property
    def ai_assistance_available(self) -> bool:
        return (
            self.ai_enabled
            and not _has_placeholder(self.GEMINI_API_KEY, ["your-gemini-api-key"])
            and re.fullmatch(r"[a-zA-Z0-9._-]+", self.GEMINI_MODEL) is not None
        )

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
    def is_clerk_verifier_configured(self) -> bool:
        """Checks if Clerk token verifier key or issuer is configured."""
        if self.CLERK_JWT_KEY and not _has_placeholder(self.CLERK_JWT_KEY, ["your-clerk-jwt-key"]):
            return True
        if self.CLERK_ISSUER and not _has_placeholder(self.CLERK_ISSUER, ["clerk.your-domain.com", "your-clerk-issuer"]):
            return True
        return False

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
        return self.PAYMENT_MARKER_SECRET or self.PAYMENT_IDENTITY_SECRET

    @property
    def is_payment_marker_protection_configured(self) -> bool:
        """Checks if a non-placeholder payment marker secret is configured."""
        secret = self.effective_payment_marker_secret.strip()
        return bool(secret) and not _has_placeholder(
            secret, ["your-marker-secret", "your-payment-secret"]
        )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if not v.startswith("["):
                return [i.strip() for i in v.split(",") if i.strip()]
            parsed = json.loads(v)
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
            return [str(parsed)]
        return list(v)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
