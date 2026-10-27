# Consistent Bengali and English experience

Status: ready-for-agent

## Problem Statement

Buyers and sellers encounter inconsistent English and Bengali across Middle Man.
Seller screens are mostly English, while buyer screens often combine both
languages in the same label. Someone confused by English cannot reliably choose
Bengali for an entire task: errors, instructions, authentication, historical
messages, and copied summaries may use different wording or languages.

Inconsistent business terminology can also mislead people about payment receipt,
order confirmation, remaining payment, or whether a courier request was actually
booked. A language change must improve comprehension without altering payment
details, addresses, evidence, or ongoing work.

## Solution

Provide a visible বাংলা / English switch across buyer and seller experiences.
Use simple, conversational standard Bangladeshi Bengali and plain English, with
consistent business vocabulary. Show the chosen language rather than duplicating
every label in both languages; retain familiar English terms in parentheses when
they help identify an important field.

Initialize from browser language preference, choosing Bengali when Bengali is
preferred and English otherwise. Remember explicit choices on that browser/device
across visits and buyer/seller screens. A buyer opening a shared link uses their
own preference, independently of the seller who created the order.

Translate owned interface text, explanations, errors, accessible labels, embedded
authentication, and human-readable copied messages. Preserve original user data,
identifiers, brand names, provider catalog names, and the English CSV contract.
Switch immediately without losing form values or repeating business actions.

## User Stories

1. As a buyer, I want to switch to Bengali from any buyer screen, so that I can understand the order without assistance.
2. As a seller, I want to switch to Bengali throughout my workspace, so that I can operate my shop confidently.
3. As an English-preferring user, I want complete plain-English screens, so that I can use the same workflows in English.
4. As a Bengali-preferring first-time visitor, I want my browser preference respected, so that my first screen is understandable.
5. As a visitor whose browser does not prefer Bengali, I want an English starting language, so that the application has a predictable default.
6. As a returning user, I want my explicit choice remembered on my device, so that I do not need to select it on each visit.
7. As a user, I want my explicit choice to override browser preference, so that I remain in control of the interface language.
8. As a user visiting buyer and seller screens on one device, I want the same remembered language, so that navigation does not unexpectedly change it.
9. As a buyer opening a shared order link, I want my own language preference, so that the seller's preference does not determine my experience.
10. As a seller using multiple devices, I want each device to retain its own preference, so that a phone and shared computer can suit different needs.
11. As a user, I want the switch labelled বাংলা / English in either mode, so that I can find the other language even when I cannot read the current screen.
12. As a phone user, I want one primary language per screen, so that duplicated labels do not crowd controls and instructions.
13. As a Bengali-speaking user, I want familiar standard Bangladeshi Bengali, so that formal or regional wording does not create another comprehension barrier.
14. As a user, I want each business concept to have consistent wording, so that I recognize it across screens and messages.
15. As a seller, I want onboarding and shop configuration in my selected language, so that I can complete setup accurately.
16. As a user signing in, I want embedded authentication instructions and recovery errors in my selected language, so that access is not an English-only barrier.
17. As a buyer, I want order terms, delivery advance, and remaining COD balance explained in my language, so that I understand what to pay now and on delivery.
18. As a buyer, I want payment-provider names, receiving numbers, and TrxID values preserved, so that I can compare them accurately with my payment app.
19. As a buyer, I want translated labels beside crucial English details, so that preserving those details does not leave me without an explanation.
20. As a user entering a form, I want validation and correction guidance in my selected language, so that I can fix mistakes independently.
21. As a user switching language mid-form, I want my values and current task preserved, so that changing language does not discard work.
22. As a user switching during a pending or failed operation, I want meaningful progress and recovery text in the new language, so that I can continue without repeating the operation.
23. As a user, I want loading, empty, unavailable, expired, and terminal states translated, so that exceptional paths remain understandable.
24. As a seller, I want order review, payment matching, corrections, and exceptions in my language, so that I can make informed decisions.
25. As a seller, I want confirmation wording to distinguish seller acceptance from independent provider verification, so that the interface does not overstate payment certainty.
26. As a seller, I want courier drafts, review blockers, submission outcomes, and reconciliation instructions translated, so that I understand whether a booking exists and what action is safe.
27. As a user reviewing an older failure, I want known historical errors explained in my current language, so that changing language also helps with existing records.
28. As a buyer, I want my name, address, and messages preserved exactly, so that translation does not change delivery or contact details.
29. As a seller, I want product names and other submitted content preserved, so that the interface does not silently rewrite shop data.
30. As a user choosing a delivery location, I want authoritative provider names preserved with translated field labels, so that I can select a valid location without fabricated translations.
31. As a user, I want amounts, phone numbers, and identifiers shown with 0-9 digits, so that I can compare them with payment and courier records.
32. As a user entering Bengali digits into numeric fields, I want them accepted and normalized safely, so that my keyboard does not prevent completing the task.
33. As a user viewing dates, I want localized month names and unambiguous Gregorian dates, so that I do not confuse day and month.
34. As a user viewing a timestamp, I want Bangladesh time, so that deadlines and recorded events are understandable locally.
35. As a buyer using optional address assistance, I want generated explanations in my chosen language, so that I can understand suggestions without changing the extracted address.
36. As a user switching after receiving AI assistance, I want no repeat AI call, so that switching does not create extra requests or change a recorded result.
37. As a user viewing saved generated text without a translation, I want a localized explanation and an explicit way to view the original, so that its language limitation is clear.
38. As a seller copying a delivery summary, I want its labels and instructions in my chosen language, so that the human-readable message matches my intended audience.
39. As a seller exporting CSV, I want stable English headers, status codes, and original data, so that existing spreadsheet workflows continue to work.
40. As a seller downloading CSV in Bengali mode, I want a clear label identifying the English CSV, so that its format is expected.
41. As a user following an external payment or courier link, I want guidance in my language before leaving, so that I understand the next step even if the external site uses another language.
42. As a screen-reader user, I want document language, control names, errors, and announcements to match the selected language, so that the experience is usable beyond visible labels.
43. As a phone user reading Bengali, I want legible fonts and controls that accommodate longer text, so that content remains readable without clipping or obstructed actions.
44. As a user, I want language switching to preserve payment, order, and courier state, so that it never repeats a submission or changes evidence.
45. As a maintainer, I want missing translations detected before release, so that new features do not reintroduce inconsistent language.
46. As a product owner, I want to review remaining Bengali and English business vocabulary before release, so that wording retains the agreed business meaning.
47. As a user, I want localized failure guidance when an error is unfamiliar, so that raw provider or technical messages do not become the only explanation.

## Implementation Decisions

- Introduce shared locale selection and a consistent translation catalog across
  both buyer and seller rendering entry paths, including the path that bypasses
  seller authentication. Use the existing feature boundaries rather than creating
  separate translated versions of each screen.
- Keep locale as presentation state. Explicit device preference takes priority
  over browser preference; account synchronization and seller-selected shared-link
  language are excluded. Language selection must not depend on a successful login.
- Replace inline bilingual owned copy with selected-language copy. Include titles,
  navigation, form help, statuses, validation, loading/empty states, alerts, accessible
  names, copy/download feedback, and existing user-facing automated explanations.
- Use standard Bangladeshi Bengali with familiar terms such as অর্ডার and ডেলিভারি.
  Preserve developer logs and internal engineering documentation in English.
- Use the approved business vocabulary: delivery advance is ডেলিভারির আগে অগ্রিম;
  remaining COD balance is ডেলিভারির সময় বাকি পরিশোধ; confirmed order is নিশ্চিত
  করা অর্ডার; buyer payment proof is ক্রেতার দেওয়া পেমেন্টের তথ্য; courier draft
  is কুরিয়ার অনুরোধের খসড়া. Review remaining vocabulary with the owner before release.
- Preserve glossary semantics. Buyer payment proof is a claim; payment matching
  and order confirmation do not independently establish provider-verified receipt.
  A courier draft is not a Pathao booking, and localization does not enable booking
  or bypass existing eligibility, review, or reconciliation gates.
- Preserve original user-written names, product text, addresses, and messages,
  plus opaque identifiers, provider names, and brands. Translate labels and
  explanations around them; use parenthetical English terms when useful, such as
  ট্রানজেকশন আইডি (TrxID). Never infer that preserved English data permits leaving
  its payment or delivery instructions untranslated.
- Keep authoritative Pathao location names and IDs intact. The current catalog
  has one supplied name per location; bilingual aliases are not part of this scope.
- Use 0-9 output digits for money, phone numbers, and identifiers. Accept Bengali
  digit input at numeric boundaries without rewriting arbitrary text or opaque
  identifiers. Preserve existing monetary precision and validation semantics.
- Use localized Gregorian month names, unambiguous dates, and Bangladesh time for
  timestamps. Presentation must not change stored instants or expiry behavior.
- Prefer stable domain/error codes and structured parameters for localized
  presentation, including field validation and persisted courier failures. Do not
  make English message matching the primary contract. Inventory old records and
  provide localized safe guidance for unmapped errors while preserving evidence.
- Preserve existing business API payloads, status codes, authorization, and replay
  guarantees. Add narrowly scoped typed presentation metadata only where existing
  codes or parameters cannot support the agreed behavior; this is not an API rewrite.
- Generated explanations should use the language selected when assistance is
  explicitly requested. Keep extracted address data separate from presentation.
  Changing language must not re-run assistance, change its recorded extraction,
  alter idempotency meaning, or submit buyer data. Previously saved generated text
  without a translation uses a localized explanation and optional original display.
- Preserve form state, navigation context, validation meaning, and pending/failed
  operations when language changes. A language switch causes no payment, order,
  courier, or AI side effects and must not bypass existing explicit opt-in controls.
- Translate human-readable copied summary labels, lifecycle explanations, and
  purpose text while preserving inserted business data. Keep CSV English headers,
  stable lifecycle values, decimal values, original Unicode data, quoting, and
  formula-injection protections unchanged. Identify CSV as English in both locales.
- Include embedded Clerk authentication and recovery/error paths through supported
  localization resources. Installed types permit custom resources; complete Bengali
  coverage and real-session behavior require verification, not an assumption.
- External payment/courier websites retain their own language. Provide localized
  guidance before leaving the application; do not promise control over those sites.
- Scope notifications to existing owned user-facing messages. No application
  outbound notification service was found during source inspection; adding SMS,
  email, WhatsApp, or another delivery channel is not required by this feature.
- Update document language, accessible labels, announcements, Bengali font support,
  and responsive layouts with the selected locale. Do not duplicate all labels or
  rely on color alone to convey status.
- No account-locale database field or bulk translation of stored records is needed.
  Any necessary schema/API adjustment must preserve historical evidence and replay
  behavior and be justified by a concrete acceptance case.

## Testing Decisions

- The owner confirmed existing rendered buyer/seller journeys as the primary
  behavioral seam, with existing backend request tests for replay, error-code,
  and CSV guarantees. Prefer these over new translation-only service boundaries.
- Good tests assert observable content, accessible names, preserved values,
  operation outcomes, and request counts where non-repetition is the contract.
  Do not test hook internals, catalog implementation, component structure, or use
  broad snapshots that lose the existing domain assertions.
- Extend existing React DOM/Vitest tests for the buyer portal, address assistance,
  seller workspace, parcel validation, courier workflows, and copied/exported
  summaries. These already render feature roots and exercise user interactions
  with controlled HTTP responses; retain meaningful lifecycle and failure checks.
- Cover browser-derived initialization, explicit override, reload persistence,
  both rendering entry paths, and independence from the seller's shared-link choice.
- Exercise both locales in representative success, loading, empty, validation,
  unavailable, expired, correction, terminal, and retry states. Verify translated
  field errors and first-invalid focus without weakening existing assertions.
- Switch languages during a populated form, pending operation, failure, saved
  AI review, and courier outcome. Assert preserved values/state and no additional
  AI/payment/courier mutation requests or repeated booking attempts.
- Extend existing FastAPI/httpx address-assistance request tests and replay/provider
  doubles to verify explicit opt-in, stable stored results, no repeated provider
  call, and unchanged buyer lifecycle. Use existing courier replay/failure coverage
  to prove error presentation changes preserve booking and reconciliation contracts.
- Preserve existing authenticated CSV request-test assertions for headers, ASCII
  decimal amounts, shop isolation, Unicode data, filtering, quoting, and formula
  protection. Test localized copied summaries at the rendered UI boundary separately.
- Add translation-completeness checks for required keys and interpolation parity;
  supplement them with behavior tests because matching keys alone do not prove
  coverage of hardcoded copy, correct Bengali wording, or business meaning.
- Perform phone-browser acceptance in Bengali and English for readable typography,
  wrapping, control access, keyboard focus, document language, announcements, and
  no lost input. Include real embedded sign-in and recovery/error paths; mocked
  components cannot establish Clerk localization completeness.
- Review remaining bilingual business vocabulary with the owner before release.
  Treat missing owned copy or unverified required browser paths as incomplete
  localization and report the exact gap rather than claiming full acceptance.
- Use focused repository test wrappers per bounded feature cluster. Run the root
  check command as the final implementation gate; it covers tooling, lint, strict
  types, tests, build, and HTTP smoke. Separate local success from browser, hosted,
  authentication-provider, and live-provider acceptance evidence.

## Out of Scope

- Regional Bengali dialects, romanized Banglish as a separate locale, and additional
  languages beyond Bengali and English.
- Automatic translation or transliteration of submitted names, product descriptions,
  addresses, buyer messages, historical evidence, or authoritative location names.
- Bengali output digits for crucial numeric details, a Bengali calendar, or changes
  to monetary arithmetic, stored timestamps, expiry, or identifier formats.
- Account-level language synchronization, cross-device preference merging, and
  forcing recipients to use the language of a seller's shared link.
- Localized CSV headers/status codes or changes to the export data contract.
- Re-running AI requests to translate saved responses, weakening explicit AI opt-in,
  or changing replay semantics solely because presentation language changed.
- Translating developer logs/internal engineering documentation, redesigning the
  developer demo, or adding outbound notification infrastructure.
- Controlling external provider-site language, introducing new courier/payment
  operations, deploying the application, or claiming live-provider readiness.

## Further Notes

The specification synthesizes the accepted interview decisions Q1-Q15 and the
owner's confirmation of the test boundaries. Existing source inspection found no
shared locale framework and identified stored English presentation text as a
compatibility concern; implementation must verify the current owning code rather
than assume a label-only replacement is sufficient.

Implement in bounded clusters: shared locale foundation; buyer flows; seller and
copied-summary flows; persisted/generated/authentication messages; then vocabulary
review and browser acceptance. Keep existing manual and offline fallback paths
working throughout. Choose any translation-library dependency based on current
compatibility; no particular library was selected during the design interview.

This is a published specification, not an implementation or verification claim.
