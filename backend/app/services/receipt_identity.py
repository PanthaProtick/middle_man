"""Retained observations reserve prior identities against duplicate receipt creation."""
from sqlalchemy import exists, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import ReceivedTransactionTable, TransactionObservationTable
from app.services.seller_service import SellerDomainException
from app.services.transaction_store import _memory_observations, _memory_transactions


async def find_receipt_identity(db: AsyncSession | None, shop_id: str, provider: str,
                                trx_id: str, *, exclude: str | None = None) -> str | None:
    # Callers hold the shop lock: absent identities and identity changes serialize.
    from app.services.payment_marker_protection import verify_marker_key
    await verify_marker_key(db, shop_id)
    if db is not None:
        historical = exists(select(TransactionObservationTable.id).where(
            TransactionObservationTable.transaction_id == ReceivedTransactionTable.id,
            TransactionObservationTable.shop_id == shop_id,
            TransactionObservationTable.provider == provider, TransactionObservationTable.trx_id == trx_id))
        query = select(ReceivedTransactionTable.id).where(ReceivedTransactionTable.shop_id == shop_id,
            or_((ReceivedTransactionTable.provider == provider) & (ReceivedTransactionTable.trx_id == trx_id), historical))
        if exclude is not None:
            query = query.where(ReceivedTransactionTable.id != exclude)
        ids = list((await db.scalars(query)).all())
    else:
        ids = [str(t['id']) for t in _memory_transactions.values() if t['shop_id'] == shop_id and t['id'] != exclude
            and ((t['provider'], t['trx_id']) == (provider, trx_id) or any(
                (o['provider'], o['trx_id']) == (provider, trx_id) for o in _memory_observations.get(str(t['id']), [])))]
    if len(ids) > 1:
        raise SellerDomainException(409, "RECEIPT_IDENTITY_COLLISION", "Multiple retained identities require explicit seller review.")
    if not ids:
        from app.services.payment_marker_protection import reject_used_identity
        await reject_used_identity(db, shop_id, provider, trx_id)
    return ids[0] if ids else None


async def receipt_identities(db: AsyncSession | None, shop_id: str, receipt_id: str,
                              provider: str, trx_id: str) -> set[tuple[str, str]]:
    if db is not None:
        rows = (await db.execute(select(TransactionObservationTable.provider, TransactionObservationTable.trx_id).where(
            TransactionObservationTable.shop_id == shop_id, TransactionObservationTable.transaction_id == receipt_id))).all()
        identities = {(p, t) for p, t in rows}
    else:
        identities = {(str(o['provider']), str(o['trx_id'])) for o in _memory_observations.get(receipt_id, [])}
    return identities | {(provider, trx_id)}
