# 02: Separate saved-link encryption from Clerk credentials

**What to build:** Create, retrieve and recover saved buyer links using a stable application encryption key independent of seller authentication credentials.

**Blocked by:** 01: Fail explicitly when durable storage is unavailable.

**Status:** completed

## Acceptance criteria

- [x] An order link created with the application key remains recoverable after Clerk credential changes and application restart.
- [x] Missing or incompatible encryption keys fail explicitly in integration mode, without a fixed fallback or disclosure of key material.
- [x] Existing encrypted records are inspected before changing key sources; preserve their recoverability or require an explicit verified compatibility step, never reset data silently.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Token encryption, order-link creation/retrieval, application configuration and saved-link persistence tests.

## Verification target

Round-trip through order creation/retrieval, restart and changed-Clerk-key cases; include wrong/missing application key and existing-record compatibility failure.

Coverage: AC04, AC39, plus independent-encryption regressions. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Payment-marker keys, online rotation infrastructure and buyer access policy.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.

- 2026-10-25: Agreed testing seams (Configuration/Cipher, Token Encryption/Decryption, Compatibility Inspection, Order Persistence & Recovery) and architectural decisions saved to `.scratch/phase-1-self-test/ticket-02-handover.md`. Baseline test suite clean (245 passed, 65 skipped). Ready for TDD vertical slice 1 upon resume.
- 2026-10-25: Completed TDD implementation across all 4 agreed seams:
  - Seam 1 (Configuration & Cipher): Added `ORDER_LINK_ENCRYPTION_KEY` and `is_order_link_encryption_configured` in `backend/app/core/config.py`. Added fail-closed validation and diagnostic masking in `backend/app/core/tokens.py`.
  - Seam 2 (Token Encryption & Decryption): Decoupled token cipher from `CLERK_SECRET_KEY`. Catch `InvalidToken` and raise `LinkEncryptionKeyIncompatibleError` (status 503, code `LINK_ENCRYPTION_KEY_INCOMPATIBLE`).
  - Seam 3 (Compatibility Inspection): Implemented `inspect_link_encryption_compatibility` and `check_link_encryption_readiness`, hooked into `app.main.lifespan` in durable mode to verify database records decrypt successfully with the active key.
  - Seam 4 (Order Persistence & Recovery): Added AC04 / AC39 tests in `test_link_encryption.py` (unit) and `test_durable_postgres.py` (PostgreSQL) verifying recovery across Clerk rotation, restart, and explicit 503 on incompatible key without data resetting.
  - Verification:
    - `npm run test:backend`: 263 passed, 66 skipped (0 failures).
    - `npm run test:frontend`: 114 passed (26 test files).
    - `npm run typecheck`: backend (86 files) and frontend (tsc) 0 errors.
    - Final root verification gate `npm run check`: ALL PASS (`.cache/checks/check-CvmUdc/result.json`).
