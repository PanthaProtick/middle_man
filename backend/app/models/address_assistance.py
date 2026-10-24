"""Suggestions have no order or payment authority."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AddressExtractionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    raw_text: str = Field(min_length=1, max_length=2000)
    ai_opt_in: Literal[True]

    @field_validator("ai_opt_in", mode="before")
    @classmethod
    def explicit_boolean_consent(cls, value: object) -> object:
        if value is not True:
            raise ValueError("Explicit AI opt-in is required")
        return value

    @field_validator("raw_text")
    @classmethod
    def not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Address cannot be blank")
        return value.strip()


class AddressSuggestions(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    district: str | None = Field(max_length=100)
    thana: str | None = Field(max_length=100)
    area: str | None = Field(max_length=100)
    street_line: str | None = Field(max_length=200)
    landmark: str | None = Field(max_length=200)
    needs_clarification: bool
    clarification_question: str | None = Field(max_length=500)


class AddressExtractionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    available: bool
    suggestions: AddressSuggestions | None = None
    review_required: Literal[True] = True
    message: str
