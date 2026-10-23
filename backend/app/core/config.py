import json
from typing import List, Union

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Dev Template API"
    ENV: str = "development"
    DEBUG: bool = True
    API_PREFIX: str = "/api"

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
        # Treat sample / template strings as standby
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
    def is_clerk_configured(self) -> bool:
        """Checks if Clerk authentication secret key is provided and not a placeholder."""
        key = self.CLERK_SECRET_KEY.strip()
        if not key:
            return False
        if key.startswith("sk_test_your_") or key == "your-clerk-secret-key" or "<" in key:
            return False
        return True

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
