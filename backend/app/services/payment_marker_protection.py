"""Bind each shop to its marker key; rotation requires an explicit migration."""
import hmac

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import ReceivedTransactionTable, ShopTable, UsedPaymentMarkerTable
from app.models.structured_retention import PaymentMarkerKeyTable
from app.services.seller_service import SellerDomainException

_memory_keys: dict[str, str] = {}


def key_unavailable() -> SellerDomainException:
    return SellerDomainException(503, 'PAYMENT_MARKER_KEY_UNAVAILABLE',
        'Payment identity protection is unavailable. Restore the original key before retrying.')


async def verify_marker_key(db: AsyncSession | None, shop_id: str) -> None:
    from app.services.receipt_identity import receipt_identities
    from app.services.reconciliation import compute_payment_digest
    if db is not None:
        await db.execute(select(ShopTable.id).where(ShopTable.id == shop_id).with_for_update())
    try:
        fingerprint = compute_payment_digest(shop_id, 'marker-key-binding-v1', 'key-check')
    except RuntimeError as error:
        raise key_unavailable() from error
    if db is None:
        previous = _memory_keys.setdefault(shop_id, fingerprint)
        if not hmac.compare_digest(previous, fingerprint):
            raise key_unavailable()
        return
    binding = await db.get(PaymentMarkerKeyTable, shop_id)
    if binding is not None:
        if not hmac.compare_digest(binding.fingerprint, fingerprint):
            raise key_unavailable()
        return
    # Upgrade existing installations only if every historic marker can be verified.
    markers = (await db.scalars(select(UsedPaymentMarkerTable).where(
        UsedPaymentMarkerTable.shop_id == shop_id))).all()
    if markers:
        identities: set[tuple[str, str]] = set()
        receipts = (await db.scalars(select(ReceivedTransactionTable).where(
            ReceivedTransactionTable.shop_id == shop_id))).all()
        for receipt in receipts:
            identities.update(await receipt_identities(db, shop_id, receipt.id, receipt.provider, receipt.trx_id))
        valid = {(p, compute_payment_digest(shop_id, p, t)) for p, t in identities}
        if any((m.provider, m.transaction_digest) not in valid for m in markers):
            raise key_unavailable()
    db.add(PaymentMarkerKeyTable(shop_id=shop_id, fingerprint=fingerprint))
    await db.flush()


async def reject_used_identity(db: AsyncSession | None, shop_id: str, provider: str, trx_id: str) -> None:
    from app.services.reconciliation import compute_payment_digest
    await verify_marker_key(db, shop_id)
    digest = compute_payment_digest(shop_id, provider, trx_id)
    if db is not None:
        used = bool(await db.scalar(select(UsedPaymentMarkerTable.id).where(
            UsedPaymentMarkerTable.shop_id == shop_id, UsedPaymentMarkerTable.provider == provider,
            UsedPaymentMarkerTable.transaction_digest == digest).limit(1)))
    else:
        from app.services.reconciliation_store import _memory_used_payment_markers
        used = (shop_id, provider, digest) in _memory_used_payment_markers
    if used:
        raise SellerDomainException(409, 'PAYMENT_USED', 'This payment has already been consumed.')
