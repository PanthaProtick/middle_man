"""Bind each shop to its marker key; rotation requires an explicit migration."""
import hmac
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings, settings
from app.models.entities import ReceivedTransactionTable, ShopTable, UsedPaymentMarkerTable
from app.models.structured_retention import PaymentMarkerKeyTable
from app.services.seller_service import SellerDomainException

_memory_keys: dict[str, str] = {}


class PaymentMarkerKeyUnavailableError(RuntimeError):
    def __init__(self, message: str = "Payment marker protection secret is unavailable") -> None:
        super().__init__(message)


class PaymentMarkerKeyIncompatibleError(RuntimeError):
    def __init__(self, message: str = "Configured PAYMENT_MARKER_SECRET is incompatible with existing payment marker records") -> None:
        super().__init__(message)


def validate_payment_marker_config(cfg: Settings) -> tuple[bool, str]:
    """Validates payment marker protection configuration diagnostics without disclosing secrets."""
    secret = cfg.effective_payment_marker_secret
    if not secret:
        return False, "PAYMENT_MARKER_SECRET is missing or empty"
    if not cfg.is_payment_marker_protection_configured:
        return False, "PAYMENT_MARKER_SECRET contains placeholder text"
    return True, ""


def key_unavailable() -> SellerDomainException:
    return SellerDomainException(503, 'PAYMENT_MARKER_KEY_UNAVAILABLE',
        'Payment identity protection is unavailable. Restore the original key before retrying.')


async def verify_marker_key(db: AsyncSession | None, shop_id: str, *, read_only: bool = False) -> None:
    from app.services.receipt_identity import receipt_identities
    from app.services.reconciliation import compute_payment_digest
    if db is not None and not read_only:
        await db.execute(select(ShopTable.id).where(ShopTable.id == shop_id).with_for_update())
    try:
        fingerprint = compute_payment_digest(shop_id, 'marker-key-binding-v1', 'key-check')
    except RuntimeError as error:
        raise key_unavailable() from error
    if db is None:
        previous = _memory_keys.get(shop_id, fingerprint) if read_only else _memory_keys.setdefault(shop_id, fingerprint)
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
    if not read_only:
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


async def inspect_payment_marker_compatibility(
    session: AsyncSession,
    cfg: Optional[Settings] = None,
) -> None:
    """Verifies that existing payment marker bindings and historic markers are compatible with active secret."""
    active_cfg = cfg or settings
    secret = active_cfg.effective_payment_marker_secret
    if not secret:
        raise PaymentMarkerKeyUnavailableError("Payment marker protection secret is not configured")

    from app.services.receipt_identity import receipt_identities
    from app.services.reconciliation import compute_payment_digest

    bindings = (await session.scalars(select(PaymentMarkerKeyTable))).all()
    for binding in bindings:
        expected = compute_payment_digest(binding.shop_id, 'marker-key-binding-v1', 'key-check', secret=secret)
        if not hmac.compare_digest(binding.fingerprint, expected):
            raise PaymentMarkerKeyIncompatibleError(
                f"Existing payment marker key binding for shop '{binding.shop_id}' cannot be verified with the configured PAYMENT_MARKER_SECRET."
            )

    bound_shop_ids = {b.shop_id for b in bindings}
    unbound_stmt = (
        select(UsedPaymentMarkerTable).where(~UsedPaymentMarkerTable.shop_id.in_(bound_shop_ids))
        if bound_shop_ids
        else select(UsedPaymentMarkerTable)
    )
    unbound_markers = (await session.scalars(unbound_stmt)).all()
    if unbound_markers:
        unbound_by_shop: dict[str, list[UsedPaymentMarkerTable]] = {}
        for m in unbound_markers:
            unbound_by_shop.setdefault(m.shop_id, []).append(m)

        for s_id, s_markers in unbound_by_shop.items():
            receipts = (await session.scalars(select(ReceivedTransactionTable).where(
                ReceivedTransactionTable.shop_id == s_id))).all()
            if receipts:
                identities: set[tuple[str, str]] = set()
                for receipt in receipts:
                    identities.update(await receipt_identities(session, s_id, receipt.id, receipt.provider, receipt.trx_id))
                valid = {(p, compute_payment_digest(s_id, p, t, secret=secret)) for p, t in identities}
                if any((m.provider, m.transaction_digest) not in valid for m in s_markers):
                    raise PaymentMarkerKeyIncompatibleError(
                        f"Existing used payment markers for shop '{s_id}' cannot be verified with the configured PAYMENT_MARKER_SECRET."
                    )


async def check_payment_marker_readiness(
    cfg: Optional[Settings] = None,
    session_factory: Optional[async_sessionmaker[AsyncSession]] = None,
) -> None:
    """Validates payment marker config and verifies compatibility against database records if configured."""
    active_cfg = cfg or settings
    if not active_cfg.is_durable_mode and not active_cfg.is_database_configured:
        return

    valid, reason = validate_payment_marker_config(active_cfg)
    if not valid:
        raise PaymentMarkerKeyUnavailableError(
            message=f"Payment marker protection is required in durable mode: {reason}"
        )

    from app.core.database import AsyncSessionLocal

    factory = session_factory if session_factory is not None else AsyncSessionLocal
    if factory is not None:
        async with factory() as session:
            await inspect_payment_marker_compatibility(session, cfg=active_cfg)

