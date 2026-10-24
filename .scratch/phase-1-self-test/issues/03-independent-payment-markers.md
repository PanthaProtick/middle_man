# 03: Separate payment-marker protection from Clerk credentials

**What to build:** Keep consumed-payment protection stable when Clerk credentials change, using a dedicated payment-identity secret.

**Blocked by:** 01: Fail explicitly when durable storage is unavailable.

**Status:** completed

## Acceptance criteria

- [x] Payment markers created under the dedicated secret still reject reuse after Clerk credential changes and restart.
- [x] Missing or mismatched marker secrets fail closed; historical markers are never ignored or silently regenerated.
- [x] Existing marker bindings and historical identities are checked before changing key sources; unsupported migration is blocked explicitly.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Payment digest computation, marker-key binding, retained receipt identities and allocation/replay tests.

## Verification target

Use an actual PostgreSQL consumed-payment replay before/after credential changes, wrong-key rejection and a historical-marker compatibility case.

Coverage: AC17, AC42, plus independent-marker regressions. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Link encryption, automatic key rotation and changes to matching criteria.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.

- 2026-10-25: Agreed testing seams (Configuration/HMAC Digest, Marker Key Binding & Protection, Startup Compatibility Inspection, PostgreSQL Persistence & Replay) saved to `.scratch/phase-1-self-test/ticket-03-handover.md`. Baseline test suite verified clean (263 passed, 66 skipped). Ready for TDD vertical slice 1 upon resume.
- 2026-10-25: Implementation completed via TDD across all 4 seams:
  1. Decoupled HMAC payment digest computation from `CLERK_SECRET_KEY` using dedicated `PAYMENT_MARKER_SECRET` in `config.py` and `reconciliation.py`.
  2. Maintained shop marker key bindings in `PaymentMarkerKeyTable` and fail-closed validation of historic markers in `UsedPaymentMarkerTable` without silent regeneration.
  3. Added startup compatibility inspections `inspect_payment_marker_compatibility` and `check_payment_marker_readiness` hooked into `main.py` lifespan.
  4. Verified persistence and replay rejection against real PostgreSQL loopback (port 55447):
     - `tests/test_payment_marker_protection.py`: 16 passed.
     - `tests/test_durable_postgres.py`: 4 passed (including `test_payment_marker_independent_secret_restart_and_clerk_rotation`).
     - `tests/test_structured_retention_postgres.py`: 7 passed (AC17/AC42 payment replay rejection across Clerk credential changes and 503 fail-closed on rotated marker secret).
     - Full backend test suite with loopback PostgreSQL: 346 passed in 36.50s.
  5. Ran final root verification gate `npm run check`: PASS all 8 stages (Tooling tests, Backend lint, Backend types, Backend tests, Frontend lint, Frontend test, Frontend build, HTTP smoke).
  6. Parallel Standards and Spec reviews completed; findings addressed; temporary handover file disposed.
