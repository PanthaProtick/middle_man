# 09: Pathao settings and courier reconciliation

**What to build:** Understand Pathao settings, connection feedback, reconciliation, and recovery in either language while preserving secrets and provider evidence.

**Blocked by:** 01 — Language switching and buyer order summary

**Status:** resolved

- [x] Translate connection/environment labels, merchant settings, credential feedback, revision status, pickup-store labels, session loss, and existing booking-disabled guidance.

- [x] Translate reconciliation states, unresolved-booking instructions, snapshots, recovery, and distinctions between local and provider cancellation.

- [x] Localize stable settings/reconciliation codes with safe unknown-code guidance. Preserve original evidence, merchant/store IDs, credentials, revisions, and audit records.

- [x] Switch without exposing secrets, resetting unsaved credentials or selected environment, repeating checks/reconciliation, or enabling previously disabled operations.

- [x] No external provider links exist in these settings/reconciliation screens, so pre-link guidance is not applicable. No new provider operations added.

- [x] Extend rendered settings/reconciliation journeys and relevant request/failure/replay tests in both locales for secret masking, retained evidence/state, and request counts.

- [x] Keep approved standard Bangladeshi Bengali and plain English wording. Existing locale foundation supplies offline font fallback and document language; rendered tests cover labels, announcements, and preserved keyboard focus. Physical phone/browser acceptance remains unrun.

- [x] Run focused repository tests for changed behavior, then root npm run check as the final pre-handoff gate. Record changed paths, exact results, and failed/blocked/unrun browser or provider acceptance in the existing task record. Mocks and HTTP smoke do not prove live acceptance.

## Implementation record

Settings copy and rendering: `frontend/src/features/locale/courierCopy.ts`, `frontend/src/features/seller/PathaoSettings.tsx`. Rendered switch/failure tests: `frontend/src/features/seller/PathaoSettingsLocale.test.tsx`. Reconciliation copy, evidence protection, retry-key behavior, and local/provider cancellation warnings were already implemented by ticket 08 in `CourierReconciliation.tsx`, `CourierOutcomes.tsx`, and `CourierRecoveryLocale.test.tsx`; this ticket verified that integration rather than duplicating it.

Focused `npm run test:frontend -- src/features/seller/PathaoSettingsLocale.test.tsx src/features/seller/PathaoSettings.test.tsx`: 5 passed. Focused `npm run test:frontend -- src/features/seller/PathaoSettingsLocale.test.tsx src/features/seller/CourierRecoveryLocale.test.tsx`: 7 passed. `npm run typecheck`: passed. Initial `npm run check` stopped at pytest temp setup (WinError 5; 464 passed, 170 skipped, 1 setup error). Final rerun with repository-local `TEMP`, `TMP`, and `PYTEST_ADDOPTS=--basetemp=...` passed all stages at `.cache/checks/check-vSIioJ/result.json`.

Two-axis review: no documented standards violations; one non-blocking concern about the existing combined connection form. Spec review found no external provider links in this flow. Real Pathao, hosted deployment, and physical phone/browser acceptance were not run.
