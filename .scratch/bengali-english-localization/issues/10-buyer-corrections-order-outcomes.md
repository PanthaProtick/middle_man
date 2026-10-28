# 10: Buyer corrections and order outcomes

**What to build:** Review buyer revisions and correct, reject, replace, or cancel an order in either language while preserving lifecycle safeguards.

**Blocked by:** 01 — Language switching and buyer order summary

**Status:** implemented locally; browser and live-provider acceptance remain

- [x] Translate revision history, review reasons, correction forms, locked fields, courier notices, retry guidance, and rejection/replacement/cancellation confirmations.

- [x] Cover pending/terminal/unavailable/expired/failure states, stable server field/reason codes, and safe unknown-error guidance.

- [x] Preserve payment-resolution prerequisites, allocated-order blockers, fixed-term constraints, authorization, expiry, and provider-booking warnings.

- [x] Preserve buyer names/addresses/messages, revisions, evidence, user-written reasons, actor identifiers, and order IDs. Localize coded labels rather than original text.

- [x] Use approved terms and localized timestamps without changing stored instants; confirmation must not imply independently verified payment.

- [x] Switch during drafts, selected outcomes, confirmation dialogs, pending requests, and failures without losing state or repeating mutations. Extend rendered journeys and request/replay tests in both locales, retaining lifecycle/privacy assertions.

- [x] Keep approved standard Bangladeshi Bengali and plain English wording. Include Bengali-capable offline font fallback, phone wrapping and reachable controls, localized document/control language, associated errors, announcements, and preserved keyboard focus; test visible behavior rather than implementation details.

- [x] Run focused repository tests for changed behavior, then root npm run check as the final pre-handoff gate. Record changed paths, exact results, and failed/blocked/unrun browser or provider acceptance in the existing task record. Mocks and HTTP smoke do not prove live acceptance.

## Implementation record (2026-10-28)

- Base commit: `733daf8`. Presentation changes: `frontend/src/features/locale/correctionOutcomeCopy.ts`, `frontend/src/features/seller/BuyerCorrection.tsx`, `frontend/src/features/seller/OrderOutcomes.tsx`, `frontend/src/features/seller/BuyerCorrection.css`. Tests: `frontend/src/features/seller/CorrectionOutcomeLocale.test.tsx`, `frontend/src/features/seller/BuyerCorrection.test.tsx`.
- Decisions: Keep API payloads and stored values unchanged. Translate only known lifecycle, review, and location codes. Show safe guidance for unknown errors. Freeze outcome requests and idempotency keys after uncertain responses; allow only the same-request retry. Keep the confirmed-order payment fields locked and the Pathao booking warning visible.
- Focused test: `npm run test:frontend -- src/features/seller/BuyerCorrection.test.tsx src/features/seller/OrderOutcomes.test.tsx src/features/seller/CorrectionOutcomeLocale.test.tsx src/features/seller/CourierPostSubmissionChanges.test.tsx` — 4 files, 15 tests passed.
- Root gate: `npm run check` passed after setting repository-local `TEMP`, `TMP`, and absolute forward-slash `PYTEST_ADDOPTS=--basetemp=...` to avoid this Windows host's pytest temp permission error. Result: `.cache/checks/check-ZJw5Ea/result.json` (tooling, backend lint/types/tests, frontend lint/tests/build, HTTP smoke all passed).
- Browser and physical-phone acceptance, screen reader behavior, hosted Clerk/Neon, live Pathao, and real payment-provider verification were not run. The local rendered tests and HTTP smoke do not prove those gates.
