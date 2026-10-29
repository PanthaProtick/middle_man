# Replace address AI with a seller review assistant

Status: ready-for-agent
Date: 2026-10-30
Scope: private development, synthetic data, free Gemini API; no product launch.
Baseline inspected: f36753e49fc6befaa34f7ebca873cbabd6d70757.

## Problem Statement

Buyers should enter their delivery details manually using Pathao's destination
hierarchy rather than ask Gemini to parse addresses. Sellers instead need help
understanding why a buyer submission remains Pending Review and what they can do
next. Existing reason labels do not explain combined issues, missing receipts,
or prior decisions sufficiently for this purpose.

The assistant must use only the authenticated seller's relevant records, disclose
minimal facts externally, preserve payment integrity, and avoid exhausting free
API quota during development. The current project is private and uses synthetic
orders and payment records; production security infrastructure is not required.

## Solution

Remove address AI completely and require supported Pathao destination choices
when available, alongside a manually written street/house/landmark address.
Preserve submissions during catalog outages or unsupported coverage, with an
explicit need for seller resolution before courier submission.

Add an on-demand Ask AI button to each pending buyer submission. Show a concise
explanation, ordered suggested next steps, and links to existing corrective
controls in the selected language. The backend supplies authoritative findings
and permitted actions; Gemini provides wording, not payment decisions. Local
explanations remain available when live generation is disabled or unavailable.

Live generation is off by default, uses free Gemini only with synthetic data,
and is strictly limited. Automated tests never contact Gemini.

## User Stories

1. As a buyer, I want to select a Pathao city, zone, and supported area, so that my destination is recorded in the courier's hierarchy.
2. As a buyer, I want to enter street, house, and landmark details myself, so that my written address remains under my control.
3. As a buyer, I want address entry without AI controls or consent prompts, so that submitting details does not send my address to Gemini.
4. As a buyer, I want dependent location choices to reset when I change their parent, so that I cannot accidentally submit an inconsistent hierarchy.
5. As a buyer, I want missing available destination choices identified before acceptance, so that I can complete the required location details.
6. As a buyer, I want to submit my written address and payment claim during a catalog outage, so that a provider failure does not discard my submission.
7. As a buyer, I want to identify unsupported coverage or an unavailable area choice, so that the seller can resolve delivery without fabricated selections.
8. As a buyer, I want retrying my submission to preserve its identity, so that retries do not create duplicate submissions or fresh provider work.
9. As a seller, I want Ask AI on every pending buyer submission, so that assistance is available even without a stored review code.
10. As a seller, I want no review-assistant generation for completed or awaiting-buyer orders, so that assistance applies to unresolved submissions.
11. As a seller, I want combined review reasons explained together, so that I understand the issue as a whole.
12. As a seller, I want a missing or different payment sender explained without sending phone numbers externally, so that the issue is understandable with less disclosure.
13. As a seller, I want required, claimed, and received amounts compared, so that I can understand an advance mismatch.
14. As a seller, I want missing or out-of-window payment timing explained, so that I know what timing information needs review.
15. As a seller, I want a receiving-account mismatch explained, so that I can inspect the appropriate account locally.
16. As a seller, I want conflicting seller transaction records identified, so that I can resolve evidence before accepting payment.
17. As a seller, I want competing claims explained using counts rather than other buyers' identities, so that related context remains minimal.
18. As a seller, I want a claim held by an earlier resolution distinguished from active competition, so that I am not given a misleading explanation.
19. As a seller, I want an already-used payment explained, so that I do not reuse a payment to confirm another order.
20. As a seller, I want a missing matching seller transaction record distinguished from a mismatch, so that absence is not presented as evidence of an error.
21. As a seller, I want an unknown pending cause acknowledged honestly, so that the assistant does not invent facts.
22. As a seller, I want assistance with my selected receipt's manual acceptance preview, so that provider, transaction-ID, and order-total problems are understandable.
23. As a seller, I want hard acceptance blockers preserved, so that AI suggestions cannot bypass payment integrity rules.
24. As a seller, I want suggestions linked to existing controls, so that I can act without granting the model authority to change records.
25. As a seller, I want explanations in my selected Bengali or English locale, so that I can understand the next step comfortably.
26. As a seller, I want changing language to avoid automatic generation, so that a presentation change does not consume quota.
27. As a seller, I want assistance based only on my shop's records, so that another seller's information cannot be accessed.
28. As a seller, I want names, addresses, phone numbers, transaction IDs, raw SMS, and notes excluded from Gemini requests, so that disclosure is minimized.
29. As a seller, I want the assistant to explain rather than approve payments or book couriers, so that decisions remain mine.
30. As a seller, I want advice invalidated when relevant facts change, so that I do not act on an outdated explanation.
31. As a seller, I want a late response discarded after a review changes, so that obsolete advice does not replace current information.
32. As a seller, I want local explanations when Gemini fails or is disabled, so that reviewing orders remains possible offline.
33. As a seller, I want repeated opening of an unchanged explanation to reuse the current view's result, so that it does not consume another request.
34. As a seller, I want duplicate clicks prevented while generation is running, so that they do not cause duplicate calls.
35. As a developer, I want live generation disabled by default, so that ordinary development cannot accidentally consume free quota.
36. As a developer, I want automated tests to use fake providers, so that all regression tests consume zero live requests.
37. As a developer, I want a small shared daily limit and a minimum interval between calls, so that synthetic testing does not exhaust my free allowance.
38. As a developer, I want failed attempts to count and retries to be explicit, so that outages cannot create a request storm.
39. As a developer, I want a single optional manual smoke test, so that I can inspect real output without a batch of live calls.
40. As a developer, I want public demo routes to remain mock-only, so that they cannot bypass seller assistant limits.
41. As a seller, I want no saved assistant conversation or prompt/response history, so that the feature does not create another store of review content.
42. As a seller, I want historical address AI copies and suggestions erased while submitted addresses remain intact, so that retirement does not damage orders.
43. As a developer, I want cleanup and retention tools to work after retirement, so that removing address AI does not break unrelated maintenance.

## Implementation Decisions

- This is an accepted design for later implementation. Publishing the spec does
  not start implementation or authorize live provider testing.
- Preserve the domain distinction between buyer payment claims, seller transaction
  records, payment matches, and seller acceptance. AI never establishes independent
  payment-provider verification or changes order state.
- Reuse existing seller authentication, shop ownership lookup, order access,
  receipt comparison, manual acceptance preview, and deterministic reconciliation.
  Derive the shop from authenticated identity; do not trust client-supplied shop
  IDs, review findings, prompt text, or allowed actions.
- Add a seller-authenticated, on-demand review-assistance interface accepting the
  target order, selected language, and optionally a selected receipt. A selected
  receipt must belong to the same shop. Only pending buyer submissions qualify;
  wrong-shop resources must not reveal existence or content.
- Keep the review context builder behind that interface. It produces a typed,
  reason-specific outbound allowlist, authoritative pending condition, and permitted
  actions. Do not serialize full order, receipt, revision, history, or ORM objects.
- Use the current facts for one review and only directly related same-shop records.
  Related claims contribute aggregate facts, not other buyers' personal details.
- Build context even when stored reason codes are empty. No matching receipt means
  no recorded match; it does not prove payment was never made. Unknown causes stay
  unknown. Unknown codes receive a safe generic explanation and no invented remedy.
- The following table defines minimum facts, included only when applicable.

| Condition | Facts allowed for explanation |
| --- | --- |
| SENDER_MISMATCH | Sender missing versus different; no sender numbers |
| AMOUNT_MISMATCH | Required advance, claimed and received amounts, currency |
| TIME_UNCLEAR | Missing time, before order creation, or after claim submission; no exact timestamps needed |
| WRONG_RECEIVING_ACCOUNT | Account comparison result; no account IDs or numbers |
| CONFLICTING_RECEIPTS | Conflict flag and reliably established conflicting field categories |
| COMPETING_CLAIMS | Active claim count and whether this claim is held by prior resolution |
| PAYMENT_USED | Used or allocated status; no other order's identity |
| PROVIDER_MISMATCH | Provider comparison result from the authorized selected preview |
| TRANSACTION_ID_MISMATCH | Selected-preview mismatch result; no actual transaction IDs |
| PAYMENT_EXCEEDS_TOTAL | Selected-preview receipt amount, order total, currency |
| Uncoded pending submission | Backend-established missing-receipt or unknown condition |

- The first seven codes arise in automatic reconciliation. The next three come
  from a selected receipt's manual acceptance preview; do not treat them as stored
  automatic review reasons or select a receipt on the seller's behalf.
- Common outbound context is applicable codes, minimal facts, selected locale,
  and backend-established permitted actions. Exclude names, contact/payment phone
  numbers, addresses, transaction IDs, raw SMS, credentials, account/shop/order IDs,
  free-text notes, product descriptions, and unrelated history. Keep actual navigation
  links and record identifiers inside the application.
- Expose a typed explanation and suggested-action response with a distinction
  between generated and local fallback text. Validate model output; it cannot
  introduce action identifiers or links outside the backend-established list.
  No model tools, browsing, follow-up chat, or direct mutations.
- Preserve existing hard blockers: used payments, competing claims, conflicting
  receipts, mismatched transaction IDs, and receipts exceeding the order total
  cannot become an AI-assisted bypass of acceptance rules.
- Snapshot context without holding order/payment locks across generation. Bind
  advice to relevant order, buyer revision, receipt, and resolution facts. Recheck
  freshness before delivery; discard stale provider output without automatic
  regeneration. Changes to lifecycle or selected receipt also invalidate advice.
- Reuse explanations only in the current view and only for unchanged authorized
  context. Revalidation must not call Gemini. Discard view state on order/shop
  changes or sign-out. Do not persist outputs in browser storage or server caches.
- Follow the selected Bengali/English locale without translating business data.
  A locale change makes no automatic provider call; use local translated guidance
  until a seller explicitly requests generation in that language.
- Timeouts, provider rejection, quota exhaustion, malformed/oversized output,
  unavailable credentials, offline mode, and disabled AI produce useful local
  explanations. Keep existing corrective controls usable; disclose fallback status.
- Live generation requires explicit enablement; credentials alone cannot activate
  it. Preserve the existing self-test override, which prevents all live AI calls.
  Use a short bounded request deadline and output size; never log provider bodies.
- Default to five live attempts per Asia/Dhaka calendar day across the entire
  application and at most one attempt per minute. Apply configurable shop limits
  inside the shared application ceiling and five attempts per unchanged review
  context. Reserve attempts before dispatch; failures consume attempts.
- Permit only one in-flight generation per review, including concurrent requests.
  No automatic retries or alternate-model fallback requests. Reusing a view result
  or serving a deterministic explanation consumes no live attempt.
- The current deployment is a single backend process. In-memory counters and their
  reset on restart are accepted; these are application-session controls, not a
  guarantee about Google's account-wide remaining quota. Provider/model free-tier
  limits may be lower, so provider quota responses must also stop generation safely.
- Keep only bounded, content-free counters/failure metadata needed for this scope.
  Do not add durable counter storage, seven-day history, or prompt/response logs.
- Public chat and idea-generation demonstrations become permanently mock-only,
  even with configured Gemini credentials. Retain shared Gemini settings required
  by the review assistant; remove address-specific behavior and obsolete controls.
- Fully remove the address AI UI, public extraction route, models/provider service,
  availability signal, and extraction-only dependencies. Retire old clients safely;
  no remaining runtime route may perform address extraction.
- A forward migration erases historical address AI requests, responses, replay
  results, and generated suggestions. Preserve buyer-confirmed address revisions,
  order/payment state, allocations, and duplicate-payment protection. Do not rewrite
  historical migrations. Update retention, cleanup, schema readiness, and maintenance
  consumers so none require the retired extraction store.
- Require supported Pathao city/zone/area choices when catalog choices exist; validate
  parent membership server-side. Invalid known IDs remain errors. Empty catalogs,
  no-area zones, disconnection, outages, or unsupported coverage preserve the written
  address and payment claim with explicit seller-resolution state. Do not fabricate
  IDs, infer support from empty lists, or authorize courier submission from fallback.
- Preserve submission idempotency and already accepted replay semantics. Removing
  address parsing does not weaken existing courier readiness or booking safeguards.

## Testing Decisions

- User-confirmed primary seam: seller/buyer HTTP flows with a fake Gemini provider.
  Test externally observable responses, ownership, payload disclosure, and unchanged
  business records rather than private helper calls or internal module structure.
- Additional necessary boundaries are rendered React interactions and a forward
  migration test. These cover behavior an HTTP-only suite cannot establish: button
  accessibility/view state and actual historical-data removal.
- Prior art: existing public-order route tests, seller decision guards, receipt
  comparison and manual-preview tests, Pathao catalog/outage tests, seller payment
  exception UI tests, bilingual rendered tests, and PostgreSQL retention tests.
- Cover every condition in the table, combinations, held claims versus active
  competition, uncoded no-receipt states, unknown causes/codes, and selected-preview
  blockers. Assert advice neither mutates records nor offers forbidden actions.
- Capture fake-provider requests and assert the exact allowlist. Seed conspicuous
  personal data in the order and related records and prove it never reaches the
  outbound request. Test unauthenticated, wrong-shop, wrong-receipt, retained, and
  nonpending access without invoking the provider.
- Control time and provider completion deterministically. Cover duplicate clicks,
  concurrent requests, five-attempt context and shared daily limits, minute spacing,
  failures counting, Dhaka day rollover, explicit enablement, self-test override,
  disabled credentials, stale responses, and no automatic retry after HTTP 429.
- Render pending eligibility, selected receipt changes, locale changes, generated
  versus fallback text, usable corrective links, sign-out/order changes, and current
  view reuse. Merely opening a view or switching language must not invoke Gemini.
- Test required available Pathao choices, parent resets, forged IDs, unsupported
  coverage, empty city/zone/area lists, outages, and safe idempotent submission replay.
- Seed historical AI records and buyer-confirmed addresses before the migration;
  prove AI copies/suggestions are gone and address/payment records and remaining
  retention operations still work. Reapplying supported cleanup must be safe.
- Automated suites have zero external Gemini calls, including when developers have
  credentials locally. Use fake providers or intercepted transport and retain the
  existing network prohibition; never launch concurrent live-provider tests.
- Run focused tests after each implementation cluster, then the root check command
  as the final code gate. Local tests/HTTP smoke do not prove browser or live service
  behavior; report those acceptance results separately.
- Live verification is optional and manual. Only after an explicit request, enable
  generation and try one synthetic review first. Do not batch cases, run live tests
  during ordinary verification, or silently retry a failed attempt.

## Out of Scope

- Implementation during this specification-only request or automatic ticket creation.
- Product launch, real customer/business data, paid Gemini, Vertex AI, guaranteed
  provider zero retention, multiworker deployment, and durable distributed quotas.
- AI address parsing, payment verification, approvals, edits, review resolution,
  automatic receipt selection, courier booking, general chat, or seller-wide search.
- Persistent assistant conversations/content caches, raw evidence uploads, and
  public live Gemini demonstrations.
- Changing payment matching, accepting otherwise blocked receipts, establishing
  live Pathao readiness, or rewriting historical migration/decision records.

## Further Notes

The user confirmed the complete design and conservative request defaults, then
explicitly requested specification only. No application code changed. The attempted
implementation patch was rejected before application. No live Gemini calls occurred.

Free-service use is an intentional private-development trade-off. Google may use
free-service inputs/outputs for improvement and human review; tenant isolation does
not mean local processing. Provider abuse-monitoring retention is separate from the
application's decision not to store content. Revisit privacy and deployment before
using real records or launching; do not present this synthetic-only scope as readiness.

Provider terms were checked on 2026-10-30: [data-use terms](https://ai.google.dev/gemini-api/terms),
[logging/sharing policy](https://ai.google.dev/gemini-api/docs/logs-policy), and
[abuse-monitoring retention](https://ai.google.dev/gemini-api/docs/usage-policies).
No provider account, billing status, logging setting, or remaining quota was inspected.

Related decisions: [advisory data boundary](../../docs/adr/0007-review-assistant-data-and-authority-boundary.md),
[seller-supplied payment evidence](../../docs/adr/0001-seller-supplied-payment-evidence.md),
[payment screenshot retirement](../../docs/adr/0005-remove-payment-screenshots.md), and
[Bengali/English presentation](../../docs/adr/0006-bengali-english-presentation-boundary.md).
Implementation must preserve these boundaries while explicitly superseding the
remaining address-assistance behavior described by older decisions/contracts.
