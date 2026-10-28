# Task: Consistent Bengali and English experience

Status: In-Progress (tickets 01–02 implemented and locally verified; tickets 03–13 pending)

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
