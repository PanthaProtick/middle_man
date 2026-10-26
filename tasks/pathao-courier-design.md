# Task: Pathao courier drafts after order confirmation

Status: Completed (design and specification only)

- Goal: agree the delivery workflow through the grill-with-docs interview before implementation.
- Scope: local courier drafts, seller review, and submission under each seller's own Pathao merchant account and pickup store.
- Scope exclusions: immediate automatic booking; automatic modification or cancellation of an existing Pathao booking in the first version.

## Agreed behavior

- Both manual and automatic confirmation create a local courier draft awaiting seller review.
- Missing courier metadata does not prevent order confirmation. It blocks booking and identifies what the seller must complete.
- Offer courier details while the seller creates a buyer link, so they can supply information early.
- Collect the remaining COD balance based on the advance actually accepted by the seller. Fully paid orders collect zero.
- Before submission, buyer-detail corrections update the draft and cancellation prevents submission.
- After submission, flag corrections or cancellation for seller resolution in Pathao; changing Middle Man does not imply the booking changed.
- An ambiguous submission outcome blocks resubmission until reconciled. Clear validation failures remain editable and retryable.
- Sellers can save default pickup store and delivery service. Parcel weight and quantity are explicit per-order values, entered during link creation or draft review.
- Buyers must select delivery locations using Pathao's hierarchy and supply a detailed address. This supersedes the proposal to have sellers select the location IDs after buyer submission.
- The first version supports one Pathao booking per confirmed order. Split and replacement shipments are handled outside Middle Man.
- Show the consignment ID and booking result; use Pathao for delivery tracking in the first version.
- Implement and verify with synthetic orders and the sandbox first. Production booking requires a separate acceptance step.
- If courier location choices cannot load, allow submission of the written address and payment proof. Block booking until the seller resolves the delivery location.
- Remove obsolete test-order data and associated buyer links/evidence from the user's Neon development data rather than merely disabling links. Preserve seller accounts/settings and payment-reuse protection. Inventory and bound the target branch, shops, and records before any destructive operation; no cleanup has run.
- If Pathao does not serve a buyer's location, retain the address and payment claim, mark the draft unsupported, and block Pathao submission. The seller must arrange delivery separately or resolve the order with the buyer.
- Sellers may create buyer links and collect orders before connecting Pathao. Missing connection/setup blocks courier submission rather than order collection.
- For an unknown booking outcome, the seller checks Pathao and either attaches the existing consignment ID or obtains confirmation that creation failed before retrying. An immediately empty merchant-panel result is not enough to authorize another submission.

## Proposed implementation boundaries

- Capture durable draft creation with the successful confirmation transaction; do not call Pathao within payment confirmation. Both confirmation paths use the same draft-creation boundary.
- Keep one draft per order and serialize submission attempts. Persist an attempt before contacting Pathao so restarts, concurrent clicks, or a lost response cannot silently cause a fresh booking attempt.
- Bind each attempt to the reviewed buyer/order revision and the selected merchant connection/store. Recheck lifecycle and revision before sending; flag later edits rather than silently changing an in-flight or accepted booking.
- Keep courier connections and their secrets isolated by shop and environment. The buyer form receives location choices only, never merchant credentials or private courier state.
- Retain meaningful written address details alongside validated Pathao location IDs. Validate the city/zone/area relationship on the backend, handle zones without areas, and use the accepted outage fallback rather than inventing IDs.
- Default development and automated tests to an offline courier adapter. Exercise a separate sandbox adapter with explicit test credentials; keep production booking disabled until separate acceptance.
- SDK adoption is conditional on source/transport review and sandbox evidence. The application owns validation, attempt tracking, and duplicate prevention even if it uses the community SDK.

## Acceptance cases

- Manual and automatic confirmation each produce one draft per order despite repeated processing.
- Courier failures preserve the successful order confirmation.
- Use the buyer contact number, not the payment sender number, and the actual remaining COD balance.
- Missing metadata is actionable; do not guess parcel weight or location IDs.
- Keep drafts, credentials, pickup stores, and external references isolated by shop.
- Handle correction, cancellation, duplicate submission, and ambiguous outcomes according to the agreed rules.
- Old-data cleanup affects only inventoried obsolete test data and preserves consumed-payment uniqueness protections.
- An unconnected shop can collect an order but cannot submit a courier booking.
- Offline mode makes no live courier calls. Sandbox and production credentials, stores, and booking references cannot be mixed.
- A public buyer link cannot access courier secrets or submit a courier booking.
- Validate stale review, concurrent correction/cancellation, repeated submit, process restart, and accepted-but-response-lost outcomes.

## Design-time code observations and unresolved decisions (historical)

- Both confirmation paths converge on `backend/app/services/allocation.py`.
- Actual COD is mapped in `backend/app/services/order_mapping.py`.
- Buyer corrections and cancellation exist after confirmation.
- Current order contracts lack courier metadata and Pathao location mapping.
- The linked community SDK documents creation and tracking, but does not establish draft support or server-side idempotency guarantees. Individual implementation files could not be retrieved.
- Existing link revocation preserves orders and payment records; it does not meet the requested storage cleanup. Current structured retention has age gates and preserves consumed-payment skeletons, so immediate cleanup must respect those invariants rather than blindly delete order rows.
- Existing seller receiving accounts are bKash/Nagad payment destinations, not a credential store. Pathao connections need separate shop-scoped settings with write-only secrets, encrypted storage, and redacted errors/logs.
- No open product decisions from Q1-Q18. The user invoked to-spec to publish the agreed design and explicitly confirmed the HTTP API/PostgreSQL, external courier adapter, component-test, and sandbox test boundaries.
- Implementation prerequisites: exact sandbox access/test-store availability, SDK transport audit, and inventoried Neon cleanup targets. These are factual checks rather than unresolved user preferences.

## State at design publication (historical)

- Decisions Q1-Q18 accepted, with Q9 changed to require Pathao location selections in the buyer flow. Q4 additionally includes an early prompt during buyer-link creation. Q14-Q15 clarify that obsolete test data should be removed to avoid unnecessary Neon storage; the exact deletion inventory is not yet established.
- Published specification: [Pathao courier spec](../.scratch/pathao-courier/spec.md), with `Status: ready-for-agent` in the repository's local Markdown tracker. It contains 58 user stories, implementation/testing decisions, scope exclusions, and factual verification prerequisites.
- Changed files: `GLOSSARY.md`, `docs/adr/0004-seller-reviewed-pathao-booking.md`, this task record, and `.scratch/pathao-courier/spec.md`. No application implementation changes.
- Existing unrelated checkout edits: `frontend/src/App.tsx`, `frontend/src/App.test.tsx`.
- Next step: use the published specification for implementation planning or the next assigned implementation task. Specification publication did not execute implementation or database cleanup.
- Resume: inspect the current diff and contracts. Audit the SDK and sandbox prerequisites, trace integration seams/tests, inventory obsolete Neon test data, and implement one testable behavior at a time when assigned. Run root `npm run check` as the final code/tooling gate; report sandbox and production acceptance separately.

## Verification

| Command or acceptance case | PASS / FAIL / BLOCKED / NOT RUN | Result or log path |
| --- | --- | --- |
| `git diff --check` and spec structure validation | PASS | No tracked-diff whitespace errors; published spec has 154 lines, 58 user stories, all seven required sections, the ready-for-agent status, and no trailing whitespace. |
| Root `npm run check` | NOT RUN | Design documentation only; no code or tooling changes. |
| Pathao sandbox or live booking | NOT RUN | No credentials used and no bookings submitted. |

## Implementation and remaining-file reconciliation — 2026-10-26

- Tickets 01–03 now have local implementations: draft creation (`8ca0d09`), early parcel fields and accessibility (`4103adf`, `4f1ae01`), and secure merchant settings (`8501a54`). The design-time observations above are historical; current executable contracts live in `docs/API_CONTRACTS.md` and `docs/pathao-account-contract.md`.
- Ticket 03 reviewed actual SDK auth/store/transport sources and retained a narrow async adapter. Its final local gate and commit hook passed with 543 backend and 173 frontend tests, including disposable PostgreSQL. No live Pathao acceptance or Neon cleanup has run.
- The user authorized committing the remaining design/specification/ADR/glossary/ticket documents and the buyer-page change removing the seller-correction shortcut. The buyer shell regression test asserts no seller-correction text or order-token query link is rendered; ordinary home navigation and seller authentication remain available.
- Updated the ticket index to distinguish publication-time statuses from the current executable frontier (04 and 11). Ticket 02's original implementation/review notes remain historical evidence, with its implementation commits identified above.
- Remaining-file verification: `npm run test:frontend -- src/App.test.tsx` **PASS (2 tests)**; **13 local Markdown links across 17 documents PASS**; `git diff --check` **PASS**. The repository pre-commit hook runs root `npm run check` with disposable PostgreSQL enabled. The final commit/result artifact is reported in the completion response. This reconciliation does not implement tickets 04–12 or authorize an unbounded database cleanup.
