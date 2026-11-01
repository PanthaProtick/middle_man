"""Opaque attention-query cursor: category rank, outstanding instant, order id."""
import datetime
from dataclasses import dataclass


@dataclass(frozen=True)
class CursorKey:
    rank: int
    outstanding: datetime.datetime
    order_id: str


def as_utc(value: datetime.datetime) -> datetime.datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=datetime.timezone.utc)
    return value.astimezone(datetime.timezone.utc)


def encode_cursor(rank: int, outstanding: datetime.datetime, order_id: str) -> str:
    micros = int(as_utc(outstanding).timestamp() * 1_000_000)
    return f"{rank}:{micros}:{order_id}"


def decode_cursor(cursor: str) -> CursorKey | None:
    parts = cursor.split(":", 2)
    if len(parts) != 3 or parts[0] not in {"0", "1", "2", "3"}:
        return None
    try:
        micros = int(parts[1])
    except ValueError:
        return None
    if not parts[2]:
        return None
    try:
        moment = datetime.datetime.fromtimestamp(micros / 1_000_000, tz=datetime.timezone.utc)
    except (OverflowError, OSError, ValueError):
        return None
    return CursorKey(int(parts[0]), moment, parts[2])
