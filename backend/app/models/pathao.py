"""Write-only connection input and public seller settings projections."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

Environment = Literal['offline', 'sandbox', 'production']
DeliveryType = Literal[48, 12]


class MerchantCredentials(BaseModel):
    model_config = ConfigDict(extra='forbid', hide_input_in_errors=True)
    client_id: SecretStr = Field(min_length=1, max_length=256)
    client_secret: SecretStr = Field(min_length=1, max_length=2048)
    username: SecretStr = Field(min_length=1, max_length=256)
    password: SecretStr = Field(min_length=1, max_length=2048)


class ConnectInput(BaseModel):
    model_config = ConfigDict(extra='forbid', hide_input_in_errors=True)
    expected_version: int = Field(ge=0)
    credentials: MerchantCredentials | None = None


class DefaultsInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    expected_version: int = Field(ge=1)
    default_store_id: int = Field(gt=0)
    default_delivery_type: DeliveryType


class ConnectionView(BaseModel):
    environment: Environment
    version: int = 0
    status: Literal['disconnected', 'connected'] = 'disconnected'
    merchant_hint: str | None = None
    simulated: bool
    production_booking_enabled: Literal[False] = False
    default_store_id: int | None = None
    default_delivery_type: DeliveryType | None = None


class PickupStore(BaseModel):
    id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=200)


class StoreChoices(BaseModel):
    environment: Environment
    version: int
    simulated: bool
    stores: list[PickupStore]


class PathaoConnectionTable(Base):
    """Append-only revisions; later attempts can reference a definite configuration."""
    __tablename__ = 'pathao_connection_revisions'
    shop_id: Mapped[str] = mapped_column(String(36), ForeignKey('shops.id'), primary_key=True)
    environment: Mapped[str] = mapped_column(String(16), primary_key=True)
    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    encrypted_credentials: Mapped[str | None] = mapped_column(Text)
    default_store_id: Mapped[int | None] = mapped_column(Integer)
    default_delivery_type: Mapped[DeliveryType | None] = mapped_column(Integer)
