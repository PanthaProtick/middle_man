# 11: Copied summaries and English CSV exports

**What to build:** Copy coherent order summaries in the selected language and download the existing English CSV with clear localized feedback.

**Blocked by:** 01 — Language switching and buyer order summary

**Status:** resolved

- [x] Translate summary labels, lifecycle explanations, purpose text, copy/download controls, loading/empty states, and success/failure/retry feedback.

- [x] Preserve inserted buyer/product/address/account text, IDs, and business values. Use shared human-readable money/date rules.

- [x] Identify CSV as English in both locales. Keep headers, status codes, ASCII decimals, Unicode data, field order, filtering, quoting, and formula-injection protection unchanged.

- [x] Localize known export/clipboard errors and safe unknown-error guidance without exposing technical details as the only explanation.

- [x] Switch while filters, copied state, or export are pending without re-copying, downloading twice, or issuing another request.

- [x] Extend rendered clipboard/export tests in both locales and retain backend CSV request checks for authentication, shop isolation, literal route behavior, amounts, headers, Unicode, and formula safety. Existing summary/export APIs permit starting independently of translated order/courier screens.

- [x] Keep approved standard Bangladeshi Bengali and plain English wording. Include Bengali-capable offline font fallback, phone wrapping and reachable controls, localized document/control language, associated errors, announcements, and preserved keyboard focus; test visible behavior rather than implementation details.

- [x] Run focused repository tests for changed behavior, then root npm run check as the final pre-handoff gate. Record changed paths, exact results, and failed/blocked/unrun browser or provider acceptance in the existing task record. Mocks and HTTP smoke do not prove live acceptance.

## Comments

- Base `14697e2`; feature commit `0f4f392`; integration tip `6d35dc0` merged as `1c52469`. Changed: `frontend/src/features/locale/exportCopy.ts` (new `{ en, bn }` catalog, summary formatter, feedback-code resolver), `frontend/src/features/seller/OrderExport.tsx`, `frontend/src/features/seller/OrderExport.test.tsx`, `frontend/src/features/locale/orderCatalogs.test.ts`.
- Behavior: feedback is stored as a code (`copied`/`started`/`empty`/`error` with a failure code), so locale changes re-render without a second clipboard write, download, or request. Clipboard text uses the language active at completion. The server `purpose` sentence is replaced by a localized sentence; summary values, ASCII amounts, lifecycle labels, `BDT`, and the `order-summaries.csv` download are preserved. 429/422/503/401 and clipboard denial map to localized guidance with a safe generic fallback; raw provider text is never shown. `OrderExport` has localized labels, `lang`, `aria-busy`, `role="status"`/`alert`, `aria-live`, `aria-describedby`, a 36px control, and a textual status marker.
- Summary payloads contain no account or date fields, so those remain unchanged/preserved elsewhere. Font fallback, phone wrapping, and keyboard focus come from the shared locale foundation; this ticket did not change them.
- Focused: `npm run test:frontend -- src/features/seller/OrderExport.test.tsx src/features/locale/orderCatalogs.test.ts src/features/seller/OrderLocale.test.tsx` — 3 files, 30 tests passed. `npm run test:backend -- tests/test_order_export.py` — 8 passed. `npm run typecheck` — no issues in 111 source files. `npm run lint:frontend` — passed.
- Root gate: `npm run check` passed all eight stages (tooling, backend lint/types/tests, frontend lint/tests/build, HTTP smoke) with repository-local pytest basetemp; result `.cache/checks/check-BjWW2t/result.json`.
- Not run: browser, physical-phone, and screen-reader acceptance in either locale; hosted Clerk/Neon sessions; live provider export/download; real device typography and focus. The rendered tests, mocks, and HTTP smoke do not establish those gates.
