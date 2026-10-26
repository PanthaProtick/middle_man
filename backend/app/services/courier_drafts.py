"""Local proposals with seller-editable parcel facts and no provider calls."""
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.idempotency import check_idempotency_record, save_idempotency_record
from app.models.courier import CourierDraft, CourierDraftTable, CourierDraftUpdate
from app.models.entities import AllocationTable, BuyerRevisionTable, OrderTable
from app.services.retention_access import require_retained_record
from app.services.seller_service import (
    NotFoundError,
    SellerDomainException,
    StaleVersionError,
    compute_payload_hash,
)

_memory_drafts: dict[str, dict[str, Any]] = {}


def prepare_memory_draft(order_id: str, now: datetime, weight: int | None = None,
                         quantity: int | None = None) -> tuple[str, dict[str, Any]]:
    """Prepare before any allocation mutation, so local preparation failures are atomic."""
    if order_id in _memory_drafts:
        raise RuntimeError('Courier draft already exists')
    return order_id, {
        'created_at': now,
        'parcel_weight_grams': weight,
        'parcel_quantity': quantity,
        'version': 1,
    }


@dataclass
class _DraftRecord:
    order_id: str
    marker: CourierDraftTable | dict[str, Any]
    created_at: datetime
    lifecycle: str
    recipient_name: str
    contact_number: str
    address: str
    remaining_cod_minor: int
    parcel_weight_grams: int | None
    parcel_quantity: int | None
    version: int
    order_version: int
    buyer_revision: int
    buyer_location: str | None


async def get_draft(db: AsyncSession | None, shop_id: str, order_id: str) -> CourierDraft:
    return project(await _load(db, shop_id, order_id))


async def _load(db: AsyncSession | None, shop_id: str, order_id: str,
                *, lock_draft: bool = False) -> _DraftRecord:
    if db is not None:
        # Retention and buyer corrections lock the same order. Never project a mix
        # of pre-retention and post-retention records.
        order = await db.scalar(select(OrderTable).where(
            OrderTable.id == order_id, OrderTable.shop_id == shop_id).with_for_update()
            .execution_options(populate_existing=True))
        if order is None:
            raise NotFoundError('Order not found')
        require_retained_record(order)
        marker = await db.get(CourierDraftTable, order_id, with_for_update=lock_draft, populate_existing=True)
        buyer = await db.scalar(select(BuyerRevisionTable).where(
            BuyerRevisionTable.order_id == order_id,
            BuyerRevisionTable.revision_number == order.buyer_revision))
        allocation = await db.scalar(select(AllocationTable).where(AllocationTable.order_id == order_id))
        if marker is None or buyer is None or allocation is None:
            raise NotFoundError('Courier draft unavailable')
        return _DraftRecord(
            order_id=order_id, marker=marker, created_at=marker.created_at,
            lifecycle=str(order.lifecycle),
            recipient_name=str(buyer.buyer_name),
            contact_number=str(buyer.contact_number_canonical),
            address=str(buyer.address_raw),
            remaining_cod_minor=int(order.total_minor) - int(allocation.accepted_amount_minor),
            parcel_weight_grams=marker.parcel_weight_grams,
            parcel_quantity=marker.parcel_quantity,
            version=int(marker.version),
            order_version=int(order.version), buyer_revision=int(order.buyer_revision or 0),
            buyer_location=buyer.address_pathao,
        )

    from app.services.buyer_service import _memory_buyer_revisions
    from app.services.order_service import _memory_orders
    from app.services.reconciliation_store import _memory_allocations, _memory_order_allocations
    raw = _memory_orders.get(order_id)
    if raw is None or raw['shop_id'] != shop_id:
        raise NotFoundError('Order not found')
    require_retained_record(raw)
    memory_marker = _memory_drafts.get(order_id)
    revision = next((b for b in _memory_buyer_revisions.get(order_id, [])
                     if b['revision_number'] == raw.get('buyer_revision')), None)
    alloc = _memory_allocations.get(_memory_order_allocations.get(order_id, ''))
    if memory_marker is None or revision is None or alloc is None:
        raise NotFoundError('Courier draft unavailable')
    return _DraftRecord(
        order_id=order_id, marker=memory_marker, created_at=memory_marker['created_at'],
        lifecycle=str(raw['lifecycle']),
        recipient_name=str(revision['buyer_name']),
        contact_number=str(revision['contact_number_canonical']),
        address=str(revision['address_raw']),
        remaining_cod_minor=int(raw['total_minor']) - int(alloc['accepted_amount_minor']),
        parcel_weight_grams=memory_marker.get('parcel_weight_grams'),
        parcel_quantity=memory_marker.get('parcel_quantity'),
        version=int(memory_marker.get('version', 1)),
        order_version=int(raw['version']), buyer_revision=int(raw.get('buyer_revision') or 0),
        buyer_location=revision.get('address_pathao'),
    )


async def update_draft(db: AsyncSession | None, shop_id: str, actor: str, order_id: str,
                       payload: CourierDraftUpdate, key: str) -> CourierDraft:
    record = await _load(db, shop_id, order_id, lock_draft=True)
    scope = f'seller:{actor}:{order_id}'
    hashed = compute_payload_hash(payload.model_dump(mode='json'))
    cached = await check_idempotency_record(db, key, scope, 'update_courier_draft', hashed)
    if cached:
        return CourierDraft.model_validate(cached[1])
    if record.lifecycle != 'confirmed':
        raise SellerDomainException(
            409, 'INVALID_LIFECYCLE',
            'Parcel details can only be edited while the order is confirmed.',
        )
    from app.services.courier_attempts import assert_order_allows_edits
    await assert_order_allows_edits(db, order_id, 'Parcel details')
    if record.version != payload.expected_version:
        raise StaleVersionError('Courier draft changed. Refresh before editing.')
    changes = payload.model_dump(include={'parcel_weight_grams', 'parcel_quantity'}, exclude_unset=True)
    record.parcel_weight_grams = changes.get('parcel_weight_grams', record.parcel_weight_grams)
    record.parcel_quantity = changes.get('parcel_quantity', record.parcel_quantity)
    record.version += 1
    if db is not None:
        assert isinstance(record.marker, CourierDraftTable)
        record.marker.parcel_weight_grams = record.parcel_weight_grams
        record.marker.parcel_quantity = record.parcel_quantity
        record.marker.version = record.version
        await db.flush()
    else:
        assert isinstance(record.marker, dict)
        record.marker.update(parcel_weight_grams=record.parcel_weight_grams,
                             parcel_quantity=record.parcel_quantity, version=record.version)
    result = project(record)
    await save_idempotency_record(db, key, scope, 'update_courier_draft', hashed,
                                  200, result.model_dump(mode='json'), commit=False)
    if db is not None:
        await db.commit()
    return result


def project(record: _DraftRecord) -> CourierDraft:
    missing: list[Literal['weight', 'quantity']] = []
    if record.parcel_weight_grams is None:
        missing.append('weight')
    if record.parcel_quantity is None:
        missing.append('quantity')
    blockers: list[Literal['PARCEL_DETAILS_REQUIRED', 'COURIER_CONNECTION_REQUIRED',
                           'LOCATION_METADATA_REQUIRED', 'ORDER_NOT_CONFIRMED']] = []
    if missing:
        blockers.append('PARCEL_DETAILS_REQUIRED')
    blockers.extend(['COURIER_CONNECTION_REQUIRED', 'LOCATION_METADATA_REQUIRED'])
    if record.lifecycle != 'confirmed':
        blockers.append('ORDER_NOT_CONFIRMED')
    return CourierDraft(
        order_id=record.order_id, created_at=record.created_at, version=record.version,
        recipient_name=record.recipient_name, contact_number=record.contact_number,
        address=record.address, remaining_cod_minor=record.remaining_cod_minor,
        parcel_weight_grams=record.parcel_weight_grams,
        parcel_quantity=record.parcel_quantity, missing_parcel_fields=missing, blockers=blockers,
    )
