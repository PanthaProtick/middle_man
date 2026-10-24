import asyncio
import datetime
import hashlib
import uuid
from collections.abc import Callable

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tokens import get_utc_now
from app.models.address_assistance import AddressExtractionRequest, AddressExtractionResponse, AddressSuggestions
from app.models.address_entities import AddressExtractionTable
from app.models.entities import OrderTable
from app.services.address_provider import AddressProvider
from app.services.buyer_service import _require_unsubmitted
from app.services.order_service import _check_and_apply_expiry, _memory_orders, _memory_orders_by_digest
from app.services.seller_service import IdempotencyConflictError, NotFoundError, SellerDomainException

_memory: dict[tuple[str, str], AddressExtractionTable] = {}
_locks: dict[str, asyncio.Lock] = {}


def reset_address_memory() -> None:
    _memory.clear()
    _locks.clear()


class AddressAssistance:
    def __init__(self, db: AsyncSession | None, provider: AddressProvider, clock: Callable[[], datetime.datetime] = get_utc_now):
        self.db, self.provider, self.clock = db, provider, clock

    async def extract(self, token: str, payload: AddressExtractionRequest, key: str) -> AddressExtractionResponse:
        digest = hashlib.sha256(token.strip().encode()).hexdigest()
        if self.db is None:
            async with _locks.setdefault(digest, asyncio.Lock()):
                return await self._extract(digest, payload, key)
        return await self._extract(digest, payload, key)

    async def _extract(self, digest: str, payload: AddressExtractionRequest, key: str) -> AddressExtractionResponse:
        db = self.db
        now = self.clock()
        if db is not None:
            order = await db.scalar(select(OrderTable).where(OrderTable.token_lookup_digest == digest).with_for_update())
            if order is None:
                raise NotFoundError("Order not found")
            now = self.clock()  # Time must be sampled after waiting for the lock.
            order_id, shop_id = order.id, order.shop_id
            _check_and_apply_expiry(order, now)
            if order.lifecycle == "expired":
                await db.commit()
            _require_unsubmitted(order.lifecycle)
            prior = await db.scalar(select(AddressExtractionTable).where(AddressExtractionTable.order_id == order_id, AddressExtractionTable.mutation_key == key))
            count = await db.scalar(select(func.count()).select_from(AddressExtractionTable).where(AddressExtractionTable.order_id == order_id)) or 0
        else:
            order_id = _memory_orders_by_digest.get(digest, "")
            raw = _memory_orders.get(order_id)
            if raw is None:
                raise NotFoundError("Order not found")
            shop_id = str(raw["shop_id"])
            _check_and_apply_expiry(raw, now)
            _require_unsubmitted(str(raw["lifecycle"]))
            prior = _memory.get((order_id, key))
            count = sum(1 for oid, _ in _memory if oid == order_id)
        fingerprint = hashlib.sha256(payload.model_dump_json().encode()).hexdigest()
        if prior is not None:
            if prior.payload_hash != fingerprint:
                raise IdempotencyConflictError()
            return AddressExtractionResponse.model_validate_json(prior.result_json)
        if count >= 5:
            raise SellerDomainException(429, "ADDRESS_ASSISTANCE_LIMIT", "Address assistance limit reached. Enter your address manually.")
        result = AddressExtractionResponse(available=False, message="Address assistance unavailable. Enter your address manually.")
        response_text = None
        try:
            # Order lock serializes extraction/replay and submission. Hard bound limits contention.
            async with asyncio.timeout(6):
                response_text = await self.provider.extract(payload.raw_text)
            if len(response_text) > 8192:
                response_text = None
                raise ValueError("Oversized extraction")
            suggestions = AddressSuggestions.model_validate_json(response_text)
            result = AddressExtractionResponse(available=True, suggestions=suggestions, message="Review and edit suggestions before using them.")
        except (TimeoutError, httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
            pass  # Never log private input, provider output or provider exception bodies.
        record = AddressExtractionTable(
            id=str(uuid.uuid4()), shop_id=shop_id, order_id=order_id, mutation_key=key,
            payload_hash=fingerprint, result_json=result.model_dump_json(), raw_request=payload.raw_text,
            raw_response=response_text, collected_at=now, delete_after=now + datetime.timedelta(days=30),
        )
        if db is not None:
            assert order is not None
            db.add(record)
            _check_and_apply_expiry(order, self.clock())
            await db.commit()
            _require_unsubmitted(order.lifecycle)
        else:
            assert raw is not None
            _memory[(order_id, key)] = record
            _check_and_apply_expiry(raw, self.clock())
            _require_unsubmitted(str(raw["lifecycle"]))
        return result
