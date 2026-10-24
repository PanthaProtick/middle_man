import datetime
import uuid
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    HackathonIdea,
    HealthStatus,
    IdeaGeneratorRequest,
    ItemCreate,
    ItemResponse,
)
from app.services.gemini import gemini_service

router = APIRouter()

# In-memory store for rapid hackathon testing before database connection is set up
_in_memory_items: List[ItemResponse] = [
    ItemResponse(
        id=str(uuid.uuid4()),
        title="Dev Template Architecture",
        description="FastAPI + React + Neon Postgres + Gemini SDK setup.",
        tags=["Template", "FastAPI", "React", "Gemini"],
        created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    ),
    ItemResponse(
        id=str(uuid.uuid4()),
        title="Prompt Engineering Pipeline",
        description="Structured JSON output schemas using Gemini 2.5/3.8 Flash.",
        tags=["AI", "Gemini", "Pydantic"],
        created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    ),
]


@router.get("/health", response_model=HealthStatus, summary="API Health Check")
async def health_check() -> HealthStatus:
    return HealthStatus(
        status="healthy",
        project_name=settings.PROJECT_NAME,
        environment=settings.ENV,
        database_configured=settings.is_database_configured,
        gemini_configured=gemini_service.is_configured(),
        clerk_configured=settings.is_clerk_configured,
        version="1.0.0",
    )


@router.post("/chat", response_model=ChatResponse, summary="Send message to Gemini")
async def chat(request: ChatRequest) -> ChatResponse:
    result = await gemini_service.generate_chat(
        message=request.message, system_instruction=request.system_instruction
    )
    return ChatResponse(
        reply=result["reply"],
        model=result["model"],
        conversation_id=request.conversation_id,
        is_mock=result["is_mock"],
    )


@router.post(
    "/generate-idea", response_model=HackathonIdea, summary="Generate structured hackathon concept"
)
async def generate_idea(request: IdeaGeneratorRequest) -> HackathonIdea:
    return await gemini_service.generate_structured_idea(
        topic=request.topic, target_audience=request.target_audience
    )


@router.get("/items", response_model=List[ItemResponse], summary="List demo items")
async def list_items(db: AsyncSession | None = Depends(get_db)) -> list[ItemResponse]:
    # Can query database if available or return memory items
    return _in_memory_items


@router.post("/items", response_model=ItemResponse, summary="Create a new demo item")
async def create_item(payload: ItemCreate, db: AsyncSession | None = Depends(get_db)) -> ItemResponse:
    new_item = ItemResponse(
        id=str(uuid.uuid4()),
        title=payload.title,
        description=payload.description,
        tags=payload.tags,
        created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    )
    _in_memory_items.append(new_item)
    return new_item


@router.get("/team", summary="Team members and strengths")
async def get_team() -> dict[str, list[dict[str, str | list[str]]]]:
    return {
        "team": [
            {
                "name": "Pantha Protick",
                "role": "ML & Systems Lead / Backend Engineer",
                "strengths": ["Backend", "ML", "Database", "System"],
            },
            {
                "name": "Tanvir Hasan Ratul",
                "role": "Full-Stack Engineer",
                "strengths": ["Backend", "Frontend", "Database"],
            },
            {"name": "Yousha Shahid", "role": "Frontend Lead", "strengths": ["Frontend", "UI/UX"]},
            {
                "name": "Partha Sarathi Saha Tirtha",
                "role": "Full-Stack Engineer",
                "strengths": ["Backend", "Frontend", "Database"],
            },
        ]
    }
