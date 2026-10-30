"""Single-process, content-free attempt reservations. Restart resets all limits."""
import hashlib
import threading
from datetime import datetime, timedelta, timezone


def now() -> datetime:
    return datetime.now(timezone.utc)


class AttemptLimits:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.day = ""
        self.total = 0
        self.last: datetime | None = None
        self.shops: dict[str, int] = {}
        self.contexts: dict[str, int] = {}
        self.inflight: set[str] = set()

    def reserve(self, shop: str, review: str, context: str, shop_limit: int) -> str | None:
        current = now()
        day = (current + timedelta(hours=6)).date().isoformat()
        with self.lock:
            if review in self.inflight:
                return "busy"
            if day != self.day:
                self.day, self.total = day, 0
                self.shops.clear()
            if (self.total >= 5 or self.shops.get(shop, 0) >= shop_limit or
                    self.contexts.get(context, 0) >= 5 or
                    (context not in self.contexts and len(self.contexts) >= 1024) or
                    (self.last is not None and (current - self.last).total_seconds() < 60)):
                return "limited"
            self.total += 1
            self.last = current
            self.shops[shop] = self.shops.get(shop, 0) + 1
            self.contexts[context] = self.contexts.get(context, 0) + 1
            self.inflight.add(review)
        return None

    def release(self, review: str) -> None:
        with self.lock:
            self.inflight.discard(review)


def opaque_key(*parts: str) -> str:
    return hashlib.sha256("\0".join(parts).encode()).hexdigest()


limits = AttemptLimits()
