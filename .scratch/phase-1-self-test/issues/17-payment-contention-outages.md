# 17: Verify payment contention and outage boundaries

**What to build:** Prove independent database actors cannot double-consume a receipt or invent success during uncertain commits and competing seller actions.

**Blocked by:** 16: Verify conflict and correction recovery.

**Status:** completed

## Acceptance criteria

- [x] Concurrent manual/automatic allocation and known competing claims allow at most one durable consumption; the losing outcome is explicit.
- [x] Cancellation/correction races with matching serialize to a valid result without stale acceptance; tests cover independent actors rather than one-session mocks.
- [x] Outage/restart near commit produces an all-or-nothing durable result resolvable with the original mutation key; no memory-only confirmation.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Existing independent-session PostgreSQL fixtures, shop-first locking, allocation transaction and same-key recovery.

## Verification target

Execute focused existing concurrency/outage tests with independent sessions on a disposable database; report executed counts, skips and exact evidence. Repair only reproduced failures.

Coverage: AC20, AC22–AC23, AC37–AC39. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

New lock granularity, throughput optimization and application-wide recovery redesign.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

- 2026-10-25: Ticket started. Verified disposable PostgreSQL 18 cluster running on loopback 127.0.0.1:55447 (data dir `E:/middle_man/.cache/resolution-pg`). Ran baseline existing PostgreSQL tests across 7 test suites: 31 passed in 12.66s.
- Agreed on 3 TDD seams covering AC20, AC22–AC23, AC37–AC39 (Allocation contention, cancellation/matching race serialization, outage rollback & restart same-key replay).
- Created `.scratch/ticket-17-handover-notes.md` to preserve complete state across context compaction.
- Executed TDD across 3 cycles, decomposing into:
  - `backend/tests/payment_contention_support.py` (161 lines): Shared helpers for competing claim setup, exception setup, decision invocation, and typed shop lock barrier `execute_under_shop_barrier`.
  - `backend/tests/test_payment_contention_postgres.py` (237 lines): Real PostgreSQL independent connection tests for competing claim review blocking (AC20), concurrent resolution allocation exclusivity (AC22), manual decision vs automatic reconciliation contention (AC22), concurrent cancellation vs matching race serialization (AC23), and concurrent cancellation vs confirmation serialization (AC23). 4 passed in 2.0s.
  - `backend/tests/test_payment_outages_postgres.py` (136 lines): Synthetic database outage near decision commit triggering atomic rollback to pending with no memory-only confirmation (AC39), full process memory store wipes surviving restart and replaying original key without new writes (AC37, AC39), and key reuse with tampered payload / stale version conflict protection (AC38). 3 passed in 1.0s.
- Ran dual-axis code review (Standards & Spec subagents), addressed all type annotations, naming, and racing matching coverage.
- Verification checks:
  - Focused PostgreSQL contention & outage suite: 7 passed in 2.65s (`$env:BUYER_TEST_POSTGRES_URL="postgresql://postgres@127.0.0.1:55447/postgres"`).
  - Full backend test suite with PostgreSQL: 485 passed in 44.73s.
  - Frontend test suite: 146 passed in 4.83s.
  - Strict typecheck: 0 errors across 94 Python files and TypeScript.
  - Final root gate `npm run check`: Tooling PASS, Backend lint PASS, Backend types PASS, Backend tests PASS, Frontend lint PASS, Frontend test PASS, Frontend build PASS, HTTP smoke PASS (check-tKjKU2).
