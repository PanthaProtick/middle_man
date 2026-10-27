# Remove payment screenshots

User approved all removal boundaries and implementation on 2026-10-27.
Base: `17a1a0af597f2fd3e1397198efd59fcf8b35b5c7`.

## Accepted behavior

- Remove buyer uploads, seller viewing, payment image extraction and runtime storage.
- Erase existing private images, metadata, extraction records and upload replays.
- Keep manual claims, seller receipts/SMS reconciliation, accepted advances/COD,
  courier flows, address assistance and their retention behavior.
- Preserve development screenshots, historical task records and applied migrations.
- Reject legacy screenshot fields with 422; removed routes return 404.

## Implementation and verification

Removed screenshot components, client methods, routes, request/response fields,
image validation/storage, extraction provider/models and startup settings. Shared
retention now handles SMS and address AI only. Updated the glossary, API contracts,
ADR-0005, and the existing obsolete-order maintenance runner.

### Checks completed

- Focused backend: 44 passed; subsequent removal/retention/link/admission checks:
  26 passed. Focused frontend: 13 passed.
- Disposable PostgreSQL on loopback port 55519: 26 passed, including migration
  retry/preservation, submission boundaries, link authorization, replacement,
  and obsolete-order cleanup. No live-provider calls.
- Both applications' type checks and backend lint passed.
- Full-gate repairs: address tests imported shared fixtures from the retired image
  test module; moved them to public-order fixtures (14 focused tests passed).
  The portal test still expected a file input; changed it to assert absence
  (9 focused tests passed). No application behavior failures were observed.
- Earlier full run `check-9e1uz0` passed all 627 backend tests, then stopped on
  the obsolete frontend upload assertion. Run `check-9cYMdT` passed backend,
  frontend tests and build, then exposed inherited self-test mode in HTTP smoke.
- Fixed smoke environment isolation: explicitly disable durable self-test mode
  in the offline child. A subprocess regression reproduced the real settings
  precedence failure before the fix and passed afterward; `npm run smoke` passed.
  One initial focused attempt needed repository-local pytest temp settings due
  to Windows temp-directory permissions. Final full gate is pending below.
- Real Edge browser with synthetic API responses: 375px and 1440px; loading,
  validation, manual submission, missing screenshot controls/requests, error
  recovery and horizontal overflow checks passed. This is browser UI acceptance
  with mocked APIs, not a live Clerk/Neon buyer journey.

### Development data purge completed

Verified `ENV=development`, self-test mode, database `neondb`, schema `public`,
and the previously recorded Neon endpoint before mutation. Stopped the verified
local Uvicorn process tree, held migration/table locks with bounded timeouts,
erased the one 550-byte private file, applied exact migration 0026, and removed
the empty private directory. Removed one screenshot row and zero payment
extractions; upload replay deletion was scoped to `buyer_evidence_upload`.

Compared all remaining tables' full-row hashes in memory, excluding only the
removed revision column and retired upload replays: unchanged. This includes
13 orders, 14 buyer revisions, 11 receipts, 3 SMS records, 8 allocations, 8 consumed
payment markers, and the courier draft. No private rows or credentials were
printed or saved. Independent fresh read confirmed both tables absent and zero
files. Result: `.scratch/screenshot-purge-result.json`.

Restarted the development API: health 200 and OpenAPI contains no retired routes.
Development screenshots and historical task records were preserved. Production
deployment, other storage hosts and backup expiry were not performed or claimed.

## Final verification

PASS: root `npm run check`, disposable PostgreSQL enabled, result
`.cache/checks/check-wMcg2n/result.json`. Tooling, backend lint/types, all 628
backend tests, frontend lint, all 200 frontend tests, production build and real
HTTP smoke passed. `git diff --check` passed. The temporary browser server was
stopped; the user's development API remains running with the updated code.

Implementation and approved development purge are complete. No production
deployment or live courier/AI-provider run was made.
