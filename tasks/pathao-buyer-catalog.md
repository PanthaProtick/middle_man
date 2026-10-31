# Task: Persisted buyer Pathao catalogue

Status: Completed

- Approved design: [ADR-0008](../docs/adr/0008-persisted-buyer-pathao-location-catalog.md).
- Acceptance: no search inputs; immediate selected labels; only loading descendants
  disabled; stale responses ignored; buyer browsing/submission never calls Pathao;
  isolated, atomically published snapshots; daily/manual refresh; failed refresh
  retains prior snapshot; reconnection revokes old authority; replaced versions
  valid for 48 hours without extending link authority; live seller review retained.
- Preserve pre-existing seller/metrics checkout changes.

## Current state

- Implemented dropdown repair and removed search; added per-form child-list caching,
  version pinning, cancellation and ignored late responses.
- Added migration 0028, snapshot/list/lease storage, atomic refresh publication,
  daily/manual synchronization runner, seller status/refresh/disconnect controls,
  connection generations, and 48-hour replaced-version validation.
- Buyer reads/submissions use saved data; seller review requests fresh coverage.
- Updated location contract, glossary, ADR and catalogue operations guide.
- Focused backend tests pass, including 10 disposable PostgreSQL integration tests.
  Types/lint and frontend focused tests/build pass.
- Synthetic browser check on port 8019 confirmed no search inputs, immediate city
  label and enabled parent during a held zone request, child recovery, and complete
  hierarchy selection. Evidence: `.cache/pathao-catalog-browser.png`.
- Final full gate passed: `.cache/checks/check-BJUxdE/result.json`; 615 backend
  tests passed (177 opt-in tests skipped), 502 frontend tests passed, plus tooling,
  conventions, lint, strict types, build and HTTP smoke. The 10 targeted PostgreSQL
  tests ran separately against disposable loopback storage and passed.
- Corrected migration inventory for migration 28 and preserved the bare initial
  catalogue URL after full-suite regressions. A repository-local pytest basetemp
  avoided the host temporary-directory permission failure.
- No implementation work remains. Deployment acceptance still requires the
  migration, hourly worker schedule and a manual real-provider check.

## Verification

| Command or acceptance case | Result |
| --- | --- |
| Focused frontend/backend tests | PASS |
| Disposable PostgreSQL migration/integration tests | PASS (10 tests) |
| Strict types / lint / production build | PASS |
| Synthetic browser, saved hierarchy and delayed child request | PASS |
| Root `npm run check` | PASS: `.cache/checks/check-BJUxdE/result.json` |
| Live Pathao / hosted migration / hosted scheduling / physical device | NOT RUN |

Deployment still requires migration 0028 and an hourly invocation of
`npm run refresh:locations`; code does not establish hosted job execution. The local
browser launcher and PostgreSQL use only synthetic data and disposable storage.

## Unstaged implementation review — 2026-10-31

- Reviewed the working tree against the index and ADR-0008 on separate standards
  and specification axes, preserving unrelated seller/metrics changes.
- Fixed deferred catalogue-expiry validation in `pathao_locations.py`: connection
  changes now receive the required unavailable fallback before any stale error is
  raised. Added unchanged/changed connection regression cases.
- Fixed `useLocationCatalog.ts` to distinguish expired versions from invalid parent
  choices using API error codes. Added removed-parent regression coverage and
  retained existing explicit-retry coverage.
- Addressed two maintainability findings: the connections service owns generation
  lookup, and the buyer hook shares one query builder and cache-state interface.
  Generation still uses the documented connection/default-revision invariant.
- Focused verification: 29 backend tests and 10 frontend tests passed. Initial full
  gate `.cache/checks/check-rp9G4k/result.json` stopped at the host pytest temporary
  directory permission error (616 passed, 177 skipped, one setup error).
- The next run passed backend tests but caught a missing effect dependency in the
  extracted query helper. Passing primitive city/zone arguments fixed it; focused
  frontend tests and lint passed afterward.
- Final full gate PASS: `.cache/checks/check-8GPkff/result.json`; 617 backend tests
  passed (177 opt-in tests skipped), 503 frontend tests passed, tooling, conventions,
  lint, strict types, production build and HTTP smoke passed. Used a repository-local
  pytest temporary directory. `git diff --check` also passed.
- Browser, PostgreSQL integration, live Pathao and hosted checks were not repeated
  during this review; prior implementation evidence above is historical.

## 2026-10-31 — catalogue refresh authentication rate limit

- Local buyer endpoint returned production `unavailable`, with no saved catalogue.
  Read-only database status confirmed the first manual refresh failed.
- Live read probes loaded cities/zones/areas successfully, then failed at token
  issuance. A subsequent token request confirmed HTTP 429. The crawl previously
  authenticated for every hierarchy list; a complete crawl amplifies auth traffic.
- `pathao_catalog.reader` now owns one HTTP client and token per crawl, scoped to
  one connection revision. Single-list callers retain their existing interface;
  offline fixtures remain supported. Failures still prevent partial publication.
- Changed `pathao_snapshot_sync.py`, `pathao_catalog.py`, added
  `backend/tests/test_pathao_catalog_session.py`; corrected the seller catalogue
  failure message and Bengali copy in `PathaoCatalogStatus.tsx`, its test, and
  `courierCopy.ts` so first-sync failures do not claim saved locations exist.
- Regression tests were observed failing before each fix. Focused backend:
  `npm run test:backend -- tests/test_pathao_catalog_session.py tests/test_pathao_snapshots.py tests/test_pathao_locations.py`
  passed 19 tests. Focused frontend catalogue status passed 2 tests.
- Final `npm run check` PASS: `.cache/checks/check-hk0cVE/result.json` (repository-local
  pytest basetemp); tooling, conventions, lint, types, tests, build and HTTP smoke.
  `git diff --check` passed.
- Live end-to-end refresh remains unverified: the last live authentication probe
  was rate-limited. Next action: retry seller Refresh locations once Pathao's
  cooldown clears, then verify buyer city choices. No booking requests were made.

## 2026-10-31 — on-demand source reconsideration

- Owner reports that fetching the complete city/zone/area hierarchy triggers
  Pathao's too-many-requests response and wants to return to on-demand fetching.
- Confirmed direction: backend-mediated Pathao choices with the current dropdown
  presentation and preservation of buyer-entered details. This supersedes the
  desired source direction, but implementation and ADR replacement await the
  remaining design decisions and final shared-understanding confirmation.
- Historical flow used a five-minute process-local cache; literal restoration
  would still authenticate per cache miss. Decide request/token reuse, outage
  fallback, and retirement of full-catalogue synchronization before implementation.
- Browsing and submission resolution must change together; retain connection
  isolation, required-choice checks, stale-response protection and seller review.
- Existing checkout changes are preserved. No application code changed and no
  new live Pathao probes or tests were run during this design discussion.
- Owner accepted valid-token reuse, short-lived list caching, concurrent-request
  coalescing and rate-limit cooldowns; written-address fallback with mandatory
  seller resolution; and retirement of full-crawl jobs and seller refresh/status
  controls while leaving database tables intact.
- Complete proposal: [ADR-0009](../docs/adr/0009-on-demand-buyer-pathao-locations.md).
  Next action: obtain final shared-understanding confirmation required by the
  invoked grilling workflow, then implement and verify the bounded source change.
- The owner subsequently invoked `to-spec` rather than implementation. Published
  the agreed scope as [the replacement specification](../.scratch/pathao-on-demand-locations/spec.md)
  with `Status: ready-for-agent`, existing API/UI test seams and explicit safety,
  compatibility and crawler-retirement acceptance cases. No application changes.
  Next action: implement from the replacement specification when requested.
- Pre-commit verification for all pending files: root `npm run check` PASS,
  evidence `.cache/checks/check-77njcu/result.json`, with repository-local pytest
  basetemp. Initial run `.cache/checks/check-IWxpCr/result.json` stopped at a
  Windows system-temp permission error (618 passed, 177 skipped, one setup error).
  The successful rerun passed all configured gates; no live-provider, browser or
  PostgreSQL integration acceptance was added by this commit verification.
