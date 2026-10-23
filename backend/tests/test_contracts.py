import socket

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services.gemini import gemini_service


@pytest.mark.parametrize(
    ("endpoint", "payload"),
    [
        ("/api/chat", {}),
        ("/api/chat", {"message": ""}),
        ("/api/chat", {"message": ["invalid"]}),
        ("/api/generate-idea", {}),
        ("/api/items", {}),
        ("/api/items", {"title": "Example", "tags": "invalid"}),
    ],
)
async def test_invalid_requests_are_rejected(
    client: AsyncClient, endpoint: str, payload: dict[str, object]
) -> None:
    response = await client.post(endpoint, json=payload)
    assert response.status_code == 422
    assert response.json()["detail"]


async def test_validation_failure_does_not_create_an_item(client: AsyncClient) -> None:
    before = (await client.get("/api/items")).json()
    rejected = await client.post("/api/items", json={"title": ["invalid"]})
    assert rejected.status_code == 422
    assert (await client.get("/api/items")).json() == before


async def test_standby_configuration_is_explicit(client: AsyncClient) -> None:
    response = await client.get("/api/health")
    data = response.json()
    assert data["environment"] == "test"
    assert data["database_configured"] is False
    assert data["gemini_configured"] is False
    assert data["clerk_configured"] is False
    assert not settings.is_database_configured
    assert AsyncSessionLocal is None
    assert not gemini_service.is_configured()


async def test_chat_preserves_conversation_id_and_labels_mock(client: AsyncClient) -> None:
    response = await client.post("/api/chat", json={"message": "Hello", "conversation_id": "test-thread"})
    assert response.status_code == 200
    data = response.json()
    assert data["conversation_id"] == "test-thread"
    assert data["is_mock"] is True
    assert data["reply"]


def test_external_socket_connections_are_blocked() -> None:
    with socket.socket() as connection, pytest.raises(AssertionError, match="External network access is disabled"):
        connection.connect(("192.0.2.1", 443))
