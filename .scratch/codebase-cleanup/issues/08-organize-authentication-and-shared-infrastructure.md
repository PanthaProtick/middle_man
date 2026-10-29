# 08: Organize authentication and shared infrastructure

**Status:** implemented — reviewed and final root check passed

**What to build:** Remaining authentication and cross-feature infrastructure with explicit ownership and discoverable tests, preserving authorization and offline development behavior.

**Blocked by:** 04 — Organize buyer workflows; 05 — Organize seller shell and order workflows; 06 — Organize payment and reconciliation workflows; 07 — Organize courier workflows.

- [x] Reconcile inventory and preceding-ticket follow-ups before choosing shared targets; do not reopen unrelated completed cleanup.
- [x] Trace authentication/session, configuration, client/server communication, and genuinely shared helper callers and tests; preserve feature-specific ownership when reuse is only superficial.
- [x] Organize oversized responsibilities and related tests without introducing a generic shared module merely to shorten feature files.
- [x] Preserve seller authority, shop isolation, session-loss recovery, independent application secrets, buyer-link boundaries, and private-data handling.
- [x] Preserve offline standby/test behavior, stable contracts, localization preference behavior, and optional integration gates.
- [x] Verify imports, collection, fixture isolation, and existing high-level authentication/API/rendered behavior; retain failure and security assertions.
- [x] Review suppressions against actual tooling and behavior rather than deleting comments mechanically. Apply agreed size rules with narrow documented test exceptions.
- [x] Verify bounded groups, then run final root `npm run check`; record dispositions and remaining convention/tooling follow-up.

## Work record

**Inventory bounds (2026-10-28):** Full map in
[disposition-record.md](../disposition-record.md).

- Backend core: `config.py`, `database.py`, `database_engine.py`, `clerk_verifier.py`,
  `tokens.py`, `idempotency.py`, `auth.py`, public gate/admission, auth diagnostics.
- Frontend shared: `App.tsx`/`Root.tsx`, `features/locale/clerkLocalization.ts` 299
  (review: likely cohesive provider localization data; split or document cohesion),
  locale provider/catalog, `services/api.ts`, seller session request/client (with 05).
- Tests: `test_link_encryption.py` 332, `test_durable_mode.py` 296,
  `test_clerk_auth.py` 253, `SellerSession.test.tsx` 259, plus auth/session/skew,
  database options, and shop isolation suites.
- Preserve seller authority, shop isolation, session-loss recovery, independent
  secrets, buyer-link boundaries, offline standby, localization preference, and
  stable contracts. Review suppressions against actual tooling.
- Do not create a generic shared module for superficial reuse; keep feature
  ownership.

**Required checks:** focused auth/session/shared tests, import/collection checks,
typecheck, then `npm run check`. Hosted Clerk/PostgreSQL gates are separate.


## Implementation (2026-10-29)

Base: `26a3e708233f34e58bdc0fe8866a2a5c8dd2bfaf` on the current branch;
checkout initially clean. Dependencies 04–07 are implemented and locally verified.
The parent spec already approves the existing verification seams; this refactor
adds no new behavior or test seam. TDD skill applied as preservation of existing
behavioral tests, rather than inventing a failing behavior for a file move.

### Changes and ownership

- `test_link_encryption.py`: retain configuration, fail-closed/standby cipher,
  round-trip, incompatible-key/privacy, and independent-secret tests (147 lines).
  Move compatibility sampling/startup checks to `test_link_encryption_readiness.py`
  (88); move seller order recovery/key rotation/record preservation and their
  sole row builder to `test_order_link_recovery.py` (107).
- `test_durable_mode.py`: retain configuration, startup/dependency, sanitized
  diagnostics, readiness, and schema checks (148). Move seller mutation,
  outage/no-memory-fallback, and committed replay to
  `test_seller_durable_storage.py` (153). Existing global fixtures and explicit
  verified identity injection remain unchanged; no fixture import/re-export added.
- `clerkLocalization.ts`: retain provider-wide fields, reverification, sign-out,
  and errors (130). `clerkSignInLocalization.ts` owns sign-in/verification/recovery
  copy (176), typed against the installed Clerk resource. Composition keeps the
  existing export, exact strings, nested keys, placeholders, and fallback behavior.
  Neither module owns session state or changes provider mounting.
- AST comparison against the base preserved all 34 original backend function
  bodies/decorators, including the row builder; 33 tests remain collected and pass.
  Existing localization tests exercise the composed resource, required paths,
  Bengali copy, and interpolation placeholders.

### Reviewed and retained

- Core config (182), auth (109), verifier (218), diagnostics (12), database (197),
  engine options (34), tokens (134), idempotency (125), public gate (29), admission
  (88): already bounded owners. Auth routes depend on verified seller identity;
  development tokens remain barred in durable/configured-verifier mode. Token
  encryption stays independent of Clerk secrets. Database commit/rollback and
  no-memory-fallback boundaries stay intact. No interface, schema, or migration
  changes are justified by this cleanup.
- `Root`/`main` choose the Clerk-free buyer path and one effective locale provider;
  `SellerSession` owns credentials/recovery; `sessionRequest` owns cancellation,
  read-only refresh replay and safe failure reasons. Keep session code seller-owned,
  rather than exposing seller bearer behavior to buyer/general scaffold requests.
- `services/api.ts` owns the existing offline scaffold client; seller `api.ts`
  (294) remains the typed seller endpoint facade with its common error/request
  boundary. Keeping that stable import surface avoids endpoint churn; it delegates
  session safety to `sessionRequest` already. Buyer requests remain feature-owned.
- `models/entities.py` (284) remains the shared SQLAlchemy metadata model graph;
  separating interrelated table declarations offers no demonstrated cleanup gain.
  `order_service.py` (293) remains the order orchestration/listing owner, using
  existing mapping, search/date, and buyer-revision helpers. No generic shared
  abstraction is introduced for these preceding-ticket follow-ups.
- `test_clerk_auth.py` (253) remains one verifier contract suite with local signing
  helpers; `SellerSession.test.tsx` (259) remains one rendered SDK/session lifecycle
  suite with shared mock setup. Both are under 300; no size exception is needed.
- Locale provider/storage/catalog retain preference fallback, blocked-storage
  recovery, interpolation and presentation ownership. Other feature copy stays
  colocated in locale modules; no cross-feature state merge.
- No suppressions occur in the reviewed core/shared locale/client modules.
  Conftest's E402 suppressions are necessary: provider inputs are cleared before
  app imports to prevent local credentials from activating integrations. Retained.

### Verification before review

- Baseline focused encryption/durable tests: **33 passed**.
- After splitting the five encryption/durable modules: **33 passed**, all original
  test function/decorator ASTs unchanged and no duplicate moved functions.
- Focused verifier, skew, seller auth, diagnostics, shop isolation, public gate,
  admission and database options (8 modules): **66 passed**.
- Focused Clerk resource, rendered SellerSession, sessionRequest, App locale,
  LocaleProvider and scaffold client (6 files): **45 passed**. Node emitted the
  existing localstorage-file warning; no test failure.
- `npm run typecheck`: **PASS**, strict backend (115 source files) and frontend.

### Independent review

Code-review skill applied against base `26a3e708233f34e58bdc0fe8866a2a5c8dd2bfaf`,
including new files. Standards: **0 findings**; Spec: **0 findings**. Both reviewers
independently verified unchanged backend function/decorator ASTs and Clerk copy.

### Final verification and handoff

- First `npm run check`: tooling/lint/types passed; backend reported **492 passed,
  175 skipped, 1 setup error**, caused by Windows permission denial for the default
  system pytest temp directory. Artifact: `.cache/checks/check-2SAO9u/result.json`.
- Rerun with `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.cache/pytest-ticket08-final`:
  **PASS all eight stages**, including **493 backend passed / 175 skipped**,
  **439 frontend passed in 81 files**, frontend build and HTTP smoke. Artifact:
  `.cache/checks/check-L356P4/result.json`. The override changes only temporary
  storage; no test filters or source changes were used to obtain the pass.
- `git diff --check`: **PASS**. No unrelated checkout changes or credentials touched.
- Optional PostgreSQL/provider tests remain gated/skipped. Browser/device/
  screen-reader, hosted Clerk/PostgreSQL and live-provider acceptance were **NOT
  RUN**; mocked tests/build/HTTP smoke do not establish those outcomes.
- All changed source/test modules are below 250 lines. No new size exception.
  No contract, migration, deployment, or provider activation changes.

Next: ticket 09 owns convention enforcement and maintained documentation
reconciliation; ticket 10 owns integrated cleanup acceptance. No unresolved
implementation or review findings remain for ticket 08. Commit this work on the
current branch as required by the implement workflow.
