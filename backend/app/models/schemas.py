from typing import List, Optional

from pydantic import BaseModel, Field


class HealthStatus(BaseModel):
    status: str = "healthy"
    project_name: str
    environment: str
    database_configured: bool
    gemini_configured: bool
    clerk_configured: bool = False
    version: str = "1.0.0"


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Message to send to Gemini model")
    conversation_id: Optional[str] = Field(None, description="Optional conversation context ID")
    system_instruction: Optional[str] = Field(
        "You are an intelligent hackathon assistant providing fast, high-quality, practical responses.",
        description="System prompt instructions",
    )


class ChatResponse(BaseModel):
    reply: str
    model: str
    conversation_id: Optional[str] = None
    is_mock: bool = False


class IdeaGeneratorRequest(BaseModel):
    topic: str = Field(..., description="Hackathon topic, problem statement, or domain")
    target_audience: Optional[str] = Field(None, description="Target end users")


class HackathonIdea(BaseModel):
    title: str
    tagline: str
    target_users: str
    core_features: List[str]
    suggested_tech_stack: List[str]
    winning_pitch_hook: str


class ItemCreate(BaseModel):
    title: str
    description: Optional[str] = None
    tags: List[str] = []


class ItemResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    tags: List[str] = []
    created_at: str
