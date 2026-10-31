# 03: Retire full-catalogue synchronization and seller controls

**What to build:** Sellers manage their Pathao connection without obsolete
catalogue refresh/status controls, and neither connection events nor scheduled
execution start complete location crawls. Buyer location selection continues
working on demand without destructive database changes.

**Blocked by:** 01 — Restore on-demand buyer location selection and submission.

**Status:** completed

## Acceptance criteria

- [x] Connecting, reconnecting or replacing a Pathao connection does not start a
  full city/zone/area crawl; eligible buyers can instead load individual lists
  through the on-demand path without waiting for synchronization.
- [x] Scheduled workers, command wrappers, manual refresh endpoints and other
  executable entry points no longer start complete hierarchy crawls. Retire the
  obsolete sync execution path rather than hiding only its seller button.
- [x] Seller settings no longer offer catalogue refresh or show catalogue age,
  synchronization progress or refresh failures. Preserve connection/disconnection,
  environment selection, pickup settings and relevant connection health feedback.
- [x] Remove obsolete UI copy and callers only where supported by the source
  change; preserve unrelated seller metrics, delivery staging and checkout work.
- [x] Existing snapshot tables, migrations and historical submission data remain
  intact. No destructive migration or blanket deletion of stored records is used.
- [x] Update operations, setup and scheduling guidance so new deployments do not
  install the old crawler. Identify any already-hosted schedule needing removal
  and report whether it was verified or remains unrun; local source removal alone
  must not be described as proof of a hosted configuration change.
- [x] Existing connection/API/job-entry tests verify absence of crawl traffic.
  Rendered seller-settings tests verify removal of obsolete controls and retention
  of usable account settings; the buyer API/form happy path remains passing.
- [x] Remove unused runtime sync code only after tracing its callers. Reconcile
  affected prior tests with the retired behavior without weakening location,
  connection, seller-review or booking-safety assertions.
- [x] Run focused tests for connection/settings/job changes, followed by root
  `npm run check`. Record fresh results and separately report browser and hosted
  scheduling checks as passed, failed, blocked or unrun.

## Dependency note

Ticket 02 is not a blocker: once ticket 01 supplies the working on-demand path,
retiring synchronization and seller controls does not depend on further request
coalescing or cooldown work. The full feature still requires both tickets.

## Verification record

Verified locally on 2026-10-31 (Asia/Dhaka):

- PASS: `npm run test:backend -- tests/test_pathao_catalog_routes.py tests/test_pathao_catalog_session.py tests/test_pathao_connections.py tests/test_pathao_locations.py tests/test_pathao_snapshots.py tests/test_pathao_snapshots_postgres.py tests/test_public_order_routes.py`
  — 40 passed, 3 PostgreSQL scenarios skipped.
- PASS: `npm run test:frontend -- src/features/seller/PathaoSettings.test.tsx src/features/seller/PathaoSettingsLocale.test.tsx src/features/buyer`
  — 15 files, 98 tests passed.
- PASS: root `npm run check` with
  `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.cache/pytest-ticket03-review`.
  Result: `.cache/checks/check-FIarND/result.json`. The initial attempt
  (`check-R5XT2V`) failed at pytest temporary-directory setup with Windows access
  denied; repository-local temporary storage resolved it.
- PASS after documentation fixes: root `npm run check`, result
  `.cache/checks/check-n5RzYn/result.json`, using a fresh repository-local pytest
  base directory. The preceding attempt (`check-vt4zVn`) hit Windows access denied
  while cleaning an existing pytest directory. Backend: 639 passed, 177 skipped;
  all remaining gate stages passed.
- Source review: full crawler and its only reader caller removed; retained worker
  and command wrappers are safe no-ops. Snapshot schema and historical storage
  remain intact. Seller connection controls and buyer on-demand behavior remain.
- UNRUN: PostgreSQL integration/retention execution, browser acceptance and live
  provider verification. Mock and rendered tests do not establish those results.
- UNRUN: hosted schedule inspection/removal. No specific hosted schedule has been
  confirmed. Operators must remove any existing hourly `npm run refresh:locations`
  or `python -m app.services.pathao_snapshot_sync` schedule. Local code retirement
  does not prove hosted scheduler decommissioning.

## References

- [Feature specification](../spec.md)
- [Blocking ticket 01](01-restore-on-demand-selection-and-submission.md)
