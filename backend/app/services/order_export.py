"""Bounded, allowlisted delivery projections; never serialize evidence or portal secrets."""
import csv
import io
import re
import uuid
from datetime import timedelta
from typing import cast

from sqlalchemy import case, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tokens import get_utc_now
from app.models.entities import AllocationTable, AuditEventTable, BuyerRevisionTable, OrderTable, ShopTable
from app.models.order_export import ExportFilters, OrderStatus, OrderSummary
from app.services.seller_service import NotFoundError, SellerDomainException

_memory_attempts: dict[str, list[float]] = {}


def money(value: int) -> str:
    return f'{value // 100}.{value % 100:02d}'


async def summaries(db: AsyncSession | None, shop_id: str, actor: str,
                    filters: ExportFilters, order_id: str | None = None) -> list[OrderSummary]:
    now = get_utc_now()
    if db is not None:
        await db.execute(text("SET LOCAL statement_timeout = '5s'"))
        await db.execute(text("SET LOCAL lock_timeout = '2s'"))
        # Serialize export admission across workers without storing personal export contents.
        await db.execute(select(ShopTable.id).where(ShopTable.id == shop_id).with_for_update())
        attempts = (await db.scalars(select(AuditEventTable.id).where(
            AuditEventTable.shop_id == shop_id, AuditEventTable.action == 'order_export',
            AuditEventTable.created_at > now - timedelta(minutes=1)).limit(10))).all()
        if len(attempts) >= 10:
            raise SellerDomainException(429, 'EXPORT_RATE_LIMIT', 'Wait one minute before exporting again.')
        db.add(AuditEventTable(id=str(uuid.uuid4()), shop_id=shop_id, aggregate_type='shop',
                              aggregate_id=shop_id, actor=actor, action='order_export', created_at=now))
        await db.commit()
        await db.execute(text("SET LOCAL statement_timeout = '5s'"))
        lifecycle = case((
            (OrderTable.lifecycle == 'awaiting_buyer') & (OrderTable.expires_at <= now), 'expired'
        ), else_=OrderTable.lifecycle)
        query = select(OrderTable, BuyerRevisionTable, AllocationTable).outerjoin(
            BuyerRevisionTable, (BuyerRevisionTable.order_id == OrderTable.id)
            & (BuyerRevisionTable.revision_number == OrderTable.buyer_revision)
        ).outerjoin(AllocationTable, (AllocationTable.order_id == OrderTable.id)
                    & (AllocationTable.shop_id == OrderTable.shop_id)).where(OrderTable.shop_id == shop_id)
        if filters.status:
            query = query.where(lifecycle == filters.status)
        if order_id:
            query = query.where(OrderTable.id == order_id)
        rows = (await db.execute(query.order_by(OrderTable.created_at.desc(), OrderTable.id.desc())
                                 .limit(filters.limit + 1))).all()
        if len(rows) > filters.limit:
            raise SellerDomainException(422, 'EXPORT_TOO_LARGE', 'Too many orders. Narrow the status filter.')
        result = []
        for order, buyer, allocation in rows:
            state = 'expired' if order.lifecycle == 'awaiting_buyer' and order.expires_at <= now else order.lifecycle
            accepted = allocation.accepted_amount_minor if allocation and state in ('confirmed', 'cancelled') else None
            result.append(project(order.id, order.product_name, state, order.total_minor,
                                  order.required_advance_minor, accepted,
                                  buyer.buyer_name if buyer else '', buyer.contact_number_canonical if buyer else '',
                                  buyer.address_raw if buyer else ''))
    else:
        from app.services.buyer_service import _memory_buyer_revisions
        from app.services.order_service import _check_and_apply_expiry, _memory_orders
        from app.services.reconciliation import get_order_allocation

        recent = [t for t in _memory_attempts.get(shop_id, []) if t > now.timestamp() - 60]
        if len(recent) >= 10:
            raise SellerDomainException(429, 'EXPORT_RATE_LIMIT', 'Wait one minute before exporting again.')
        _memory_attempts[shop_id] = [*recent, now.timestamp()]
        selected = []
        for raw in _memory_orders.values():
            if raw['shop_id'] != shop_id:
                continue
            _check_and_apply_expiry(raw, now)
            if (not filters.status or raw['lifecycle'] == filters.status) and (not order_id or raw['id'] == order_id):
                selected.append(raw)
                if len(selected) > filters.limit:
                    raise SellerDomainException(422, 'EXPORT_TOO_LARGE', 'Too many orders. Narrow the status filter.')
        result = []
        for raw in sorted(selected, key=lambda r: (r['created_at'], r['id']), reverse=True):
            memory_buyer = next((b for b in _memory_buyer_revisions.get(raw['id'], [])
                          if b['revision_number'] == raw.get('buyer_revision')), {})
            memory_allocation = await get_order_allocation(None, raw['id'])
            accepted = memory_allocation.accepted_amount_minor if memory_allocation and raw['lifecycle'] in ('confirmed', 'cancelled') else None
            result.append(project(raw['id'], raw['product_name'], raw['lifecycle'], raw['total_minor'],
                                  raw['required_advance_minor'], accepted, memory_buyer.get('buyer_name', ''),
                                  memory_buyer.get('contact_number_canonical', ''), memory_buyer.get('address_raw', '')))
    if order_id and not result:
        raise NotFoundError('Order not found')
    return result


def project(order_id: str, product: str, lifecycle: str, total: int, required: int,
            accepted: int | None, name: str, contact: str, address: str) -> OrderSummary:
    return OrderSummary(order_id=order_id, product=product, lifecycle=cast(OrderStatus, lifecycle),
                        buyer_name=name, contact_number=contact, address=address, total_bdt=money(total),
                        required_advance_bdt=money(required), expected_cod_bdt=money(total - required),
                        accepted_advance_bdt=money(accepted) if accepted is not None else '',
                        actual_cod_bdt=money(total - accepted) if accepted is not None else '')


def csv_document(items: list[OrderSummary]) -> str:
    output = io.StringIO(newline='')
    writer = csv.writer(output, quoting=csv.QUOTE_ALL)
    writer.writerow(OrderSummary.model_fields)
    for item in items:
        # Quote every cell for delimiters/newlines; prefix dangerous text after whitespace/control characters.
        values = item.model_dump().values()
        writer.writerow("'" + value if re.match(r'^[\s\x00-\x1f\ufeff]*[=+@-]', value)
                        or (value and ord(value[0]) < 32) else value for value in values)
    return output.getvalue()
