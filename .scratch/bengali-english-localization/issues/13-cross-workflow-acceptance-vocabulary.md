# 13: Cross-workflow acceptance and vocabulary review

**What to build:** Verify the complete experience, review remaining vocabulary with the owner, and record evidence for the agreed completion standard.

**Blocked by:** 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12

**Status:** resolved

- [x] Audit owned copy across routes, forms, states, errors, historical/generated explanations, embedded authentication, and copied summaries. Catch missing keys, interpolation mismatches, and hardcoded copy while allowing preserved data and the English CSV. Added a centralized copy audit over all copy modules and fixed the four confirmed remaining gaps (correction session error, manual-payment placeholders, Bangladesh-time label, document title).

- [x] Review remaining bilingual terms with the owner and apply approved glossary wording. Retain distinctions between payment claims, matching, confirmation, drafts, and accepted courier bookings. Glossary wording is applied and owner sign-off completed: English surfaces use "payment claim", buyer-facing Bengali uses neutral "পেমেন্টের তথ্য", seller correction uses "পেমেন্টের দাবি", compact "গৃহীত অগ্রিম" is approved in courier sentences, and "COD" is retained in English/CSV with descriptive Bengali. GLOSSARY.md has been annotated accordingly.

- [x] Exercise integrated buyer/seller journeys in both locales: initialization, persistence, entry paths, recipient independence, pending/failed states, unknown-code recovery, and no lost inputs or repeated side effects. Rendered integration tests cover initialization, persistence, both entry paths, recipient independence, populated-form switching with no added requests, and localized titles; representative pending/failed/unknown-code states remain covered by the per-feature suites.

- [ ] Complete phone-browser checks for fonts, wrapping, control access, focus, document language, accessible names, error association, announcements, and reduced motion. Fix integrated problems rather than only writing a checklist. NOT RUN: no phone browser or screen reader was exercised.

- [ ] Confirm real embedded authentication/recovery evidence from ticket 12. Separate local/mocked/browser/hosted/provider results; do not claim complete localization with missing required copy or browser/authentication acceptance. NOT RUN: ticket 12 evidence is mocked/local only; no real Clerk session was exercised.

- [x] Retain offline/manual paths, CSV compatibility, original data/evidence, numeric/date semantics, privacy, authorization, and booking safeguards. Add no outbound messaging, account locale sync, deployment, payment, or booking. Unchanged; root checks passed.

- [x] Update existing task/audience/ADR records to reflect actual implementation and unresolved evidence without modifying the parent specification.

- [x] Run root npm run check after integration fixes and report actual results and the result-artifact location, including failed, blocked, and unrun gates. PASS: `.cache/checks/check-ysJlOM/result.json`.

- [ ] Keep approved standard Bangladeshi Bengali and plain English wording. Include Bengali-capable offline font fallback, phone wrapping and reachable controls, localized document/control language, associated errors, announcements, and preserved keyboard focus; test visible behavior rather than implementation details. Copy, offline font fallback, document language, associated errors, and preserved focus are implemented and tested; phone wrapping/control reachability and announcements were not verified on a real phone or screen reader.

- [x] Run focused repository tests for changed behavior, then root npm run check as the final pre-handoff gate. Record changed paths, exact results, and failed/blocked/unrun browser or provider acceptance in the existing task record. Mocks and HTTP smoke do not prove live acceptance.

## Comments

- Baseline: `2c4be4d` on `ticket-13-acceptance-vocabulary`; tickets 11–12 merged.
- Changed paths: `GLOSSARY.md`; `frontend/src/App.tsx`; locale `catalog.ts`, `correctionOutcomeCopy.ts`, `courierCopy.ts`, `exportCopy.ts`, `historyCopy.ts`, `paymentExceptionCopy.ts`, `paymentInboxCopy.ts`, `receiptCopy.ts`, `sellerCopy.ts`, `orderCopy.ts`, `buyerMessages.ts`, `format.ts`; locale tests `copyAudit.test.ts`, `integration.test.tsx`, `format.test.ts`; seller `BuyerCorrection.tsx`, `ManualTransactionModal.tsx`, `SellerSession.tsx` and `CorrectionOutcomeLocale`, `ManualTransactionLocale`, `SellerWorkspace`, `OrderExport`, `SellerSession` tests; `docs/adr/0006-bengali-english-presentation-boundary.md`; `docs/ui-audience-and-design.md`; `tasks/bengali-english-localization-design.md`; this ticket.
- Exact commands/results:
  - `npm run test:frontend -- src/features/locale src/App.locale.test.tsx src/features/seller/CorrectionOutcomeLocale.test.tsx src/features/seller/ManualTransactionLocale.test.tsx src/features/seller/SellerWorkspace.test.tsx src/features/seller/OrderExport.test.tsx src/features/seller/PaymentException.test.tsx` — PASS, 13 files / 123 tests.
  - `npm run test:frontend -- src/features/seller/SellerSession.test.tsx src/features/locale src/App.locale.test.tsx` — PASS, 9 files / 95 tests.
  - `npm run typecheck` — PASS, 111 source files.
  - `npm run lint:frontend` — PASS.
  - `npm run check` — PASS (tooling, backend lint/types, 465 backend passed / 170 skipped, frontend lint, 69 files / 389 tests, build, HTTP smoke); artifact `.cache/checks/check-ysJlOM/result.json`.
- Vocabulary decisions approved by owner: English “payment claim” retained for claims; buyer-facing Bengali uses neutral “পেমেন্টের তথ্য”, while seller-facing correction uses “পেমেন্টের দাবি”; GLOSSARY.md is annotated with UI label conventions while keeping “buyer payment proof” / “ক্রেতার দেওয়া পেমেন্টের তথ্য” for domain noun and comparison caption; compact “গৃহীত অগ্রিম” approved inside courier sentences while full labels remain on standalone summaries; “COD” retained in English/CSV with descriptive “ডেলিভারির সময় বাকি পরিশোধ” in Bengali. No provider-verification or booking certainty was added.
- Unrun acceptance: phone-browser fonts/wrapping/control sizing/focus/reduced motion/announcements, screen-reader behavior, real embedded Clerk sign-in/recovery, hosted deployment, and live Pathao/payment/AI provider behavior. No headless-browser smoke was run; rendered tests and HTTP smoke do not establish these gates.
