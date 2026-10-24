"""Explicit offline adapter; durable acceptance belongs to PostgreSQL."""
from datetime import datetime

from app.services.order_mapping import check_and_apply_expiry
from app.services.retention_caches import redact_import_result, references_identity
from app.services.structured_retention import calendar_deadline


async def purge_memory(now: datetime, shop_id: str) -> int:
    from app.core.idempotency import _memory_idempotency_store
    from app.models.sms import ImportResult
    from app.services.address_assistance import _memory as addresses
    from app.services.buyer_service import _memory_buyer_revisions
    from app.services.order_service import _memory_orders
    from app.services.payment_extraction import _memory as payments
    from app.services.payment_marker_protection import verify_marker_key
    from app.services.receipt_identity import receipt_identities
    from app.services.reconciliation_store import (
        _memory_allocations,
        _memory_audit_events,
        _memory_order_review_reasons,
    )
    from app.services.sms_import import _memory_imports
    from app.services.transaction_store import _memory_observations, _memory_transactions
    await verify_marker_key(None, shop_id)
    removed = 0
    for row in _memory_orders.values():
        if row['shop_id'] != shop_id or row.get('retained_at'):
            continue
        check_and_apply_expiry(row, now)
        if not row.get('completed_at') or calendar_deadline(row['completed_at']) > now:
            continue
        revisions = _memory_buyer_revisions.get(row['id'], [])
        claims = {(r['payment_provider'], r['payment_trx_id']) for r in revisions}
        erased = {row['id']}
        for receipt in list(_memory_transactions.values()):
            if receipt['shop_id'] != shop_id or receipt.get('retained_at'):
                continue
            identities = await receipt_identities(None, shop_id, receipt['id'], receipt['provider'], receipt['trx_id'])
            allocation = next((a for a in _memory_allocations.values() if a['transaction_id'] == receipt['id']), None)
            if not claims.intersection(identities) and not (allocation and allocation['order_id'] == row['id']):
                continue
            needed = any((not o.get('completed_at') or calendar_deadline(o['completed_at']) > now)
                and not o.get('retained_at') and o['shop_id'] == shop_id
                and any((r['payment_provider'], r['payment_trx_id']) in identities
                    for r in _memory_buyer_revisions.get(o['id'], [])) for o in _memory_orders.values())
            if needed:
                continue
            erased.add(receipt['id'])
            _memory_observations.pop(receipt['id'], None)
            if allocation:
                allocation.update(actor='', reason=None, accepted_amount_minor=0)
                receipt.update(trx_id='removed:' + receipt['id'], amount_minor=0, sender_number_raw=None,
                    sender_number_canonical=None, occurred_at=None, retained_at=now, reconciliation_state='used')
            else:
                del _memory_transactions[receipt['id']]
        _memory_buyer_revisions.pop(row['id'], None)
        _memory_order_review_reasons.pop(row['id'], None)
        _memory_audit_events[:] = [a for a in _memory_audit_events if a.get('aggregate_id') not in erased]
        for record in _memory_idempotency_store.values():
            if references_identity(record['data'], erased):
                record['data'] = {'record_unavailable': True}
        for key, address in list(addresses.items()):
            if address.order_id == row['id']:
                del addresses[key]
        for key, payment in list(payments.items()):
            if payment.order_id == row['id']:
                del payments[key]
        for imported in _memory_imports.values():
            if imported.shop_id != shop_id:
                continue
            result = ImportResult.model_validate_json(imported.result_json)
            redact_import_result(result, erased)
            imported.result_json = result.model_dump_json()
        for field in ('product_name', 'account_receiving_number', 'account_label', 'encrypted_portal_token', 'portal_token', 'portal_url'):
            row[field] = ''
        row.update(retained_at=now, buyer_revision=None, total_minor=0, required_advance_minor=0)
        removed += 1
    return removed
