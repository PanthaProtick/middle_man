import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_team_endpoint(client: AsyncClient):
    response = await client.get("/api/team")
    assert response.status_code == 200
    data = response.json()
    assert "team" in data
    assert len(data["team"]) > 0
    assert "name" in data["team"][0]
    assert "role" in data["team"][0]


@pytest.mark.asyncio
async def test_items_crud(client: AsyncClient):
    # Fetch initial items
    response = await client.get("/api/items")
    assert response.status_code == 200
    items = response.json()
    assert isinstance(items, list)
    initial_count = len(items)

    # Create new item
    new_item_payload = {
        "title": "Agentic Architecture Spike",
        "description": "Validating automated test fixtures for agent workflow.",
        "tags": ["Agentic", "FastAPI", "Testing"]
    }
    create_res = await client.post("/api/items", json=new_item_payload)
    assert create_res.status_code == 200
    created = create_res.json()
    assert created["title"] == new_item_payload["title"]
    assert "id" in created
    assert "created_at" in created

    # Verify count increased
    response_after = await client.get("/api/items")
    items_after = response_after.json()
    assert len(items_after) == initial_count + 1


@pytest.mark.asyncio
async def test_chat_mock_fallback(client: AsyncClient):
    response = await client.post("/api/chat", json={"message": "Hello test"})
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert "model" in data


@pytest.mark.asyncio
async def test_generate_idea(client: AsyncClient):
    response = await client.post(
        "/api/generate-idea",
        json={"topic": "Fintech Automation", "target_audience": "Startups"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "title" in data
    assert "tagline" in data
    assert "core_features" in data
    assert isinstance(data["core_features"], list)
