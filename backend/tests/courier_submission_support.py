"""Offline submission isolation shared by courier change scenarios."""
import pytest


@pytest.fixture(autouse=True)
def offline_settings(monkeypatch):
    from app.core.config import settings
    from app.services.courier_attempts import _memory_attempts
    from app.services.pathao_connections import _memory
    monkeypatch.setattr(settings, 'SELF_TEST_MODE', False)
    monkeypatch.setattr(settings, 'PATHAO_LOCATION_ENVIRONMENT', 'offline')
    _memory.clear()
    _memory_attempts.clear()
    yield
    _memory.clear()
    _memory_attempts.clear()


@pytest.fixture(autouse=True)
def postgres_offline_settings(monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, 'SELF_TEST_MODE', False)
    monkeypatch.setattr(settings, 'PATHAO_LOCATION_ENVIRONMENT', 'offline')
    yield
