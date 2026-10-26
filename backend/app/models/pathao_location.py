"""Destination input and server-derived resolution; provider IDs are not district text."""
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.pathao import Environment

Condition = Literal['resolved', 'missing_choices', 'disconnected', 'unavailable', 'unsupported', 'no_area_unverified']


class LocationSelection(BaseModel):
    model_config = ConfigDict(extra='forbid')
    city_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    zone_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    area_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    unsupported: bool = False

    @model_validator(mode='after')
    def hierarchy(self) -> 'LocationSelection':
        if (self.zone_id and not self.city_id) or (self.area_id and not self.zone_id):
            raise ValueError('Select the parent location first')
        return self


class LocationResolution(LocationSelection):
    condition: Condition = 'missing_choices'
    environment: Environment = 'offline'
    city_name: Annotated[str | None, Field(max_length=200)] = None
    zone_name: Annotated[str | None, Field(max_length=200)] = None
    area_name: Annotated[str | None, Field(max_length=200)] = None
    booking_blocked: bool = True


class LocationChoice(BaseModel):
    model_config = ConfigDict(strict=True)
    id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=200)
    home_delivery_available: bool | None = None


class LocationCatalog(BaseModel):
    condition: Condition
    environment: Environment
    simulated: bool
    choices: list[LocationChoice] = Field(default_factory=list, max_length=5000)
