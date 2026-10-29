from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.config import Settings
from app.core.tokens import (
    LinkEncryptionKeyIncompatibleError,
    LinkEncryptionUnavailableError,
    check_link_encryption_readiness,
    encrypt_token,
    inspect_link_encryption_compatibility,
)


@pytest.mark.asyncio
async def test_inspect_link_encryption_compatibility_empty_db() -> None:
    cfg = Settings(ORDER_LINK_ENCRYPTION_KEY="compatible-key-abc")
    session = AsyncMock()
    exec_res = MagicMock()
    exec_res.scalars.return_value.all.return_value = []
    session.execute.return_value = exec_res

    # Should complete without raising any error
    await inspect_link_encryption_compatibility(session, cfg=cfg)


@pytest.mark.asyncio
async def test_inspect_link_encryption_compatibility_compatible_tokens() -> None:
    cfg = Settings(ORDER_LINK_ENCRYPTION_KEY="compatible-key-abc")
    tok1 = encrypt_token("token-one", cfg=cfg)
    tok2 = encrypt_token("token-two", cfg=cfg)

    session = AsyncMock()
    exec_res = MagicMock()
    exec_res.scalars.return_value.all.return_value = [tok1, tok2]
    session.execute.return_value = exec_res

    await inspect_link_encryption_compatibility(session, cfg=cfg)


@pytest.mark.asyncio
async def test_inspect_link_encryption_compatibility_incompatible_tokens() -> None:
    old_cfg = Settings(ORDER_LINK_ENCRYPTION_KEY="old-deprecated-key")
    new_cfg = Settings(ORDER_LINK_ENCRYPTION_KEY="new-active-key-mismatch")

    tok_old = encrypt_token("token-encrypted-with-old-key", cfg=old_cfg)

    session = AsyncMock()
    exec_res = MagicMock()
    exec_res.scalars.return_value.all.return_value = [tok_old]
    session.execute.return_value = exec_res

    with pytest.raises(LinkEncryptionKeyIncompatibleError) as exc_info:
        await inspect_link_encryption_compatibility(session, cfg=new_cfg)

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail["code"] == "LINK_ENCRYPTION_KEY_INCOMPATIBLE"


@pytest.mark.asyncio
async def test_check_link_encryption_readiness_fails_in_durable_mode_if_unconfigured() -> None:
    cfg = Settings(SELF_TEST_MODE=True, ORDER_LINK_ENCRYPTION_KEY="")
    with pytest.raises(LinkEncryptionUnavailableError) as exc_info:
        await check_link_encryption_readiness(cfg=cfg)

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail["code"] == "LINK_ENCRYPTION_UNAVAILABLE"


@pytest.mark.asyncio
async def test_check_link_encryption_readiness_runs_compatibility_check_with_session() -> None:
    old_cfg = Settings(ORDER_LINK_ENCRYPTION_KEY="old-key")
    new_cfg = Settings(SELF_TEST_MODE=True, ORDER_LINK_ENCRYPTION_KEY="new-configured-key")

    tok_old = encrypt_token("old-token", cfg=old_cfg)

    session = AsyncMock()
    exec_res = MagicMock()
    exec_res.scalars.return_value.all.return_value = [tok_old]
    session.execute.return_value = exec_res

    factory = MagicMock()
    # async context manager on factory()
    factory.return_value.__aenter__.return_value = session
    factory.return_value.__aexit__.return_value = None

    with pytest.raises(LinkEncryptionKeyIncompatibleError):
        await check_link_encryption_readiness(cfg=new_cfg, session_factory=factory)
