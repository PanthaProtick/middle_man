# Seller-reviewed Pathao booking from confirmed orders

Status: ready-for-agent

Date: 2026-10-26

## Problem Statement

Sellers currently confirm chat-negotiated orders and collect delivery advances in Middle Man, then manually copy buyer and payment information into a courier workflow. Existing exports are manual delivery aids and do not create courier bookings. Re-entering recipient details and calculating the amount payable on delivery creates avoidable work and errors.

A confirmed order expresses seller acceptance of the order and delivery advance; it does not establish parcel readiness or independent verification by a payment provider. Immediately requesting pickup on confirmation could submit incomplete parcel details, use an incorrect COD amount, or book under the wrong seller account. Buyer corrections, cancellation, duplicate requests, and uncertain network outcomes must not silently produce incorrect or duplicate bookings.

The project owner also wants obsolete synthetic orders and associated data removed from the Neon development database. Invalidating buyer links alone does not satisfy that storage-cleanup intent.

## Solution

Automatically prepare one local courier draft whenever an order becomes confirmed, through either manual seller acceptance or automatic payment matching. The seller reviews and completes the draft, then explicitly submits it through their own connected Pathao merchant account and pickup store. Successful submission records the consignment ID and booking result.

Buyers supply their buyer contact number, detailed written address, and delivery-location selections from Pathao's city, zone, and area hierarchy. Sellers may provide parcel information while creating a buyer link or complete it during draft review. Seller defaults reduce repeated setup without guessing parcel weight or quantity.

Order collection and confirmation remain available without a courier connection or complete booking metadata. Lookup outages preserve the written address and payment claim. Unsupported or unresolved locations block Pathao submission and clearly require seller action. Courier operations never establish or undo payment acceptance.

Start with offline synthetic verification and then an actual Pathao sandbox journey. Production booking remains disabled until a separate acceptance step. Remove inventoried obsolete Neon test data through a bounded cleanup that preserves seller accounts, settings, and consumed-payment protection.

## User Stories

1. As a seller, I want both manual and automatic confirmation to prepare a courier draft, so that every confirmed order receives the same delivery workflow.
2. As a seller, I want repeated confirmation processing to retain one draft, so that retries cannot create duplicate delivery work.
3. As a seller, I want confirmation to preserve its payment meaning, so that a courier draft is never presented as independent payment verification.
4. As a seller, I want to create buyer links before connecting Pathao, so that courier setup does not delay order collection.
5. As a seller, I want missing courier details to leave an order confirmed, so that parcel preparation does not undo accepted payment decisions.
6. As a seller, I want a clear distinction between a local courier draft and a Pathao booking, so that I know whether an external delivery request exists.
7. As a seller, I want to connect my own Pathao merchant account, so that bookings and COD settlement belong to my business.
8. As a seller, I want to select a pickup store belonging to my connected account, so that parcels are collected from the correct location.
9. As a seller, I want to save a default pickup store and delivery service, so that I avoid repeating routine choices.
10. As a seller, I want to review those defaults on each draft, so that a default never hides an incorrect booking choice.
11. As a seller, I want connection credentials kept private and protected, so that buyers and other shops cannot access my merchant account.
12. As a seller, I want connection problems explained without exposing secrets, so that I can repair setup safely.
13. As a seller, I want sandbox and production connections clearly separated, so that testing cannot accidentally use a live account or store.
14. As a seller, I want to enter parcel weight and quantity while creating a buyer link, so that less work remains after confirmation.
15. As a seller, I want those parcel fields to be optional during link creation, so that I can collect an order before packaging is final.
16. As a seller, I want to complete or correct parcel details during draft review, so that the booking describes the parcel I will hand over.
17. As a seller, I want missing or invalid booking information listed clearly, so that I know exactly what prevents submission.
18. As a buyer, I want searchable city, zone, and area choices using Pathao locations, so that my delivery location can be submitted without seller remapping.
19. As a buyer, I want each location selector restricted to the selected parent, so that I cannot accidentally combine unrelated locations.
20. As a buyer, I want changing a parent location to clear incompatible child choices, so that an old selection cannot silently remain attached.
21. As a buyer, I want a usable address flow when a zone has no listed areas, so that I am not required to select a nonexistent option.
22. As a buyer, I want to provide a detailed house or street address and relevant delivery directions, so that location dropdowns do not replace the information needed to find me.
23. As a buyer, I want my delivery contact number kept separate from the payment sender number, so that the courier contacts the correct person when someone else pays.
24. As a buyer, I want location loading and lookup failures explained clearly, so that I understand why a selector is unavailable.
25. As a buyer, I want to submit my written address and payment claim during a location-service outage, so that a courier dependency cannot prevent recording payment I have already made.
26. As a buyer, I want my address and payment claim retained if Pathao cannot serve my location, so that the seller can arrange another delivery method or resolve the order with me.
27. As a seller, I want unresolved and unsupported locations to block courier submission, so that the application never substitutes an invented or nearby location.
28. As a seller, I want to complete unresolved delivery locations before booking, so that outage fallback submissions remain recoverable.
29. As a seller, I want the draft to use the latest buyer name, contact number, and address before submission, so that corrections reach the courier request.
30. As a seller, I want Pathao to collect the agreed order total minus the advance actually accepted, so that the buyer is not charged the advance twice.
31. As a seller, I want manually accepted advance exceptions reflected in COD, so that courier collection matches my actual payment decision.
32. As a seller, I want a fully paid order to request zero collection, so that prepaid deliveries remain possible.
33. As a seller, I want to review the complete recipient, pickup, parcel, service, and COD information before submission, so that I can catch errors before creating a booking.
34. As a seller, I want an explicit Submit to Pathao action, so that payment confirmation alone cannot request pickup.
35. As a seller, I want a cancelled order prevented from submitting its unbooked draft, so that an obsolete order cannot request delivery.
36. As a seller, I want stale reviews detected when an order changes, so that I must review current information before booking.
37. As a seller, I want repeated clicks, retries, and concurrent submissions protected, so that they cannot create multiple bookings for one order.
38. As a seller, I want booking attempts to survive process restarts, so that a crash cannot make an earlier submission disappear and invite a duplicate.
39. As a seller, I want clear provider rejections shown as actionable errors, so that I can correct the draft and safely try again when no booking was created.
40. As a seller, I want an accepted-but-response-lost request shown as outcome unknown, so that a timeout is not incorrectly treated as a failed booking.
41. As a seller, I want unknown outcomes to block resubmission, so that I do not accidentally request duplicate pickups.
42. As a seller, I want to attach an existing consignment after checking Pathao, so that an accepted booking can be recovered without submitting again.
43. As a seller, I want a confirmed creation failure recorded before retrying an unknown attempt, so that a temporarily empty merchant panel is not treated as proof of failure.
44. As a seller, I want courier failures to preserve my confirmed order and accepted advance, so that delivery problems do not corrupt payment history.
45. As a seller, I want the consignment ID and booking result retained and visible, so that I can continue tracking in Pathao.
46. As a seller, I want post-booking corrections and cancellation flagged for action in Pathao, so that a local edit never implies an external booking was updated.
47. As a seller, I want one booking per order in the first version, so that COD and shipment ownership remain unambiguous.
48. As a seller, I want to handle split and replacement shipments outside this version, so that the application does not pretend to allocate COD across unsupported shipment types.
49. As a seller, I want another shop prevented from reading or modifying my courier data, so that tenancy boundaries hold across drafts, settings, and consignments.
50. As a buyer-link holder, I want location choices without exposure to seller credentials or private delivery operations, so that the public flow remains appropriately limited.
51. As the project owner, I want ordinary development and automated tests to work without live courier credentials, so that offline standby behavior remains available.
52. As the project owner, I want a real sandbox booking journey after local tests, so that simulated success is not mistaken for working provider integration.
53. As the project owner, I want production booking to require separate acceptance, so that sandbox testing cannot silently turn into real pickup requests.
54. As the project owner, I want obsolete test orders and associated links, buyer data, evidence, and sensitive cached responses removed from the intended Neon development data, so that unnecessary test data does not accumulate.
55. As the project owner, I want cleanup to preserve seller accounts and settings, so that I do not have to recreate my application setup.
56. As the project owner, I want consumed-payment protections preserved during cleanup, so that deleting readable evidence cannot make an already-used payment reusable.
57. As the project owner, I want cleanup targets and results explicitly reported, so that I can distinguish requested test-data removal from unintended deletion or incomplete cleanup.
58. As a seller or buyer, I want accessible loading, validation, recovery, and submission controls on phone-sized screens, so that the new workflow remains usable in the existing application.

## Implementation Decisions

1. Preserve the existing meanings of confirmed order, delivery advance, remaining COD balance, buyer contact number, and payment sender number. Confirmation is seller acceptance, not independently authenticated proof of payment receipt.
2. Extend the shared confirmation/allocation boundary used by manual decisions and automatic reconciliation. Atomically persist the local draft or its durable creation work with successful confirmation; do not depend on a frontend event or only the manual-confirmation endpoint. Use an order-level uniqueness constraint and an equivalent offline invariant.
3. Do not contact Pathao during the payment-confirmation transaction. Missing connection settings, parcel metadata, or location data are ordinary blocked-draft conditions. External courier errors do not roll back an already committed confirmation; local transaction failures must still preserve database consistency rather than claim a successful half-write.
4. Add a shop-scoped courier connection/settings responsibility separate from bKash/Nagad receiving-payment accounts. Associate merchant credentials, environment, connection status, default pickup store, and default delivery service. Validate store membership against the selected merchant connection.
5. Keep provider secrets and tokens server-side, encrypted at rest, write-only through management contracts, and absent from logs, errors, public responses, and ordinary settings reads. Use dedicated secret-management/key material with explicit configuration failure behavior; do not reuse seller-authentication credentials or payment-protection keys as courier encryption keys.
6. Keep sandbox and production connections, stores, location data, attempts, and consignment references distinct. Development and automated tests default to an offline adapter. Production submission is disabled until separate production acceptance; a configuration flag alone does not establish readiness.
7. Extend typed order creation and draft-edit contracts with optional early parcel weight, quantity, and service information. Weight and quantity must be explicit and valid before booking. Permit reviewing and overriding saved pickup/service defaults; changing a default does not silently mutate an accepted booking.
8. Extend buyer-address contracts with Pathao city, zone, and area selections while retaining a detailed written address and optional useful delivery directions. Treat provider location identifiers as external identifiers rather than renaming district/thana text fields and assuming equivalence.
9. Provide a controlled server-side location-catalog interface for buyer selectors. Expose only location choices/availability appropriate to the buyer flow, apply existing public-admission and link-access policies, cache bounded catalog data, and never expose merchant credentials or permit arbitrary provider requests. Sellers without a connection must still be able to collect orders using available catalog data or the accepted fallback.
10. Validate city-to-zone and zone-to-area relationships on the backend. Clear incompatible children when parents change. Require an area only when applicable to the verified catalog/API contract. Do not guess location IDs, choose the first result, or substitute a nearby serviceable destination. Provide a review state for missing or unsupported coverage.
11. When location choices cannot load, allow the written address and payment claim to be saved, with an explicit unresolved-location reason. Unsupported destinations also preserve the submission and block booking. Distinguish missing data, provider unavailability, invalid submitted identifiers, and unsupported service; fallback is not permission to accept arbitrary forged identifiers.
12. Persist a draft associated with its order and owning shop, courier metadata, current readiness/blockers, version/review revision, and any booking association. Represent incomplete, ready for review/submission, submitting, definitive failure, unknown outcome, booked, and cancelled-before-booking behavior explicitly; storage names may follow existing conventions.
13. Populate the recipient from the buyer name, buyer contact number, and current delivery address. Derive COD server-side from the agreed order total minus the advance actually accepted by the seller, preserving current overpayment safeguards and zero-collection support. Keep internal money in integer minor units and convert precisely at the provider boundary; never silently truncate or round unsupported amounts.
14. Add authenticated seller operations for viewing/completing/reviewing a draft, submitting it, managing the courier connection/defaults, and reconciling an unknown outcome. Derive ownership from the seller session, use existing typed contracts/error conventions and optimistic versions/idempotency, and reject cross-shop access. Public buyer-link possession never authorizes booking or private courier management.
15. Seller submission is explicit, requires a still-confirmed, uncancelled order and complete validated metadata, and is bound to the reviewed order/buyer/draft revision and selected connection/store/environment. Serialize competing submission attempts and persist the attempt identity before making an external request. Repeated requests must observe the same protected attempt instead of producing another booking.
16. Snapshot the reviewed payload for each attempt and use a stable merchant reference for correlation. Do not assume that merchant references or local idempotency keys establish Pathao-side idempotency. Use bounded timeouts and ensure any synchronous SDK transport cannot block the application's async request handling.
17. Define the submission-versus-correction/cancellation ordering explicitly. Changes committed before submission invalidate stale review and prevent sending stale data. Once external submission is committed to an attempt/in flight, later local changes require seller reconciliation and do not imply the external operation was stopped or updated. Never hold a database transaction open across provider network calls.
18. Classify success only with a valid accepted-booking response and persisted consignment association. Definitive failures known not to have created a booking may become editable/retryable. A timeout, interrupted in-flight process, ambiguous server error, malformed success, or provider acceptance followed by local-save failure is not proof of noncreation and must remain protected as an unknown outcome.
19. Recover unknown outcomes through an authenticated, versioned seller reconciliation action. The seller checks Pathao and either associates an existing consignment or records confirmation that creation failed before a new attempt is permitted. Validate available consignment/account/environment evidence, prohibit associating one consignment to multiple orders, and record the actor, action, and safe confirmation/reference details. Absence from an immediately refreshed merchant panel is insufficient evidence.
20. Before external submission, seller delivery corrections update the draft and force fresh review where needed; cancellation makes submission unavailable. After submission, retain the accepted booking snapshot and consignment, show a mismatch/action-required notice for relevant local changes, and direct the seller to resolve changes in Pathao. Do not describe a local cancellation as cancelling courier pickup.
21. Show the draft, completion blockers, submission progress, failure/unknown recovery, and consignment result in the seller workflow. Follow existing session-loss isolation and late-response protections. Buyer forms use accessible dependent selectors and keep entered address/payment data through lookup or recoverable request failures.
22. The first version permits one booking per order and exposes its consignment ID and booking result. Ongoing delivery tracking, split shipments, replacement shipments, and automatic external amendments/cancellation are outside this feature.
23. Implement a narrow external-courier adapter for locations, merchant-store validation, booking submission, and available consignment verification. The linked community SDK is a candidate, not an approved guarantee of correctness. Audit its actual request schemas, monetary units, timeouts, token handling, logging, and POST retry behavior before adoption; the application retains ownership of its attempt ledger and safety invariants.
24. Use migrations for courier settings, address metadata, draft/attempt/booking associations, uniqueness, and reconciliation audit metadata. Preserve existing allocation/payment-marker invariants and offline behavior. Integrate newly stored buyer/delivery information with the existing evidence/structured-retention and replay-redaction responsibilities; do not retain duplicate raw provider payloads indefinitely.
25. Treat obsolete-data cleanup as a separate bounded development-data operation, not an automatic production migration or broad reset endpoint. Inventory the exact Neon project/branch, shops, records, dependent evidence, and replay/cache entries; select only confirmed obsolete synthetic data. Preserve seller accounts/settings, unrelated records, consumed-payment digests, and required minimal nonspendable receipt/tombstone references. Respect payment identity protections even though this one-time cleanup is earlier than normal age-based retention.
26. Report cleanup counts, safe failures, and remaining minimal protection records; make retries safe. Never silently switch environments or fall back to memory and report Neon deletion as successful. Removing active rows does not itself prove immediate physical disk reclamation or removal from backups, logs, or external storage version history.

## Testing Decisions

1. The user confirmed these seams: backend behavior through the existing buyer/seller HTTP API with PostgreSQL; replace only the external courier boundary for controlled outcomes; use existing buyer/seller component tests for UI behavior; then run a separate actual sandbox journey. Prefer these established seams over mocking allocation, repository, and orchestration internals independently.
2. A good test drives a seller/buyer action and asserts observable response, visible state, and durable invariants. It must detect incorrect behavior after refactoring without asserting private helper calls or implementation-specific control flow. Inspect persistent state where necessary to prove uniqueness, ownership, restart recovery, and removal of sensitive data.
3. Use the existing authenticated async API-client and PostgreSQL fixtures. Prior art includes durable-confirmation tests covering both receipt/claim arrival orders, restart and same-key replay; payment-exception tests proving accepted-advance COD; correction/cancellation tests; link-revocation privacy tests; shop-isolated export tests; and PostgreSQL structured-retention tests.
4. Through manual confirmation and automatic reconciliation, verify one draft per order, atomic local persistence, repeated delivery/reconciliation processing, both input arrival orders, and restart. Provider unavailability or missing courier metadata must not turn a committed confirmed order back into an unconfirmed one.
5. Test payload correctness using a captured provider request at the single external boundary: buyer contact versus payer number, complete address/location relationship, explicit parcel fields, selected store/service, accepted exception advances, fully prepaid zero COD, and exact conversion of money. Preserve existing rejection of overpayments rather than inventing negative COD handling.
6. Test location selectors and API validation for dependent reset, invalid parent-child combinations, zones without areas, missing catalogs, stale/unsupported choices, provider outages, cached data, and written-address fallback. Confirm payment claims remain recordable during lookup failures and unresolved/unsupported drafts cannot book.
7. Test connection management for authentication, shop/store ownership, environment separation, secret masking/write-only behavior, redacted failures, and explicit missing-key/authentication failures. Confirm unconnected sellers can still collect orders and public location lookups reveal no secret or private courier state.
8. Use real PostgreSQL concurrency/restart cases for simultaneous submit, different idempotency keys on one order, same-key replay, correction versus submission, cancellation versus submission, stale reviewed versions, process interruption, and provider acceptance followed by persistence failure. No sequence may enable a silent second booking attempt after an ambiguous first attempt.
9. At the courier boundary simulate definitive validation/authentication rejection, rate limiting, service unavailability, timeout, malformed success, accepted-but-response-lost, and success. Classify by evidence of creation rather than assuming every non-success status means retry is safe. Ensure transport configuration does not automatically replay create-order POST requests.
10. Test unknown-outcome recovery through the public seller operation: existing consignment attachment, wrong shop/environment/consignment rejection, duplicate association rejection, recorded confirmed noncreation before retry, repeated resolution requests, and attempts to bypass the unknown state through edits, reconnecting, or new idempotency keys.
11. Preserve correction and cancellation semantics on both sides of submission. Assert pre-submission updates invalidate stale review, pre-submission cancellation prevents calls, and post-submission changes retain the booking snapshot and show required external action.
12. Follow existing buyer portal/retry and seller create-order/correction/session component-test patterns. Cover optional early parcel entry, connection/defaults setup, draft blockers/review, one-click progress and duplicate-click handling, rejected/unknown outcomes, consignment display, session changes, dependent address selectors, accessible errors, and preservation of entered data.
13. Exercise the changed buyer and seller flows in a browser at phone-sized and desktop viewports, including loading, keyboard navigation, failure recovery, and submission. Component mocks and HTTP smoke do not establish actual browser acceptance.
14. Verify cleanup against a disposable PostgreSQL dataset first: explicit target isolation, dependent-row/evidence/replay removal, preserved seller settings and consumed-payment protection, invalidated old links, partial failure, repeat execution, and an unavailable database. Then inventory and verify the actual authorized Neon development cleanup separately; simulated deletion is not evidence of real deletion.
15. Ordinary automated tests remain offline and reject unintended external connections. Use focused root test wrappers while editing. Run root `npm run check` as the final implementation gate and report actual results with the generated result/log artifact, including any failed, blocked, or unrun stages.
16. Run actual sandbox acceptance only with confirmed sandbox access and usable test-store details: connect, load locations/stores, create a synthetic order/link, submit buyer data, confirm, review, submit, and inspect the actual consignment response. Exercise recoverable provider errors when safely available. Do not claim fault-injection simulations occurred inside Pathao.
17. Record local automated, PostgreSQL, browser, sandbox, Neon cleanup, and production evidence separately as PASS, FAIL, BLOCKED, or NOT RUN. Sandbox success does not prove real pickup, delivery, merchant settlement, production authentication, or production duplicate-handling behavior.

## Out of Scope

- Immediate external booking on payment confirmation or unattended automatic pickup submission.
- A shared platform-owned merchant account, platform-managed COD settlement, or a generic multi-courier marketplace.
- Automatic updates or cancellation of existing Pathao bookings, delivery-status synchronization/webhooks, and shipment tracking inside Middle Man beyond booking result and consignment ID.
- Multiple bookings per order, split COD allocation, split shipments, and replacement shipments.
- AI address guessing, silent location substitution, invented parcel weight, or upgrading seller-supplied payment evidence into provider-verified payment.
- Changes to agreed order totals or delivery pricing, new payment-provider integrations, and automatic refunds.
- Preserving compatibility for obsolete synthetic buyer links selected for the authorized cleanup; this does not authorize deleting unrelated records or arbitrary accounts.
- A database-wide reset, account deletion, changes to normal production retention policy, guaranteed disk compaction, or claims of purging database backups/logs and external object versions.
- Production activation, hosted deployment, real pickup requests, physical-device acceptance, or real-money settlement verification as part of initial sandbox delivery.

## Further Notes

- Implementation update (2026-10-26): tickets 01–03 are locally implemented. Current status is tracked in the ticket index and individual implementation records. The SDK-source retrieval limitations in the original design notes below are historical; ticket 03's source review and remaining provider uncertainties are recorded in `docs/pathao-account-contract.md`. No live booking acceptance or Neon cleanup has run.

- This specification synthesizes accepted decisions Q1-Q18. Buyer location selection supersedes the initial proposal for seller-only location mapping. Removal of obsolete test data supersedes the initial suggestion to preserve old links through compatibility handling. The user explicitly confirmed the proposed test seams during specification authoring.
- Established architecture decisions remain applicable: seller-supplied payment evidence determines confirmation; application secrets for saved links/payment reuse remain independent of seller authentication; buyer-link authority is separate from order lifecycle; courier booking requires seller review and is separate from confirmation.
- Current code already shares allocation across manual and automatic confirmation, derives actual COD from accepted allocations, permits post-confirmation delivery corrections/cancellation, and provides durable replay/retention protections. It has no existing courier staging/booking or per-shop courier credential facility. Existing payment-account settings are not a courier secret store.
- SDK and provider facts still require owning-source/runtime verification before committing to transport behavior or production guarantees. The community documentation establishes a candidate integration surface, not proven server-side idempotency or an external draft state. No design question remains open; sandbox access, provider schemas, safe SDK behavior, and the precise obsolete-data inventory are implementation evidence prerequisites.
- Sources: [community SDK repository](https://github.com/mojnomiya/pathao-python), [order management](https://mojnomiya.github.io/pathao-python/order_management/), [location services](https://mojnomiya.github.io/pathao-python/location_services/), and [authentication/environments](https://mojnomiya.github.io/pathao-python/authentication/). These were consulted during design; individual SDK implementation files were not successfully retrieved and must still be audited.
- Publication of this spec does not perform implementation, submit courier requests, activate production, or delete Neon data. Application checks and live acceptance have not run for this documentation-only task.
