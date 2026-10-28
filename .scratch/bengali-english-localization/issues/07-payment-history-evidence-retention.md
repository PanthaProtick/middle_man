# 07: Payment history, evidence, and retention

**What to build:** Read historical payment decisions and operate evidence, SMS import, corrections, and retention in either language while preserving evidence.

**Blocked by:** 01 — Language switching and buyer order summary

**Status:** implemented — local verification passed; browser/device acceptance not run

- [x] Translate history, comparisons, evidence resolution, receipt corrections, incoming SMS import results, retention controls, progress/counts, empty/loading/error/retry states.

- [x] Localize known historical reason/status/source codes and safe unknown-code guidance. Preserve original raw evidence, user-written reasons, actor IDs, SMS text, amounts, and audit records.

- [x] Localize existing server errors through stable codes without rewriting persisted evidence or changing ownership, prerequisites, correction semantics, masking, or privacy protections.

- [x] Use shared date/count/money presentation without changing stored instants, expiry windows, retention durations, or purge rules.

- [x] Switch with open comparisons, correction drafts, import results, pending decisions, and purge failures without repeating decisions, corrections, imports, or deletion requests.

- [x] Extend rendered history/evidence/import/retention journeys and relevant request tests in both locales for preserved evidence, accurate counts, failures, access controls, and non-repeated mutations.

- [x] Keep approved standard Bangladeshi Bengali and plain English wording. Include Bengali-capable offline font fallback, phone wrapping and reachable controls, localized document/control language, associated errors, announcements, and preserved keyboard focus; test visible behavior rather than implementation details.

- [x] Run focused repository tests for changed behavior, then root npm run check as the final pre-handoff gate. Record changed paths, exact results, and failed/blocked/unrun browser or provider acceptance in the existing task record. Mocks and HTTP smoke do not prove live acceptance.


## Implementation and verification — 2026-10-28

- Base: `9f41036f38566983a435b34fa7067af92fab73e7`; implementation commits `7a701c1`, `8f507a9` on the existing localization branch.
- Changed paths: `frontend/src/features/locale/historyCopy.ts`, `format.ts`, `receiptCopy.ts`, `paymentInboxCopy.ts`; seller `PaymentHistory`, `EvidenceResolution`, `ReceiptCorrection`, `SmsImportPanel`, `EvidenceRetentionPanel`, `StructuredRetentionPanel`, `RetentionSection`, their existing tests and new `PaymentHistoryLocale`, `SmsImportLocale`, `RetentionLocale` tests; `frontend/src/styles/theme.css`.
- Presentation-only localization preserves user reasons, actors, SMS drafts and extracted fields, IDs, provider brands, persisted evidence, request payloads and retry keys. Shared BDT/date/count formatting keeps 0-9 digits and Bangladesh time. Cleanup feedback retains numeric results rather than rendered language. Unknown codes and server diagnostics receive safe localized guidance. Existing Bengali-capable system-font fallbacks remain in effect; phone layouts wrap long IDs and controls.
- Confirmed TDD seams: rendered seller journeys and fetch request boundaries, explicitly accepted by the user. New history, retention, SMS result/empty-state and English comparison-heading assertions failed before their fixes and passed afterward.
- Focused checks PASS: `npm run test:frontend -- src/features/seller/PaymentHistoryLocale.test.tsx src/features/seller/PaymentHistory.test.tsx` (2 tests); retention locale/raw/structured files (9 tests); SMS locale/import/correction/comparison files (10 tests before review); final comparison/SMS locale files (5 tests). `npm run typecheck` PASS after each implementation cluster and review fixes.
- Full `npm run check` PASS via the required commit hook: `.cache/checks/check-5YpzhD/result.json`, all eight stages including backend lint/types/tests, frontend lint/tests/build, tooling and HTTP smoke. Backend: 462 passed, 170 skipped (database integration gates); frontend: 291 passed. Earlier pre-review full gate also passed at `.cache/checks/check-aGbLIG/result.json`.
- Two-axis code review: Standards 0 findings; Spec 3 findings (paired English comparison heading, empty import guidance, focus coverage), all addressed with focused regressions before the final full gate.
- NOT RUN: live browser, physical phone, screen reader, offline font rendering, hosted database/provider acceptance. DOM tests and HTTP smoke do not establish those gates. No migrations, hosted changes, provider calls or real-data deletion performed.
- Next acceptance action: verify both languages in a real browser/phone with open comparisons and correction/SMS drafts, partial purge failures, keyboard/screen-reader navigation and offline Bengali rendering.
