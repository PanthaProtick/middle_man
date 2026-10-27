import asyncio, json, sys
from pathlib import Path
sys.path.insert(0, str(Path('backend').resolve()))
from app.core.config import Settings
from app.core.database_engine import create_database_engine
from sqlalchemy import text
from sqlalchemy.engine import make_url

async def main():
    cfg = Settings(_env_file='backend/.env')
    url = make_url(cfg.effective_database_url)
    expected = json.loads(Path('.scratch/pathao-courier/remote-migrations-result.json').read_text())
    if url.host != expected['target'] or url.database != expected['database']:
        print(json.dumps({'status': 'BLOCKED', 'reason': 'Configured target differs from recorded development endpoint'}))
        return
    engine = create_database_engine(cfg.effective_database_url, debug=False)
    try:
        async with engine.connect() as db:
            await db.execute(text('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY'))
            await db.execute(text("SET LOCAL statement_timeout = '15s'"))
            identity = dict((await db.execute(text('SELECT current_database() AS database, current_schema() AS schema, pg_is_in_recovery() AS recovery'))).mappings().one())
            tables = (await db.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"))).scalars().all()
            counts = {}
            for table in tables:
                counts[table] = await db.scalar(text('SELECT count(*) FROM "' + table.replace('"', '""') + '"'))
            orders = [dict(r) for r in (await db.execute(text('SELECT id, shop_id, lifecycle, created_at, completed_at, retained_at FROM orders ORDER BY created_at LIMIT 101'))).mappings()]
            shops = [dict(r) for r in (await db.execute(text('SELECT id FROM shops ORDER BY id LIMIT 101'))).mappings()]
            result = {'status': 'READ_ONLY_INVENTORY', 'endpoint_matches_record': True, 'identity': identity, 'counts': counts, 'shops': shops, 'orders': orders, 'classification': 'UNCONFIRMED: no authoritative obsolete-record allowlist', 'removed': 0}
            Path('.scratch/pathao-courier/ticket11-inventory.json').write_text(json.dumps(result, default=str, indent=2) + '\n', encoding='utf-8')
            print(json.dumps(result, default=str))
            await db.rollback()
    except Exception as exc:
        print(json.dumps({'status': 'BLOCKED', 'reason': type(exc).__name__, 'diagnostic': str(exc).splitlines()[0] if 'asyncio' in str(exc) or 'connection' in str(exc).lower() else 'driver rejected operation'}))
    finally:
        await engine.dispose()
asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
asyncio.run(main())


