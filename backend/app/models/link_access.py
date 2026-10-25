from pydantic import BaseModel, ConfigDict, Field


class RevokeBuyerLink(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_version: int = Field(strict=True, ge=1)
