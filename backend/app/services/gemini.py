import logging
from typing import Optional, TypedDict

from app.core.config import settings
from app.models.schemas import HackathonIdea

logger = logging.getLogger(__name__)


class ChatResult(TypedDict):
    reply: str
    model: str
    is_mock: bool


class GeminiService:
    def __init__(self) -> None:
        self.client = None
        self.api_key = settings.GEMINI_API_KEY

    def is_configured(self) -> bool:
        return settings.is_gemini_configured

    async def generate_chat(self, message: str, system_instruction: Optional[str] = None) -> ChatResult:
        return {
            "reply": (
                f"[MOCK GEMINI RESPONSE] Received: '{message}'. "
                "Public demonstrations run locally in mock mode. "
                "Gemini API credentials are reserved for seller review features."
            ),
            "model": "mock-gemini-preview",
            "is_mock": True,
        }

    async def generate_structured_idea(
        self, topic: str, target_audience: Optional[str] = None
    ) -> HackathonIdea:
        return HackathonIdea(
            title=f"Smart {topic.capitalize()} Hub",
            tagline=f"Empowering {target_audience or 'users'} with real-time intelligent automation.",
            target_users=target_audience or "Developers, organizers, and end users",
            core_features=[
                "Instant data ingestion with automated categorization",
                "Predictive assistant with conversational query interface",
                "Live multi-user collaboration dashboard",
            ],
            suggested_tech_stack=["React", "FastAPI", "Neon Postgres", "Google Gemini", "uv"],
            winning_pitch_hook="Solves manual processing overhead in seconds with reliable, verifiable AI insights.",
        )


gemini_service = GeminiService()
