"""Order replacement input contract."""
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.order import OrderInput


class OrderReplacementInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    expected_version: int = Field(ge=1, strict=True)
    reason: str = Field(min_length=1, max_length=2000)
    order: OrderInput

    @field_validator('reason')
    @classmethod
    def nonblank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError('Explain the replacement reason')
        return value.strip()
