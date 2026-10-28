# Task: Consistent Bengali and English experience

Status: Implemented and locally verified through ticket 13. Phone-browser,
screen-reader, real embedded authentication, hosted, and live-provider acceptance
remain unrun and unclaimed.

## Goal and settled scope

- Support Bengali and English across seller-facing and buyer-facing surfaces we
  control: onboarding, forms, errors, notifications, and automated messages.
- Keep developer logs and internal documentation in English.
- Use simple, conversational standard Bangladeshi Bengali with familiar terms
  such as অর্ডার and ডেলিভারি, paired with plain English.
- Preserve user-written product names, addresses, buyer messages, and other
  submitted content exactly as entered when the interface language changes.
- Preserve TrxID values, order IDs, phone/account numbers, and brand names.
  Translate their labels, instructions, and errors; retain useful parenthetical
  English terms, for example ট্রানজেকশন আইডি (TrxID).
- Show the selected language instead of paired labels everywhere; keep a visible
  বাংলা / English switch in both modes.
- On a first visit use Bengali when the browser prefers Bengali, English otherwise.
  An explicit choice overrides browser preference and persists on that device.
- Share that device preference across buyer and seller screens. A buyer opening
  a shared order link uses their own preference, not the seller's language.
  Keep language device-local initially; do not sync through seller accounts.
- Display amounts, phone numbers, and identifiers using 0-9 in both languages.
  Accept Bengali digits in numeric inputs and normalize safely; do not rewrite
  arbitrary user-written text or opaque identifiers.
- Use localized month names, Gregorian dates, and Bangladesh time for displayed
  times. Avoid ambiguous numeric-only dates.
- Human-readable copied summaries follow the selected language. CSV keeps stable
  English headers/status codes and original data, with an English-CSV label.
- Existing glossary distinctions remain authoritative: order confirmation and
  payment matching must not imply independent payment-provider verification;
  a courier draft must not imply an accepted Pathao booking.
- Keep Pathao location names as supplied, with translated surrounding labels.
- Translate embedded authentication. External provider sites retain their own
  language; provide localized guidance before leaving the application.
- Generated explanations follow the selected language; extracted addresses and
  historical evidence stay unchanged. Switching must not repeat AI requests,
  payment operations, or courier submissions. Known historical errors render
  through stable codes. Saved generated text without a translation gets a
  localized explanation and an explicit option to view the original.
- Approved Bengali terms are recorded in GLOSSARY.md. The owner reviews remaining
  bilingual vocabulary before release; wording must retain business distinctions.

## Current evidence

- Inspected baseline: ecfc39f10173661e38f3f9d1825a1376c919832c.
- No shared locale provider, translation catalog, toggle, or persisted language
  preference was found in the application source inventory.
- Seller text is mostly English; buyer text often embeds both languages inline.
- Buyer and seller render through different entry paths in frontend/src/main.tsx;
  buyer links bypass Clerk. Third-party authentication coverage needs verification.
- Backend messages and field errors can reach the UI directly. AI-generated
  address clarification text has no explicit language instruction.
- Money/date formatting varies; the document language is fixed to English.
- Copied order summaries and CSV exports are additional language surfaces.
- Installed Clerk types permit custom localization resources; complete Bengali
  coverage and live authentication behavior remain unverified.
- No outbound notification service was found in the scoped application search.
  Existing notification scope does not authorize adding a new messaging service.
- Pathao catalogs supply a single authoritative name per location, not bilingual
  labels. Existing CSV tests depend on English headers and ASCII decimal values.
- Stored address-assistance responses and courier errors contain presentation
  text; switching language must account for replayed/historical messages without
  repeating side effects or changing stored evidence.
- docs/ui-audience-and-design.md now links this planned replacement of its paired
  buyer labels; it continues to distinguish current behavior from the design.

## Acceptance cases and rollout gates

- Both locales cover seller/buyer routes, forms, statuses, empty/loading states,
  validation, recovery, historical errors, accessible labels, and existing copied
  messages. Do not add an outbound messaging service to satisfy this scope.
- Browser preference initializes correctly; explicit selection persists across
  reloads and both entry paths. Shared-link recipients keep their own preference.
- Language changes preserve form values, validation meaning, current navigation,
  order/payment/courier state, and evidence. They cause no business side effects
  or repeated AI calls. Test pending and failed operations as well as idle forms.
- Bengali numeric input works at numeric boundaries; identifiers and free text
  remain intact. Numeric output, dates, copied summaries, CSV compatibility,
  Unicode handling, and CSV formula protection retain agreed semantics.
- Automated checks catch missing translations and exercise representative success,
  validation, failure, and replay states in both languages. Localization remains
  incomplete while required copy is missing.
- Phone-browser checks cover Bengali font rendering, wrapping, control sizing,
  visible switch, document language, focus, and accessible announcements. Include
  embedded sign-in and its recovery/error paths in real-session verification.
- Run focused checks per bounded feature cluster, then root npm run check as the
  final implementation gate. Automated success does not prove live auth/provider
  behavior. Do not claim full acceptance until required browser checks pass.

## Implementation sequence after confirmation

1. Inventory owned copy and establish shared locale selection, catalogs, numeric/
   date presentation, and translation-completeness checks across both entry paths.
2. Localize buyer flows and errors; verify switching preserves in-progress forms.
3. Localize seller flows, courier/payment states, and human-readable copied text.
4. Cover persisted errors, generated explanations, and embedded authentication
   without changing evidence, replay semantics, or CSV contracts.
5. Review vocabulary with the owner, complete browser acceptance in both locales,
   and run the final root check. Record any unverified external acceptance plainly.

## Current state and next action

- Status: tickets 01–02 implemented and locally verified. Tickets 03–12 are independently unblocked;
  ticket 13 follows them.
- Shared locale foundation added under `frontend/src/features/locale/`:
  `catalog.ts` (typed English/Bengali catalogs), `context.ts`,
  `LocaleProvider.tsx`, `LocaleSwitch.tsx`, `storage.ts` (validated
  device preference, browser fallback, unavailable-storage tolerance), and
  `format.ts` (0-9 money, Asia/Dhaka dates, localized Gregorian months).
- Both entry paths now render the switch: `App.tsx` portal header and the
  seller `Header` (including signed-out/no-Clerk). The document language and
  explicit preference update without login. Seller shell/navigation copy and the
  buyer submission form remain unmigrated by design (tickets 02–12).
- Buyer summary translated: `BuyerOrderDetails.tsx`, `BuyerStatusView.tsx`,
  and localized loading/refresh/unavailable/policy-gate/retry states in
  `BuyerPortal.tsx`. `usePublicOrder.ts` now exposes presentation-free failure
  kinds; known errors no longer display raw server English. Shop, product,
  provider/account text, numbers, IDs, amounts, and lifecycle values are
  preserved. Delivery advance and remaining COD have explanatory copy; seller
  acceptance does not claim independent payment-provider verification.
- Presentation support: Bengali-capable offline font fallback and wrapping in
  `styles/theme.css`/`styles/buyer.css`, switch announcement, preserved focus,
  and associated copy-error text.
- Test harness: `test/setup.ts` installs an in-memory Storage only when the
  environment's `localStorage` lacks methods (Node 25 experimental global).
- Changed paths: `frontend/src/App.tsx`, `frontend/src/App.locale.test.tsx`,
  `frontend/src/components/Header.tsx`, `frontend/src/features/locale/*`,
  `frontend/src/features/buyer/BuyerOrderDetails.tsx`,
  `frontend/src/features/buyer/BuyerPortal.tsx`,
  `frontend/src/features/buyer/BuyerStatusView.tsx`,
  `frontend/src/features/buyer/api.ts`,
  `frontend/src/features/buyer/usePublicOrder.ts`,
  `frontend/src/features/buyer/BuyerLocaleSummary.test.tsx`,
  `frontend/src/features/buyer/BuyerLocaleStates.test.tsx`,
  `frontend/src/features/buyer/buyerLocaleFixtures.ts`,
  `frontend/src/features/buyer/BuyerReplacementIsolation.test.tsx`,
  `frontend/src/features/seller/api.ts`, `frontend/src/styles/{theme,buyer}.css`,
  and `frontend/src/test/setup.ts`.
- Verification: focused locale/App/buyer suites passed (14 files, 83 tests);
  full frontend suite passed (48 files, 234 tests); backend suite passed
  (458 passed, 170 skipped); root `npm run check` passed, result
  `.cache/checks/check-iZEZ0B/result.json`.
- Remaining gaps: phone-browser visual/typography/accessibility acceptance in
  Bengali and English was NOT RUN. Real embedded Clerk sign-in/recovery was NOT
  RUN. No live provider or deployment behavior was involved.
- Next: ticket 03 (address assistance), followed by the remaining
  workflow slices; ticket 13 runs integrated vocabulary and browser acceptance.

## Verification

| Command or acceptance case | Result | Evidence |
| --- | --- | --- |
| Source inventory | Completed | Read-only source and documentation inspection |
| Spec structure and status | PASS | Seven required sections, 47 user stories, ready-for-agent |
| Pre-implementation documentation whitespace | PASS | git diff --check |
| Focused locale/App/buyer tests | PASS | 14 files, 83 tests |
| Full frontend suite | PASS | 48 files, 234 tests |
| Backend suite (unchanged contracts) | PASS | 458 passed, 170 skipped |
| Root `npm run check` | PASS | `.cache/checks/check-iZEZ0B/result.json` (tooling, lint, types, backend/frontend tests, build, HTTP smoke) |
| Ticket 01 browser acceptance | NOT RUN | No phone-browser typography/focus/document-language check performed |
| Real embedded Clerk sign-in/recovery | NOT RUN | Requires live authentication configuration; mocked paths do not establish it |
| Review-fix post-fix root `npm run check` | PASS | `.cache/checks/check-FWfCQo/result.json` (465 backend passed/170 skipped; 71 frontend files/400 tests; tooling, lint, types, build, HTTP smoke) |

## Ticket 02 implementation and verification

- Buyer identity/address/payment fields, placeholders, help, validation, pending,
  failure and retry copy now follow the selected locale. Pathao loading, empty,
  unavailable, retry, search and saved-choice descriptions also translate.
- Error state retains codes rather than translated strings. Public field errors
  expose only typed min/max length constraints; retry timing uses the existing
  Retry-After header. Unknown errors receive safe localized guidance.
- Bengali digits are normalized only while parsing exact BDT minor units;
  phone validation already supports them. User text, TrxIDs, provider names,
  authoritative location labels/IDs, raw phone evidence and frozen retry
  body/idempotency key are preserved. Focus follows the first invalid control
  in document order and language changes do not move it or repeat requests.
- Changed paths: `backend/app/{main.py,models/seller.py}`,
  `backend/tests/test_buyer_boundaries.py`,
  `frontend/src/features/buyer/{BuyerSubmissionForm,PaymentClaimFields,PathaoLocations}.tsx`,
  `frontend/src/features/buyer/{api,useBuyerSubmission,submissionErrors,validateBuyerDraft}.ts`,
  `frontend/src/features/buyer/{BuyerLocaleSubmission,BuyerRetry,PathaoLocations,PathaoLocaleStates}.test.tsx`,
  `frontend/src/features/buyer/api.test.ts`,
  `frontend/src/features/locale/{catalog,buyerMessages,buyerErrors,buyerLocations}.ts`,
  `frontend/src/styles/buyer.css`, `docs/API_CONTRACTS.md`, and ticket 02.
- Exact focused checks: `npm run test:frontend -- src/features/buyer src/features/locale`
  passed (15 files, 99 tests); `npm run test:backend -- tests/test_buyer_boundaries.py tests/test_public_order_routes.py tests/test_pathao_locations.py`
  passed (25 tests); `npm run typecheck` passed. After the focus-order correction,
  `npm run test:frontend -- src/features/buyer/BuyerLocaleSubmission.test.tsx`
  passed (8 tests). `git diff --check` passed.
- Two-axis code review against starting commit `153aabc1fb1d6ba98fd8f14d7d31bca8a0a2177e`
  (staged diff): Standards 0 findings; Spec 0 findings.
- Final `npm run check`: PASS, `.cache/checks/check-kAjJYU/result.json`.
  Backend: 459 passed, 170 skipped. Frontend: 50 files, 252 tests passed.
  Tooling, backend lint/types, frontend lint/build and HTTP smoke all passed.
  The initial run `.cache/checks/check-srOFAb/result.json` failed on a Windows
  pytest temp-directory permission error (458 passed, 170 skipped, 1 error).
  Passing command: `TEMP=E:\middle_man\.cache\temp-ticket02`, same `TMP`,
  `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.cache/pytest-ticket02`, then
  `npm run check` (set as PowerShell environment variables).
- Next: ticket 03 (address assistance); no implementation work remains in ticket 02.
- Unrun acceptance: phone-browser wrapping/font/keyboard/screen-reader behavior,
  physical devices, live Pathao/provider and hosted deployment. Existing offline
  Bengali-capable font fallback is retained; rendered tests and HTTP smoke do not
  establish those acceptance gates. Address assistance remains ticket 03.

## Ticket 03 implementation

- Localized assistance consent, pending, review and safe error states. Saved
  clarification text is shown on request when its language differs or is unknown.
  Locale switches preserve fields and never initiate requests.
- Added optional language presentation metadata, excluded from the existing
  idempotency fingerprint; fresh provider requests receive the selected language.
  Historical records replay with unknown language. Provider language is not verified.
- Focused checks: `npm run test:backend -- tests/test_address_routes.py tests/test_address_adapter.py tests/test_address_postgres.py` passed (13 passed, 2 PostgreSQL skipped); `npm run test:frontend -- src/features/buyer/AddressAssistanceLocale.test.tsx src/features/buyer/BuyerAiPolicy.test.tsx` passed (initial 4 tests), and the updated assistance suite passed (3 tests); `npm run typecheck` passed.
- Remaining acceptance: phone-browser wrapping, font, keyboard and screen-reader
  behavior, live AI provider and hosted deployment have not been verified.
- Changed paths: `backend/app/models/address_assistance.py`,
  `backend/app/services/address_assistance.py`, `backend/app/services/address_provider.py`,
  `backend/tests/test_address_routes.py`, `backend/tests/test_address_adapter.py`,
  `backend/tests/test_address_postgres.py`, `frontend/src/features/buyer/AddressAssistance.tsx`,
  `frontend/src/features/buyer/AddressAssistance.test.tsx`,
  `frontend/src/features/buyer/AddressAssistanceLocale.test.tsx`,
  `frontend/src/features/locale/addressAssistanceCopy.ts`, and `docs/API_CONTRACTS.md`.
- Two-axis review identified missing terminal service codes and focus preservation;
  both were corrected, with rendered regression coverage. Translation copy was
  moved to the locale feature. Historical unknown-language output is tested.
- Initial root `npm run check` failed: two old frontend fixtures omitted language
  metadata and expected immediate English text. Updated fixtures to match fresh
  responses; `npm run test:frontend -- src/features/buyer/AddressAssistance.test.tsx src/features/buyer/AddressAssistanceLocale.test.tsx` passed (15 tests).
- Final root `npm run check` passed: `.cache/checks/check-v8aMlg/result.json`
  (tooling, backend lint/types/tests, frontend lint/tests/build, HTTP smoke).

### Ticket 04 — seller shell localization

- Localized seller chrome, setup, navigation, loaded-record metrics and session states; stable workspace error codes re-render in the selected language. Session loading now shares the locale provider with the workspace.
- Changed paths: `frontend/src/App.tsx`, `frontend/src/components/Header.tsx`, `frontend/src/features/locale/sellerCopy.ts`, `frontend/src/features/seller/{SellerSession,sessionReason,SellerWorkspace,ShopSetupForm,ShopMetricsBar,WorkspaceHeader,WorkspaceSectionNav,WorkspaceAccountsSummary}.tsx` (sessionReason is `.ts`), corresponding seller tests, and `frontend/src/styles/theme.css`.
- Focused checks: seller locale (3 tests), workspace error (1 test), and session (15 tests) passed; `npm run typecheck` passed. Two-axis review identified error masking, misleading storage guidance and phone grid issues; these were corrected. Session diagnostics were translated.
- Initial review left pending setup, session failure, focus, metrics and history coverage and workspace decomposition for follow-up.
- Root verification: initial `npm run check` stopped at a Windows pytest temp permission error (459 passed, 170 skipped, 1 error). With repository-local TEMP/TMP, the next run found a frontend lint issue, then a further run found two outdated test expectations; these were fixed. Final `npm run check` passed all gates: `.cache/checks/check-RytJFm/result.json`.
- Follow-up added those rendered checks and extracted workspace state and error presentation. Review also identified setup-key conflict recovery, shop-name validation and misleading session expiry guidance; these were corrected. A setup conflict requires checking shop state before rotating the key, with input retained and failed checks retryable. Physical phone, screen reader, real Clerk and hosted/provider acceptance remain unrun.
- Follow-up focused tests: seller locale and session suites passed (22 tests); workspace suites passed (17 tests); typecheck passed. Final root `npm run check` passed with repository-local TEMP/TMP: `.cache/checks/check-mUGwRm/result.json`.

### Ticket 05 — partial buyer-link localization (2026-10-28)

- Localized buyer-link access, uncertainty/stale warnings, retry controls, copy
  feedback, manual copy label, and the portal-opening label. Error state remains
  coded so switching languages does not repeat or replace a pending operation.
- Changed: `frontend/src/features/locale/buyerLinkCopy.ts`,
  `frontend/src/features/seller/BuyerLinkAccess.tsx`, `BuyerLinkCopy.tsx`,
  `OrderDetailModal.tsx`, and their buyer-link rendered tests.
- Focused `npm run test:frontend -- src/features/seller/BuyerLinkAccess.test.tsx`
  passed (5 tests); `npm run test:frontend -- src/features/seller/BuyerLinkCopy.test.tsx`
  passed (1 test); `npm run typecheck` passed before the last link label change.
- Ticket remains open: creation, list, details, parcel fields, numeric input and
  server field errors, and their bilingual journeys still require implementation.
  Browser, physical-device and live-provider acceptance remain unrun.
- Next: trace and localize the order creation form and parcel validation, retaining
  values and idempotency across language changes; then list/details and endpoint
  coverage. Run the root gate again after completing the ticket.
- Root `npm run check` initially stopped at backend pytest setup due to Windows
  default temporary-directory access; rerun with
  `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.scratch/pytest-link-locale-20261028`
  passed all configured gates (`.cache/checks/check-UMdQX3/result.json`).

### Ticket 05 — remaining order workflows (2026-10-28)

- Baseline for this continuation: `d75ae6e`; whole-ticket review baseline:
  `50544e2`. The earlier link commit and its hook completed successfully.
- Localized order creation, optional parcel guidance and errors, order list/filter/
  pagination/empty states, lifecycle/review labels, details, allocation labels,
  account snapshots, dates, parcel values and visible diagnostic controls.
  Existing search behavior is unchanged (the order list has no search control).
- Extracted creation state into `useOrderCreation.ts`; numeric inputs retain raw
  Bengali/English drafts and parse exactly to safe integer minor units/grams.
  Display formatting preserves cents even at the supported safe-integer boundary.
  Validation uses stable codes, associated errors and first-invalid focus.
  Pending controls, retry keys, URLs and opaque data survive language changes.
- New files: locale `orderCopy.ts`, `orderCreationCopy.ts`,
  `orderDiagnosticCopy.ts`, `orderCatalogs.test.ts`; seller `useOrderCreation.ts`,
  `orderCreationError.ts`, `orderNumbers.ts`, `CreateOrderLocale.test.tsx`,
  `OrderLocale.test.tsx`; backend `tests/test_order_locale_contracts.py`.
  Existing creation/parcel/list/details/diagnostic presentation and tests updated.
- Focused frontend run passed: 10 files, 43 tests. Focused endpoint contracts:
  `npm run test:backend -- tests/test_order_locale_contracts.py` passed (2 tests).
  Typechecking passed. Later parcel-code refinement passed its focused 7 tests.
- Summary/CSV controls (11), payment/history (06–07), courier (08–09) and correction/
  outcome panels (10) remain separately tracked; their embedded presence does not
  expand this ticket into all seller workflows. Diagnostic payloads stay English.
- Next: complete the required two-axis review, address findings, run the root
  final gate, record its exact result, then commit. Phone/browser, screen-reader,
  real-session and live-provider acceptance remain unrun.
- Two-axis review: Standards found one first-invalid ordering defect; Spec found
  that defect plus the modal's unreachable outside language switch. Reordered
  server-field selection and added switches inside both dialogs. Rendered tests
  cover out-of-order server errors and in-dialog switching with retained focus.
  Both reviewers rechecked the fixes: no remaining actionable findings.
- Post-review focused creation/list/details run: 5 files, 27 tests passed.
- Final root `npm run check`: initial run failed import ordering in the new
  endpoint test; corrected. Final run passed every configured stage with
  `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.scratch/pytest-ticket05-final`:
  `.cache/checks/check-ijKqoo/result.json`.
- Ticket 05 implementation is complete and locally verified. Manual browser,
  phone/font/wrapping, screen-reader, real Clerk and live-provider acceptance
  remain unrun. These are not established by rendered tests or HTTP smoke.

### Ticket 06 — partial implementation (2026-10-28)

- Baseline `b9f5c3750907480a91a8bf0bdde991be31c68259`. Localized the manual payment exception preview and stable reason codes in `frontend/src/features/seller/PaymentException.tsx` and `frontend/src/features/locale/paymentExceptionCopy.ts`; updated `PaymentException.test.tsx` with a rendered blocked-preview language-switch case. Unknown reason and request errors use safe guidance. Existing acceptance and retry logic remains in place.
- Focused `npm run test:frontend -- src/features/seller/PaymentException.test.tsx` passed (4 tests); `npm run typecheck` passed. Initial focused red test failed as expected before implementation.
- Incomplete: receiving accounts, SMS import, manual receipt entry, inbox/cards, evidence resolution and correction, full request and locale-switch journeys, accessibility and phone wrapping remain. Complete those before marking the ticket resolved, then perform the required two-axis review and final check. Browser, screen-reader, physical-device and live-provider acceptance have not been run.
- Partial-work root `npm run check` passed all configured stages with repository-local pytest basetemp; result `.cache/checks/check-EjZI6C/result.json`. This does not establish full ticket completion.

### Ticket 06 — completion (2026-10-28)

- Completed receiving-account setup/edit/status, payment inbox/filter/empty states,
  SMS import/results, manual receipt entry, evidence comparison/correction and
  exception acceptance presentation in Bengali and English. Catalogs:
  `paymentInboxCopy.ts`, `receiptCopy.ts`, `paymentExceptionCopy.ts`.
- Locale changes retain account/receipt/SMS drafts, filters, loaded evidence and
  pending decisions. Numeric amount boundaries accept Bengali digits; opaque
  account labels, TrxIDs, SMS and decision reasons retain their original text.
  Exceptions describe seller acceptance without implying independent verification.
  Unknown request errors receive safe guidance, and matching blockers remain enforced.
- Added rendered account, inbox and manual-entry locale journeys; extended evidence
  retry tests to switch language while retaining identical payload/key. Focused
  integration: 8 files / 22 tests passed; final account locale run: 3 tests passed.
  `npm run typecheck` passed. Existing request and matching tests run in the full gate.
- Two-axis review: Standards identified encoding, pending-account guards, associated
  errors/focus and modal length; all corrected and rechecked. Spec identified two
  remaining evidence strings and parent error echo; corrected. No remaining
  actionable findings within the reviewed change. English-keyed catalogs retain
  a maintenance trade-off: new copy must include its Bengali translation.
- Final `npm run check` passed all configured stages with
  `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.scratch/pytest-ticket06-final`:
  `.cache/checks/check-kVjAi8/result.json`.
- Browser/physical-phone wrapping, screen-reader, real-session and live-provider
  acceptance remain unrun; rendered tests and HTTP smoke do not establish them.

### Ticket 08 — completion (2026-10-28)

- Baseline `1e7d7ca4fa9d2ca06970cb976c7fb224175b8250`. Changed `frontend/src/features/locale/courierCopy.ts`, `frontend/src/features/seller/courierErrorText.ts`, `CourierError.tsx`, `CourierOutcomes.tsx`, `CourierDraft.tsx`, `CourierReview.tsx`, `CourierReviewLocations.tsx`, `CourierReconciliation.tsx`, `DeliverySummary.tsx`, and `DeliveryDetails.css`. Added `CourierLocale.test.tsx` and `CourierRecoveryLocale.test.tsx`; extended backend courier submission/failure tests. Ticket file updated.
- Language changes render from saved state; courier requests remain keyed to order/session/revision, and switch does not run review, submission, reconciliation, or location requests. Known blocker/error codes receive selected-language guidance. Unknown provider text is behind an original-evidence disclosure on authenticated seller screens. Pathao names/IDs, contact/address evidence, parcel values, and recorded attempts are preserved. Draft numeric boundaries accept Bengali digits.
- Focused frontend courier runs passed (latest 4 files / 20 tests). Focused backend submission/failure/replay passed (26 tests); root `npm run typecheck` passed. First root gate failed frontend lint on an exported helper; moved it into its own module. Final root `npm run check` passed every stage with repository-local pytest basetemp: `.cache/checks/check-LcGcaV/result.json`.
- Manual browser, phone wrapping/font, screen-reader, real Clerk, sandbox Pathao, and live-provider acceptance: NOT RUN. Rendered tests and HTTP smoke do not establish these gates.

### Ticket 13 — cross-workflow acceptance and vocabulary audit (2026-10-28)

- Baseline `2c4be4d` on `ticket-13-acceptance-vocabulary` (integration tip
  `feat/bengali-english-localization`; tickets 11–12 merged).
- Fixed the four confirmed audit gaps: `BuyerCorrection` now renders the
  session-required error from `correctionOutcomeCopy`; `ManualTransactionModal`
  placeholders resolve through `receiptCopy`; `format.ts` labels Bangladesh time
  as `Bangladesh time`/`বাংলাদেশ সময়` while keeping Asia/Dhaka and 0-9 digits;
  and `AppShell` sets a localized per-route `document.title` for the buyer portal
  and seller workspace without changing routing or remounting state; the seller
  session also sets it while Clerk/session state is still loading.
- Added centralized `frontend/src/features/locale/copyAudit.test.ts`: key parity,
  non-empty values, placeholder parity, and lookup resolution across paired
  catalogs (`catalogs`, buyer link/order/creation/diagnostic, correction/outcome,
  export, seller, address assistance, buyer messages/locations/errors, payment
  exception) and English-keyed Bengali dictionaries (`courierBengali`,
  `historyBengali`, `paymentInboxBengali`, `receiptBengali`). Identical values are
  deliberately limited to documented terms (বাংলা, SMS, TrxID, Pathao,
  Facebook/Messenger, BDT, Gemini, Google, English). `historyBengali`,
  `paymentInboxBengali`, `receiptBengali`, and `paymentExceptionReasons` are
  exported only for this audit; runtime lookups still use their existing helpers.
- Added `frontend/src/features/locale/integration.test.tsx`: browser preference
  `bn`/non-`bn`, explicit override persisted across remount, one locale shared by
  buyer `/orders/...` and seller entry paths, shared-link recipient independence
  (supplied order locale ignored; public path stays Clerk-free), populated buyer
  form with the same DOM node, values, and request count after switching, and
  localized buyer/seller tab titles.
- Vocabulary aligned with GLOSSARY.md: confirmed order wording in `sellerCopy`
  and `paymentInboxCopy`; remaining COD wording in `paymentExceptionCopy`;
  delivery-advance labels in `orderCopy`, `exportCopy`, `historyCopy`,
  `buyerMessages`, and `paymentExceptionCopy`; courier-draft wording in
  `courierCopy` and `correctionOutcomeCopy`. The seller name-limit copy now uses
  0-9 digits. No provider or booking certainty was added.
- Owner-review vocabulary approved and documented: seller UI
  uses English “payment claim”/Bengali “পেমেন্টের দাবি” for the claim concept,
  while GLOSSARY.md’s approved noun is “buyer payment proof”/“ক্রেতার দেওয়া
  পেমেন্টের তথ্য” (used in comparison caption and annotated in GLOSSARY.md). Compact labels such as
  “গৃহীত অগ্রিম” remain inside courier sentences. English/CSV also retain “COD”;
  Bengali uses the approved remaining-balance phrase.
- Changed paths: `frontend/src/App.tsx`,
  `frontend/src/features/locale/{catalog,correctionOutcomeCopy,courierCopy,exportCopy,historyCopy,paymentExceptionCopy,paymentInboxCopy,receiptCopy,sellerCopy,orderCopy,buyerMessages,format}.ts`,
  `frontend/src/features/seller/{BuyerCorrection,ManualTransactionModal,SellerSession}.tsx`,
  `frontend/src/features/locale/{copyAudit.test.ts,integration.test.tsx,format.test.ts}`,
  `frontend/src/features/seller/{CorrectionOutcomeLocale,ManualTransactionLocale,SellerWorkspace,OrderExport,SellerSession}.test.tsx`,
  `GLOSSARY.md`, `docs/adr/0006-bengali-english-presentation-boundary.md`,
  `docs/ui-audience-and-design.md`, this record, and ticket 13.
- Focused checks: `npm run test:frontend -- src/features/locale src/App.locale.test.tsx src/features/seller/CorrectionOutcomeLocale.test.tsx src/features/seller/ManualTransactionLocale.test.tsx src/features/seller/SellerWorkspace.test.tsx src/features/seller/OrderExport.test.tsx src/features/seller/PaymentException.test.tsx`
  passed (13 files, 123 tests); a follow-up seller-session/locale run
  `npm run test:frontend -- src/features/seller/SellerSession.test.tsx src/features/locale src/App.locale.test.tsx`
  passed (9 files, 95 tests). `npm run typecheck` passed (111 source files);
  `npm run lint:frontend` passed.
- Root `npm run check` PASS: `.cache/checks/check-ysJlOM/result.json`
- Post-review-fix root `npm run check` PASS: `.cache/checks/check-FWfCQo/result.json`
  (tooling, backend lint/types, 465 backend passed/170 skipped, frontend lint,
  69 frontend files/389 tests, build, HTTP smoke).
- Copy-audit limit: `copyAudit.test.ts` compares dictionary keys, values,
  placeholders, and lookup resolution. It cannot detect copy written directly in
  JSX, so the hardcoded-copy gaps from review were fixed and are covered by
  rendered locale tests instead.
- Unrun gates: phone-browser font/wrapping/control/focus/reduced-motion/
  announcement checks and screen-reader behavior were NOT RUN. Real embedded
  Clerk sign-in/recovery was NOT RUN (ticket 12 evidence is mocked/local only).
  Hosted deployment and live Pathao/payment/AI provider behavior were NOT RUN. No
  headless-browser smoke was run and no browser dependency was added, so rendered
  tests and HTTP smoke do not establish those gates.

### Review-fix pass — two-axis findings (2026-10-28)

- Baseline `4359cea` on branch `review-fixes-localization`. Ticket 13's
  owner-approved vocabulary, resolved status, and checkboxes from main remain
  authoritative; ticket 12 remains **reopened - live authentication acceptance
  failures**. This pass added no live Clerk coverage.
- Fixed remaining hardcoded copy in `AccountsSection` (courier integration
  heading/guidance) and `CourierDraft` (proposal retry and reload controls), with
  rendered Bengali coverage. Replaced the simultaneous bilingual buyer contact
  placeholder with selected-language copy using 0-9 digits (`017XXXXXXXX` /
  `যেমন: 017XXXXXXXX`). Removed the stale `BST` label while the formatter appends
  the localized zone; English seller/export COD labels now use the glossary's
  “remaining COD balance” wording.
- Extracted `formatIntegerMinor` in `features/locale/format.ts`; `formatBdt` and
  `formatOrderAmount` both use it, preserving exact cents, signs, grouping, and
  two decimals at `Number.MAX_SAFE_INTEGER`. Extracted
  `normalizeBengaliDigits` and reused it in `canonicalizeBdPhone` and
  `asciiDigits` without changing phone/free-text behavior. Added focused tests.
- Header's `.status-badges` group regained a localized accessible name
  (`sellerCopy.status`). Reverted `.metric-chip:nth-child(5)` to the pre-existing
  `.metric-chip:last-child`; no layout test proved the newer selector necessary.
  Removed the `localizations: [] as unknown[]` cast in `Root.test.tsx` by typing
  the mock as `Array<ClerkLocalizationResource | undefined>`.
- Added `features/locale/keyedCopy.ts` as the single English-keyed lookup with
  explicit fallback; history, receipt, payment-exception, courier, and
  payment-inbox copy now use it with unchanged behavior. Removed the tracked
  `.scratch/tmp/uv-47c1bc0f64a35c35.lock`; no other scratch work was touched.
- Ticket 13's recorded integrated root gate is
  `.cache/checks/check-ysJlOM/result.json` (465 backend passed/170 skipped;
  69 frontend files/389 tests); the earlier stale `check-FvRozu` reference was
  already superseded before this merge. Post-fix root gate PASS:
  `.cache/checks/check-FWfCQo/result.json` (465 backend passed/170 skipped;
  71 frontend files/400 tests; tooling, lint, types, build, HTTP smoke all
  passed). An intermediate run `.cache/checks/check-6pA1Pd/result.json` failed
  10 frontend tests because the new integer formatter threw on `NaN`/undefined
  fixture amounts; it now retains the previous `NaN` placeholder output and the
  rerun passed. Merge resolution against `main` (`cd32581`) re-ran the root gate:
  PASS, `.cache/checks/check-hrO0mm/result.json` (465 backend passed/170 skipped;
  72 frontend files/404 tests; tooling, lint, types, build, HTTP smoke).
- Intentional domain-correctness change retained: `OrderOutcomes` offers
  replacement only for `awaiting_buyer`, `pending`, and `expired` orders (the
  ticket 10 review fix). This was not reverted and still needs owner confirmation.
- Unrun acceptance is unchanged: phone-browser typography/wrapping/controls/
  announcements, screen-reader behavior, real Clerk sign-in/recovery, hosted
  deployment, and live provider behavior.
