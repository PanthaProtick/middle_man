"""Shared offline order state; durable records live in the configured database."""
from typing import Any

memory_orders: dict[str, dict[str, Any]] = {}
memory_orders_by_digest: dict[str, str] = {}
