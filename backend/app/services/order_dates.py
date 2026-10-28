"""Bangladesh calendar-day bounds for order creation timestamps."""
import datetime
from typing import Tuple
from zoneinfo import ZoneInfo

from app.services.seller_service import SellerDomainException

DHAKA_ZONE = ZoneInfo("Asia/Dhaka")
_UTC = datetime.timezone.utc
_ONE_DAY = datetime.timedelta(days=1)


def _dhaka_midnight_utc(day: datetime.date) -> datetime.datetime:
    return datetime.datetime.combine(day, datetime.time.min, tzinfo=DHAKA_ZONE).astimezone(_UTC)


def _exclusive_dhaka_end(day: datetime.date) -> datetime.datetime:
    if day >= datetime.date.max:
        return datetime.datetime.max.replace(tzinfo=_UTC)
    return _dhaka_midnight_utc(day + _ONE_DAY)


def _as_utc(value: datetime.datetime) -> datetime.datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=_UTC)
    return value.astimezone(_UTC)


def order_created_bounds(
    from_date: datetime.date | None,
    to_date: datetime.date | None,
) -> Tuple[datetime.datetime | None, datetime.datetime | None]:
    """Convert inclusive Bangladesh dates to a half-open UTC timestamp interval."""
    if from_date is not None and to_date is not None and from_date > to_date:
        raise SellerDomainException(
            422, "INVALID_DATE_RANGE", "Start date must be on or before end date."
        )
    start = _dhaka_midnight_utc(from_date) if from_date is not None else None
    end = _exclusive_dhaka_end(to_date) if to_date is not None else None
    return start, end


def within_order_dates(
    created_at: datetime.datetime,
    start: datetime.datetime | None,
    end: datetime.datetime | None,
) -> bool:
    """Offline equivalent of the SQL created-at bounds: start inclusive, end exclusive."""
    normalized = _as_utc(created_at)
    if start is not None and normalized < start:
        return False
    if end is not None and normalized >= end:
        return False
    return True
