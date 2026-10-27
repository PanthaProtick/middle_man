"""One-time approved development purge. Outputs only nonsecret counts/checks."""
import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
os.chdir(ROOT / 'backend')

import psycopg
from dotenv import dotenv_values
from psycopg import sql
from sqlalchemy.engine import make_url

from app.core.config import settings

HOST = 'ep-wispy-credit-a1m2la95-pooler.ap-southeast-1.aws.neon.tech'
REPORT = ROOT / '.scratch/screenshot-purge-result.json'
MIGRATION = ROOT / 'backend/migrations/0026_remove_payment_screenshots.sql'


def digest(rows):
    return hashlib.sha256(json.dumps(sorted(rows, key=lambda r: json.dumps(r, default=str, sort_keys=True)),
        default=str, sort_keys=True).encode()).hexdigest()


def snapshot(cur, names):
    result = {}
    for name in names:
        cur.execute(sql.SQL('SELECT * FROM {}').format(sql.Identifier(name)))
        cols = [c.name for c in cur.description]
        rows = [dict(zip(cols, row, strict=True)) for row in cur.fetchall()]
        if name == 'buyer_revisions':
            for row in rows:
                row.pop('payment_evidence_id', None)
        if name == 'idempotency_records':
            rows = [row for row in rows if row['operation'] != 'buyer_evidence_upload']
        result[name] = {'count': len(rows), 'digest': digest(rows)}
    return result


def main():
    url = make_url(settings.effective_database_url)
    assert settings.ENV == 'development' and settings.SELF_TEST_MODE, 'Development self-test only'
    assert url.host == HOST and url.database == 'neondb', 'Unexpected target'
    legacy = os.environ.get('EVIDENCE_STORAGE_DIR') or dotenv_values(ROOT / 'backend/.env').get('EVIDENCE_STORAGE_DIR') or '.evidence'
    root = Path(legacy)
    if not root.is_absolute():
        root = ROOT / root
    assert root.absolute() == ROOT / '.evidence', 'Unexpected storage location'
    assert not root.is_symlink() and not root.is_junction(), 'Linked storage root'
    files = []
    if root.exists():
        for path in root.rglob('*'):
            assert not path.is_symlink() and not path.is_junction(), 'Linked storage entry'
            assert path.resolve().is_relative_to(root.resolve()), 'Storage path escapes root'
            if path.is_file():
                files.append(path)
    with psycopg.connect(url.set(drivername='postgresql').render_as_string(hide_password=False),
                         connect_timeout=15) as conn:
        with conn.cursor() as cur:
            cur.execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'")
            cur.execute('SELECT current_database(), current_schema(), pg_is_in_recovery()')
            assert cur.fetchone() == ('neondb', 'public', False), 'Unexpected database identity'
            cur.execute("SELECT pg_advisory_xact_lock(hashtext('remove-payment-screenshots-0026'))")
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")
            names = [r[0] for r in cur.fetchall()]
            retired = {'order_evidence', 'payment_extractions'}
            # Stop concurrent writes while checking exact preservation of all other rows.
            for name in names:
                mode = 'ACCESS EXCLUSIVE' if name in retired | {'buyer_revisions', 'idempotency_records'} else 'SHARE'
                cur.execute(sql.SQL('LOCK TABLE {} IN ' + mode + ' MODE').format(sql.Identifier(name)))
            before = snapshot(cur, [n for n in names if n not in retired])
            counts = {}
            for name in sorted(retired & set(names)):
                cur.execute(sql.SQL('SELECT count(*) FROM {}').format(sql.Identifier(name)))
                counts[name] = cur.fetchone()[0]
            result = {'target': HOST, 'database': 'neondb', 'environment': 'development',
                'retired_counts': counts, 'private_files': len(files),
                'private_bytes': sum(p.stat().st_size for p in files),
                'migration_sha256': hashlib.sha256(MIGRATION.read_bytes()).hexdigest()}
            if '--apply' not in sys.argv:
                print(json.dumps({**result, 'status': 'READ_ONLY'}))
                return
            # User approved permanent deletion. Fail before dropping metadata if a file cannot be erased.
            for path in files:
                path.unlink()
            assert not root.exists() or not any(p.is_file() for p in root.rglob('*')), 'Files remain'
            cur.execute(MIGRATION.read_text(encoding='utf-8'), prepare=False)
            after = snapshot(cur, [n for n in names if n not in retired])
            assert before == after, 'Unrelated records changed'
            cur.execute("SELECT to_regclass('order_evidence'), to_regclass('payment_extractions')")
            assert cur.fetchone() == (None, None)
            cur.execute("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='buyer_revisions' AND column_name='payment_evidence_id'")
            assert cur.fetchone()[0] == 0
        conn.commit()
    if root.exists():
        for directory in sorted((p for p in root.rglob('*') if p.is_dir()), key=lambda p: len(p.parts), reverse=True):
            directory.rmdir()
        root.rmdir()
    result.update(status='PASS', unrelated_rows_preserved=True, private_files_remaining=0,
                  preserved_counts={name: value['count'] for name, value in before.items()})
    REPORT.write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'status': 'FAILED', 'error_type': type(error).__name__}))
        raise SystemExit(1) from None
