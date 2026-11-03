# Retire SMS ingestion and preserve historical retention
Status: resolved
Blocked by: none

## Answer

Removed ingestion/history routes, parser, orchestration and active input/list contracts. Historical result models and offline storage now live in explicitly legacy modules used only by cleanup/reset. Existing migrations and durable tables are unchanged. Narrow retired-path handling returns private 404 responses for all methods, including trailing slashes, without receipt-ID route ambiguity.

Kept shared receipt/reconciliation code. Converted shared journey, resolution, search and cleanup fixtures away from the deleted ingestion interface; seeded historical rows for retention acceptance.

## Verification

- Red: retired API test failed with 200 before removal; removing router exposed 405 from generic receipt routes; narrow retirement handling made it green.
- Focused offline: 19 passed across retirement, raw evidence, resolution and search before adding method/slash cases.
- Full backend: `npm run test:backend -- -q --tb=short --basetemp=../.cache/backend-sms-tests`: 703 passed, 175 skipped. Initial default temp run had one Windows temp permission error; repo-local temp fixed it.
- Disposable loopback PostgreSQL 18: 18 passed across historical SMS retirement, obsolete cleanup, structured retention, reconciliation isolation and durable confirmation journey. All migrations applied to fresh isolated schemas; seeded legacy receipt/allocation/raw evidence remained stable through retirement and original-deadline cleanup. No schema upgrade was introduced or required.
- `npm run lint:backend`: passed. `npm run typecheck:backend`: passed (143 files).
- Browser and final root gate belong to integration ticket 03.
