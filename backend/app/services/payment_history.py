"""Private decision history and aggregate-only shop metrics."""
import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import AuditEventTable
from app.models.payment_decision import PaymentDecisionEvent, PaymentSummary
from app.models.payment_metrics import PaymentMetricsTable
from app.services.order_service import OrderService
from app.services.reconciliation_store import _memory_audit_events

_memory_payment_metrics: dict[str, PaymentSummary] = {}


async def payment_history(db: AsyncSession | None, shop_id: str, order_id: str) -> list[PaymentDecisionEvent]:
    await OrderService(db).get_order(shop_id, order_id)
    if db is not None:
        rows = (await db.scalars(select(AuditEventTable).where(AuditEventTable.shop_id == shop_id,
            AuditEventTable.aggregate_id == order_id, AuditEventTable.aggregate_type == 'order',
            AuditEventTable.action == 'order_confirmed_manual').order_by(AuditEventTable.created_at))).all()
        return [PaymentDecisionEvent(**json.loads(row.details or "{}"), actor=row.actor, created_at=row.created_at) for row in rows]
    return [PaymentDecisionEvent(**json.loads(row['details']),actor=row['actor'],created_at=row['created_at'])
        for row in _memory_audit_events if row['shop_id']==shop_id and row['aggregate_id']==order_id
        and row['aggregate_type']=='order' and row['action']=='order_confirmed_manual']


async def payment_summary(db: AsyncSession | None, shop_id: str) -> PaymentSummary:
    if db is not None:
        row = await db.get(PaymentMetricsTable, shop_id)
        return PaymentSummary(confirmed_count=row.confirmed_count,manual_count=row.manual_count,
            exception_count=row.exception_count) if row else PaymentSummary()
    return _memory_payment_metrics.get(shop_id, PaymentSummary()).model_copy()
