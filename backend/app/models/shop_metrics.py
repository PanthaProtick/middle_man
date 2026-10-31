import datetime

from pydantic import BaseModel, Field


class TodayShopMetrics(BaseModel):
    date: datetime.date
    timezone: str = "Asia/Dhaka"
    orders: int = Field(default=0, ge=0)
    confirmed: int = Field(default=0, ge=0)
    awaiting: int = Field(default=0, ge=0)
    pending: int = Field(default=0, ge=0)
    payments: int = Field(default=0, ge=0)
