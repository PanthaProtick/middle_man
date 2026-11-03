"""Production session trust uses exact HTTPS origins, never preview wildcards."""
from urllib.parse import urlsplit

from app.core.config import Settings


def validate_https_origin(value: str, name: str) -> None:
    try:
        parsed = urlsplit(value)
        valid = (
            parsed.scheme == "https" and bool(parsed.hostname)
            and parsed.hostname not in ("localhost", "127.0.0.1", "::1")
            and not parsed.username and not parsed.password
            and not parsed.path and not parsed.query and not parsed.fragment
            and value == f"https://{parsed.netloc}"
            and not any(c.isspace() for c in value) and "*" not in value
        )
        parsed.port  # Reject malformed or out-of-range ports.
    except ValueError:
        valid = False
    if not valid:
        raise ValueError(f"{name} must be an exact public https:// origin without path or credentials")


def validate_session_trust(cfg: Settings) -> None:
    validate_https_origin(cfg.CLERK_ISSUER, "CLERK_ISSUER")
    if (urlsplit(cfg.CLERK_ISSUER).hostname or "").endswith(".clerk.accounts.dev"):
        raise ValueError("Development Clerk issuer is not permitted in production")
    validate_https_origin(cfg.CLERK_AUTHORIZED_PARTY, "CLERK_AUTHORIZED_PARTY")
    origins = cfg.CORS_ORIGINS
    if not origins or isinstance(origins, str):
        raise ValueError("CORS_ORIGINS must contain exact frontend origins")
    for origin in origins:
        validate_https_origin(origin, "CORS_ORIGINS")
    if cfg.CLERK_AUTHORIZED_PARTY not in origins:
        raise ValueError("CLERK_AUTHORIZED_PARTY must match a CORS_ORIGINS entry")
