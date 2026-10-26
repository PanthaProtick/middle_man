"""Local review choices and opaque optimistic concurrency contract."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.courier import CourierDraft
from app.models.pathao import ConnectionView, DeliveryType, Environment, PickupStore
from app.models.pathao_location import LocationResolution, LocationSelection


class ReviewChoices(BaseModel):
    model_config = ConfigDict(extra='forbid')
    environment: Environment = 'offline'
    store_id: int | None = Field(None, gt=0, strict=True)
    delivery_type: DeliveryType | None = None
    location: LocationSelection = Field(default_factory=LocationSelection)


class ReviewVersion(BaseModel):
    model_config = ConfigDict(extra='forbid')
    expected_token: str = Field(pattern=r'^[a-f0-9]{64}$')


class SavedReviewChoices(ReviewChoices):
    buyer_revision: int


class ReviewUpdate(ReviewChoices, ReviewVersion):
    pass


class CourierReview(BaseModel):
    draft: CourierDraft
    choices: ReviewChoices
    connection: ConnectionView
    stores: list[PickupStore]
    location: LocationResolution
    blockers: list[str]
    token: str
    reviewed: bool
    submission_enabled: Literal[False] = False
