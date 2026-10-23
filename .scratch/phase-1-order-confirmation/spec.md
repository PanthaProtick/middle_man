# Phase 1: F-commerce order confirmation

Status: ready-for-agent
Date: 2026-10-23
Scope: implementation specification, not implementation or launch acceptance.

The user approved the shared design and requested this specification. The API-first
test seam, real-database allocation tests and browser acceptance flows were explicitly
confirmed. Launch gates remain binding even though the implementation spec is ready.

## Problem Statement

Sellers closing sales through chat must collect delivery details, read payment
screenshots, compare transaction references with received-payment SMS and calculate
the remaining COD amount manually. Chat records make pending orders and corrections
hard to track. Buyers need a short mobile flow without installing an app.

The primary outcome is less total seller handling time, not a promise to eliminate
fraud or COD returns. Start with sellers already collecting advances and one
confirmation operator per shop.

## Solution

The seller creates an order link with fixed agreed terms. The buyer supplies contact,
address and payment details, with optional screenshot upload and optional Gemini
assistance. A separate payment sender number supports relatives paying for buyers.
The seller imports SMS or enters received-payment details from the payment app.
Deterministic, shop-isolated checks confirm qualifying matches automatically; sellers
resolve exceptions with recorded reasons. The same link provides buyer status.

Confirmation means seller acceptance backed by seller-supplied payment evidence.
It is not independent payment-provider verification. AI only assists data entry.

## User Stories

1. As a seller, I want an authenticated shop workspace, so that only I can manage my orders.
2. As a seller, I want my records isolated from other shops, so that another shop cannot affect my checking.
3. As a seller, I want labelled bKash/Nagad receiving accounts, so that each order names its intended destination.
4. As a seller, I want to create an order after agreeing in chat, so that the conversation stays human.
5. As a seller, I want to enter the final total including agreed delivery charges, so that the balance is correct.
6. As a seller, I want a unique shareable link, so that I can collect details for that specific order.
7. As a buyer, I want to see the shop, item, total, advance and receiving number, so that I know what I am paying.
8. As a buyer, I want to copy the receiving number, so that I can pay through my payment app.
9. As a buyer, I want a mobile browser form without account creation, so that completing an order is simple.
10. As a buyer, I want to enter my contact number separately from the payment sender number, so that someone else can pay.
11. As a buyer, I want to provide and review a complete address, so that the seller receives readable delivery details.
12. As a buyer, I want to enter payment details without a screenshot, so that upload problems do not block submission.
13. As a buyer, I want optional screenshot extraction, so that I can avoid typing visible payment details.
14. As a buyer, I want optional address structuring, so that I can review a clearer version of my address.
15. As a buyer, I want to understand what goes to Gemini before choosing assistance, so that processing is deliberate.
16. As a buyer, I want to correct AI suggestions before submission, so that guesses do not become my claim silently.
17. As a buyer, I want manual entry during AI failure, so that the order can still proceed.
18. As a buyer, I want clear submission success or failure, so that I do not mistake an unsaved form for a saved order.
19. As a buyer, I want the same link to show pending or confirmed status, so that I can check progress.
20. As a seller, I want single or bulk SMS paste for a selected receiving account, so that I can reconcile efficiently.
21. As a seller, I want manual entry from the payment app, so that unsupported SMS does not stop my work.
22. As a seller, I want visible parse failures, so that missing fields cannot silently approve orders.
23. As a seller, I want payment records imported before or after buyer submission, so that arrival order does not matter.
24. As a seller, I want both TrxID and sender checked, so that contact information is not mistaken for payment evidence.
25. As a seller, I want provider, receiving account, amount and time checked, so that incomplete matches need review.
26. As a seller, I want qualifying matches confirmed automatically, so that I do not repeat routine approval work.
27. As a seller, I want duplicate SMS to remain one received payment, so that repeated paste cannot create extra funds.
28. As a seller, I want conflicting records held for review, so that later data cannot silently overwrite accepted evidence.
29. As a seller, I want each received transaction usable once, so that two orders cannot consume the same advance.
30. As a seller, I want competing claims shown without first-submitter preference, so that I can resolve ambiguity.
31. As a seller, I want later claims held without reversing an existing confirmation, so that a new claim cannot disrupt an accepted order.
32. As a seller, I want manual acceptance with a transaction record and reason, so that legitimate exceptions can proceed visibly.
33. As a seller, I want to accept an underpayment or overpayment explicitly, so that the actual remaining COD is shown.
34. As a seller, I want excessive payments held for external resolution, so that the portal does not invent credit or refunds.
35. As a seller, I want to correct pending buyer information through the same portal, so that a typo can be checked again.
36. As a seller, I want to correct confirmed delivery details with history, so that the portal reflects agreed corrections.
37. As a seller, I want accepted payment details and commercial terms locked, so that edits cannot change the accepted deal silently.
38. As a seller, I want unused links to expire after 48 hours, so that abandoned links do not remain actionable indefinitely.
39. As a buyer, I want submitted orders never to expire automatically, so that seller delay does not erase my submission.
40. As a seller, I want explicit cancellation and rejection, so that unresolved orders can receive a deliberate outcome.
41. As a seller, I want replacement orders linked to the original agreement, so that changed deals are traceable.
42. As a seller, I want copy and CSV export of order summaries, so that I can carry out delivery work manually.
43. As a seller, I want portal edits distinguished from courier updates, so that I do not assume a booking changed.
44. As a user, I want stated retention periods enforced, so that raw payment evidence is not kept forever.
45. As a seller, I want evidence deletion not to release used payments, so that retention cannot defeat duplicate controls.
46. As a pilot operator, I want whole-workflow timing and buyer completion measurements, so that success reflects real effort saved.

## Implementation Decisions

### Boundaries and stack

- Keep the current React/Vite strict TypeScript frontend and typed FastAPI/Pydantic
  backend. Do not switch frameworks based on historical suggestions in the idea.
- Use relational PostgreSQL persistence for product records and atomic constraints.
  Existing database and Clerk configuration are scaffolding, not working features.
- Separate shop identity/authorization, order lifecycle, received-payment ingestion,
  reconciliation, evidence/AI assistance and retention by responsibility. Keep the
  application service behind the FastAPI boundary; avoid public test-only endpoints.
- Frontend feature slices own their UI, hooks, types and tests. Product write failures
  must never fall back to fabricated records or client-generated confirmations.
- Credential-free development remains supported through explicit test/demo adapters.
  Such adapters must never masquerade as durable or authenticated pilot operation.

### Normative contract documents

- [Domain, state and persistence](domain-contract.md): entities, constraints,
  transaction identity, atomic allocation, transitions, edits and retention.
- [API and UI contract](api-contract.md): operations, field shapes, error semantics,
  retries, permissions, public-access gate, upload/AI behavior and screen states.
- [Acceptance and verification](acceptance.md): traceable cases, test seams and
  evidence required at implementation, browser, provider and pilot levels.

These annexes are normative parts of this spec. Concrete endpoint names and technical
defaults in them are specification choices, not claims of existing implementation.
Equivalent internal decomposition is allowed; observable behavior must remain intact.

### Core rules

- One operator owns one shop for the pilot; all lookups and constraints are scoped.
- Treat buyer claims, seller receipt evidence, accepted allocation and order status
  as distinct concepts. A buyer claim cannot reserve a transaction.
- Automatic acceptance requires matching TrxID, full payment sender, provider,
  receiving account, exact advance and clear seller-side time within the agreed
  interval, with no conflict and no prior use.
- Match on either arrival order, and make allocation plus confirmation atomic.
- Seller review can accept amount/sender/time exceptions with a recorded reason,
  but cannot bypass shop ownership, evidence presence, single use or the total cap.
- Remaining COD uses the actual accepted advance against the fixed final total.
- Screenshots are optional. Gemini use is buyer-selected and unavailable output
  returns to manual entry. SMS parsing is deterministic with manual fallback only.
- Expiry applies solely before first completed submission. Corrections are seller
  assisted; there is no buyer rejection/resubmission loop or three-attempt workflow.
- Confirmed delivery-detail edits do not alter allocation, commercial terms or any
  courier booking. Payment reassignment is outside the generic edit interface.

## Testing Decisions

- The user confirmed FastAPI endpoints as the main behavior seam. Assert responses
  and durable observable outcomes, not private helper calls or implementation order.
- Existing async HTTPX/ASGI route and validation tests are prior art. Existing frontend
  fetch tests are prior art for explicit transport doubles, not for fake product success.
- Use a disposable real PostgreSQL instance for schema, rollback, persistence,
  concurrent allocation, idempotency and retention integration tests. In-memory or
  SQLite passes cannot establish PostgreSQL concurrency guarantees.
- Use frontend component/client tests for payloads, validation, loading, stale writes,
  errors and manual AI fallback; use actual browsers for end-to-end mobile flows.
- Test external AI/auth services through adapters offline, then exercise configured
  providers separately before claiming provider acceptance. Root checks stay offline.
- Preserve existing meaningful assertions and unrelated starter behavior. Run focused
  tests during changes and root `npm run check` before completing code/tooling work.
- Full acceptance IDs and distinct evidence levels are in the acceptance annex.

## Out of Scope

- Courier booking, courier location codes, automated delivery updates and courier prices.
- Cross-shop transaction matching, shared-account workflows, buyer reputation and risk scores.
- Seller teams, bots, SMS forwarders, buyer notifications and native apps.
- Processing money, refunds, customer credit, payment splitting and multi-order allocation.
- Automatic approval based on screenshots, AI confidence, suffix-only sender matching,
  or a buyer-submitted TrxID that lacks seller-side evidence.
- Direct payment-provider verification, business pricing and broad analytics dashboards.
- Implementing deferred buyer identity/link-access or account-deletion policy by assumption.

## Further Notes

- Approved product context: [shared design](../../docs/phase-1-design.md),
  [glossary](../../GLOSSARY.md), [evidence ADR](../../docs/adr/0001-seller-supplied-payment-evidence.md)
  and [interview record](../../tasks/phase-1-design.md).
- The original idea remains historical where it conflicts with these decisions.
- Public buyer identity/link-access and account-deletion policy are explicit launch
  gates. Build/test their interfaces without silently selecting an authentication policy.
- Seller authentication must be enforced, not inferred from a configuration flag.
  Exact provider wiring and deployment target require fresh implementation evidence.
- Official bKash receipt examples exist, but comprehensive format coverage and full
  sender availability are unproven; official Nagad templates were not established.
  Missing/ambiguous fields remain review cases until representative samples pass.
- Retention periods are agreed product choices, not verified legal requirements.
  Provider data terms and applicable obligations require review before real-data use.
- Pilot success requires repeated use and lower total seller handling time against an
  observed baseline. Set a numerical saving target after baseline measurement and
  track buyer completion. Match rate alone cannot establish product success.
- This task produces a local specification only: no implementation tickets, database
  migrations, external publication, deployment or application changes are authorized here.
