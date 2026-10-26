"""Local proposals, with no provider calls or duplicated recipient storage."""
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.courier import CourierDraft, CourierDraftTable
from app.models.entities import AllocationTable, BuyerRevisionTable, OrderTable
from app.services.retention_access import require_retained_record
from app.services.seller_service import NotFoundError

_memory_drafts: dict[str, datetime] = {}


def prepare_memory_draft(order_id: str, now: datetime) -> tuple[str, datetime]:
    """Prepare before any allocation mutation, so local preparation failures are atomic."""
    if order_id in _memory_drafts:
        raise RuntimeError('Courier draft already exists')
    return order_id, now


async def get_draft(db: AsyncSession | None, shop_id: str, order_id: str) -> CourierDraft:
    if db is not None:
        # Retention and buyer corrections lock the same order. Never project a mix
        # of pre-retention and post-retention records.
        order = await db.scalar(select(OrderTable).where(
            OrderTable.id == order_id, OrderTable.shop_id == shop_id).with_for_update())
        if order is None:
            raise NotFoundError('Order not found')
        require_retained_record(order)
        marker = await db.get(CourierDraftTable, order_id)
        buyer = await db.scalar(select(BuyerRevisionTable).where(
            BuyerRevisionTable.order_id == order_id,
            BuyerRevisionTable.revision_number == order.buyer_revision))
        allocation = await db.scalar(select(AllocationTable).where(AllocationTable.order_id == order_id))
        if marker is None or buyer is None or allocation is None:
            raise NotFoundError('Courier draft unavailable')
        return project(order_id, marker.created_at, order.lifecycle, buyer.buyer_name,
                       buyer.contact_number_canonical, buyer.address_raw,
                       order.total_minor - allocation.accepted_amount_minor)

    from app.services.buyer_service import _memory_buyer_revisions
    from app.services.order_service import _memory_orders
    from app.services.reconciliation_store import _memory_allocations, _memory_order_allocations
    raw = _memory_orders.get(order_id)
    if raw is None or raw['shop_id'] != shop_id:
        raise NotFoundError('Order not found')
    require_retained_record(raw)
    created_at = _memory_drafts.get(order_id)
    revision = next((b for b in _memory_buyer_revisions.get(order_id, [])
                     if b['revision_number'] == raw.get('buyer_revision')), None)
    alloc = _memory_allocations.get(_memory_order_allocations.get(order_id, ''))
    if created_at is None or revision is None or alloc is None:
        raise NotFoundError('Courier draft unavailable')
    return project(order_id, created_at, raw['lifecycle'], revision['buyer_name'],
                   revision['contact_number_canonical'], revision['address_raw'],
                   raw['total_minor'] - alloc['accepted_amount_minor'])


def project(order_id: str, created_at: datetime, lifecycle: str, name: str,
            contact: str, address: str, cod: int) -> CourierDraft:
    result = CourierDraft(order_id=order_id, created_at=created_at, recipient_name=name,
                          contact_number=contact, address=address, remaining_cod_minor=cod,
                          blockers=['PARCEL_DETAILS_REQUIRED', 'COURIER_CONNECTION_REQUIRED',
                                    'LOCATION_METADATA_REQUIRED'])
    if lifecycle != 'confirmed':
        result.blockers.append('ORDER_NOT_CONFIRMED')
    return result
