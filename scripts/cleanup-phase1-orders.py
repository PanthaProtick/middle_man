"""One-time Ticket 11 runner. Default is read-only; --apply requires its snapshot.

Run from the repository root with backend/.venv/Scripts/python.exe. Reports are
written to ignored `.cache/cleanup-phase1-orders/`, never into `.scratch/`.
Only the five owner-selected Phase 1 orders on the recorded development endpoint
are eligible. No connection settings, tokens or private record values are printed.
"""
import asyncio
import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
os.chdir(ROOT / 'backend')

from sqlalchemy import select, text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database_engine import create_database_engine  # noqa: E402
from app.core.tokens import decrypt_token  # noqa: E402
from app.models.entities import OrderTable  # noqa: E402
from app.services.buyer_service import BuyerService  # noqa: E402
from app.services.obsolete_cleanup import associated_receipts, cleanup_obsolete_orders  # noqa: E402
from app.services.payment_marker_protection import reject_used_identity, verify_marker_key  # noqa: E402
from app.services.receipt_identity import receipt_identities  # noqa: E402
from app.services.retention_caches import references_identity  # noqa: E402
from app.services.seller_service import SellerDomainException  # noqa: E402

TARGETS = {
    'e0e926f5-ac4c-402d-91a8-1e0854d72270': 'beb74169-97ae-4ef9-8421-9f62e36fc26b',
    '2e48472f-f043-459a-8dcd-cc71d4cdd335': 'bd3042b7-a963-40c6-9bb7-aea4af65abd3',
    '7b2e3bd9-fbf9-4e03-bad6-1303526e4ff1': 'bd3042b7-a963-40c6-9bb7-aea4af65abd3',
    '4d466a34-8a80-4860-b03e-a4f3bc200b8a': 'bd3042b7-a963-40c6-9bb7-aea4af65abd3',
    'c22effff-10a9-42ff-b87e-2ffc258f53d0': 'beb74169-97ae-4ef9-8421-9f62e36fc26b',
}
REPORT = ROOT / '.cache/cleanup-phase1-orders/report.json'


def digest(value):
    return hashlib.sha256(json.dumps(value, default=str, sort_keys=True).encode()).hexdigest()


async def snapshot(db):
    names = (await db.execute(text("SELECT table_name FROM information_schema.tables "
        "WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"))).scalars().all()
    result = {}
    for name in names:
        rows = (await db.execute(text('SELECT * FROM "' + name.replace('"', '""') + '"'))).mappings().all()
        result[name] = sorted([dict(row) for row in rows], key=lambda row: json.dumps(row, default=str, sort_keys=True))
    return result


def allowed_rows(data, receipt_ids):
    """Build an exact row allowlist; every other row must remain byte-equivalent."""
    ids = set(TARGETS) | receipt_ids
    ids.update(r['id'] for r in data['buyer_revisions'] if r['order_id'] in TARGETS)
    sms_ids = set()
    for row in data['sms_imports']:
        for item in json.loads(row['result_json'])['items']:
            if item.get('receipt_id') in receipt_ids:
                sms_ids.add(item['evidence_id'])
    token_digests = {row['token_lookup_digest'] for row in data['orders'] if row['id'] in TARGETS}
    allowed = {}
    for table, rows in data.items():
        keys = set()
        for row in rows:
            matches = False
            if table == 'orders':
                matches = row['id'] in TARGETS
            elif table in {'buyer_revisions', 'order_review_reasons',
                           'allocations'}:
                matches = row['order_id'] in TARGETS
            elif table == 'received_transactions':
                matches = row['id'] in receipt_ids
            elif table == 'transaction_observations':
                matches = row['transaction_id'] in receipt_ids
            elif table == 'audit_events':
                matches = row['aggregate_id'] in ids
            elif table == 'link_measurements':
                matches = row['token_lookup_digest'] in token_digests
            elif table == 'idempotency_records':
                matches = references_identity(json.loads(row['response_json']), ids)
            elif table == 'sms_imports':
                matches = references_identity(json.loads(row['result_json']), receipt_ids)
            elif table == 'sms_evidence':
                matches = row['id'] in sms_ids
            if matches:
                keys.add(row.get('id', row.get('key')))
        allowed[table] = keys
    return allowed


def protected(data, allowed):
    return {table: [row for row in rows if row.get('id', row.get('key')) not in allowed[table]]
            for table, rows in data.items()}


async def main():
    apply = sys.argv[1:] == ['--apply']
    if sys.argv[1:] not in ([], ['--apply']):
        raise ValueError('Only --apply is supported')
    url = make_url(settings.effective_database_url)
    if (settings.ENV != 'development' or url.database != 'neondb' or
            hashlib.sha256((url.host or '').encode()).hexdigest()[:16] != 'ecd013abe3562868'):
        raise ValueError('Not the owner-confirmed Phase 1 development endpoint')
    engine = create_database_engine(settings.effective_database_url, debug=False)
    sessions = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    try:
        async with sessions() as db:
            if not apply:
                await db.execute(text('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY'))
            await db.execute(text("SET LOCAL statement_timeout = '30s'"))
            await db.execute(text("SET LOCAL lock_timeout = '5s'"))
            if apply:
                # Stabilize the reviewed snapshot through commit; concurrent writers wait.
                await db.execute(text('LOCK TABLE shops IN SHARE ROW EXCLUSIVE MODE'))
            rows = list((await db.scalars(select(OrderTable).where(OrderTable.id.in_(TARGETS)))).all())
            if len(rows) != 5 or any(r.shop_id != TARGETS[r.id] or str(r.created_at.date()) != '2026-10-25' for r in rows):
                raise ValueError('Phase 1 order identity mismatch')
            receipt_ids = set()
            consumed = []
            tokens = []
            for row in rows:
                if row.encrypted_portal_token:
                    tokens.append(decrypt_token(row.encrypted_portal_token))
                for receipt in await associated_receipts(db, row):
                    receipt_ids.add(receipt.id)
                    if receipt.reconciliation_state == 'used' and not receipt.retained_at:
                        consumed.extend((receipt.shop_id, p, t) for p, t in await receipt_identities(
                            db, receipt.shop_id, receipt.id, receipt.provider, receipt.trx_id))
            before = await snapshot(db)
            allowed = allowed_rows(before, receipt_ids)
            report = {'mode': 'dry-run', 'endpoint_fingerprint': 'ecd013abe3562868',
                'database': url.database, 'targets': TARGETS, 'snapshot_digest': digest(before),
                'counts': {t: len(r) for t, r in before.items()},
                'selected_rows': {t: len(keys) for t, keys in allowed.items()},
                'receipt_ids': sorted(receipt_ids)}
            REPORT.parent.mkdir(parents=True, exist_ok=True)
            if not apply:
                REPORT.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
                await db.rollback()
                print(json.dumps(report))
                return
            reviewed = json.loads(REPORT.read_text(encoding='utf-8'))
            if reviewed['snapshot_digest'] != digest(before) or reviewed['targets'] != TARGETS:
                raise ValueError('Database changed since dry run; repeat inventory before mutation')
            for shop_id in sorted(set(TARGETS.values())):
                await verify_marker_key(db, shop_id)
            result = await cleanup_obsolete_orders(db, TARGETS)
            after = await snapshot(db)
            report.update(mode='applied', result=result,
                remaining_counts={t: len(r) for t, r in after.items()},
                protected_rows_unchanged=digest(protected(before, allowed)) == digest(protected(after, allowed)))
            checks = []
            for token in tokens:
                try:
                    await BuyerService(db).get_public_order(token)
                    checks.append(False)
                except SellerDomainException as exc:
                    checks.append(exc.status_code == 410)
            report['old_links_unavailable'] = all(checks) and len(checks) == 5
            checks = []
            for shop, provider, trx in consumed:
                try:
                    await reject_used_identity(db, shop, provider, trx)
                    checks.append(False)
                except SellerDomainException as exc:
                    checks.append(exc.detail['code'] == 'PAYMENT_USED')
            report['consumed_identities_checked'] = len(checks)
            report['consumed_payments_blocked'] = bool(checks) and all(checks)
            await db.rollback()
            async with sessions() as repeated:
                report['repeat'] = await cleanup_obsolete_orders(repeated, TARGETS)
            (REPORT.parent / 'ticket11-cleanup-result.json').write_text(
                json.dumps(report, indent=2) + '\n', encoding='utf-8')
            print(json.dumps(report))
            if (result['failed'] or not report['protected_rows_unchanged'] or
                    not report['old_links_unavailable'] or not report['consumed_payments_blocked']):
                raise RuntimeError('Cleanup verification failed; inspect safe result report')
    finally:
        await engine.dispose()


if __name__ == '__main__':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    try:
        asyncio.run(main())
    except Exception as exc:
        # No raw driver diagnostics, which may contain connection/private values.
        print(json.dumps({'status': 'FAILED', 'error_type': type(exc).__name__}))
        sys.exit(1)
