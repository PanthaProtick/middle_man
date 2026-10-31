import datetime

from pydantic import AwareDatetime, BaseModel, Field


class UnseenEntryQuery(BaseModel):
    orders_since: AwareDatetime | None = None
    payments_since: AwareDatetime | None = None
    accounts_since: AwareDatetime | None = None


class UnseenEntryCounts(BaseModel):
    captured_at: datetime.datetime
    orders: int = Field(ge=0)
    payments: int = Field(ge=0)
    accounts: int = Field(ge=0)
