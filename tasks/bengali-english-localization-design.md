# Task: Consistent Bengali and English experience

Status: In-Progress (spec published ready-for-agent; implementation pending)

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

- Changed paths: this brief, GLOSSARY.md, docs/ui-audience-and-design.md, and
  docs/adr/0006-bengali-english-presentation-boundary.md. Application unchanged.
- Interview questions Q1-Q15 accepted; no open product-design branch identified.
- The owner invoked to-spec to synthesize and publish the agreed design, and
  explicitly confirmed existing rendered journeys plus backend request boundaries.
- Published spec: ../.scratch/bengali-english-localization/spec.md, with
  Status: ready-for-agent. This is the implementation source of scope and acceptance.
- Next: implement from the published spec when requested; no code was changed as
  part of specification publication.
- Resume: inspect the current diff and published spec before beginning the first
  bounded implementation cluster.

## Verification

| Command or acceptance case | Result | Evidence |
| --- | --- | --- |
| Source inventory | Completed | Read-only source and documentation inspection |
| Spec structure and status | PASS | Seven required sections, 47 user stories, ready-for-agent |
| Documentation whitespace | PASS | git diff --check |
| Root npm run check | NOT RUN | Design documentation only |
| Browser / live-provider acceptance | NOT RUN | No implementation yet |
