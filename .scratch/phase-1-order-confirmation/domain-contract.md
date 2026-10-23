# Phase 1 domain, state and persistence contract

Normative annex to [spec.md](spec.md). These are target contracts, not current schema.

## Values and validation

- Money is BDT, represented as integer minor units in API/storage; never binary floats.
  Example: BDT 120 is 12000 minor units. Values must be safe JSON integers.
- Order total and required advance are positive; required advance cannot exceed total.
  Received/accepted amounts are positive. Accepted amount cannot exceed order total.
- Remaining COD is derived from total minus accepted amount after confirmation;
  before acceptance show a clearly labelled expected balance using required advance.
- Store timezone-aware UTC instants; display Bangladesh time with an explicit zone.
  Server time governs submission and expiry, never the browser's clock.
- Preserve raw contact/sender input and canonicalise supported Bangladesh local/+880
  representations, including Bangla digits. Compare full canonical sender numbers;
  never infer missing digits or compare only suffixes. Validate contact independently.
- Trim TrxID boundary whitespace. Do not assume undocumented provider case folding,
  remove meaningful characters or merge providers. Version any provider normaliser.
- Name, full readable address, contact, sender, provider, TrxID and positive claimed
  amount are required for buyer submission. Screenshot and claimed timestamp are optional.
- AI unknown fields remain null, never fabricated. Suggestions must pass ordinary
  validation and buyer review before becoming submitted values.

## Records

| Record | Required information and role |
| --- | --- |
| Shop | Internal ID, owning verified seller identity, display name, timestamps; one operator per pilot shop |
| Payment account | Shop, provider, receiving number, label, active flag; provider/number immutable once referenced |
| Order | Shop, opaque ID, public-token lookup digest and encrypted recoverable token for owning-seller link retrieval, immutable product/total/advance/account snapshot, lifecycle, expiry, first submission/completion times, version |
| Buyer revision | Order, name/contact/address raw and reviewed fields, payment claim, optional evidence ID, revision/actor/reason/time |
| Received transaction | Shop, provider, canonical TrxID identity, designated account, received amount, sender/time when known, reconciliation state, version |
| Transaction observation | Received transaction or unresolved import item, source SMS/manual, parsed values, parse/conflict outcome, actor/time; raw evidence reference expires separately |
| Allocation | Shop, order, received transaction, accepted amount, automatic/manual basis, actor/reason/time |
| Audit event | Shop/aggregate, actor, action, revision references, decision reason and timestamp, without unnecessary raw SMS/image copies |
| Evidence | Shop/order or import ownership, private object reference, media metadata, collection/deletion times, AI-choice record where applicable |
| Idempotency record | Actor/access scope, operation, key, canonical request digest, committed result identity/version and timestamp |
| Used-payment marker | Minimal shop/provider transaction-identity digest and used status, retained independently of deleted personal details |

Raw model output is evidence, not an authority record. Distinguish it from buyer-reviewed
structured fields; expire copies containing raw evidence under the same raw-evidence
deadline. Do not duplicate full inputs into permanent audit events or diagnostic logs.

## Relational invariants

1. Every product record belongs to a shop, directly or through an enforced parent.
   References to an account, order, transaction or allocation must not cross shops.
2. Received-payment identity is shop + provider + canonical TrxID. Sender and receiving
   account are comparison attributes, not ways to create extra copies of one payment.
   Conflicting observations attach to that identity instead of creating more funds.
3. A received transaction has at most one allocation and an order has at most one
   allocation. Enforce uniqueness in PostgreSQL, not only application prechecks.
4. A confirmed order has a durable allocation. Its accepted amount equals the
   allocation amount; total minus that amount is nonnegative.
5. Public tokens are cryptographically random, nonsequential and unique. Do not put
   raw tokens in ordinary logs. Token possession is not seller authorization.
6. Allocations and used markers survive cancellation and personal-data deletion.
   Manual approval cannot remove or duplicate a consumed payment.
7. Actor identity, ownership, money bounds and eligibility are checked server-side.
   User-supplied shop/actor/status/COD fields cannot override them.
8. Commercial terms and referenced account details are snapshots. Deactivating or
   relabelling an account cannot change a link's published receiving destination.
9. Stale writes fail using an expected aggregate version. All relevant edits increment it.
10. Completion time is first entry to confirmed, rejected, cancelled or expired.
    Later delivery-detail edits do not restart the retention clock.

## Lifecycle and buyer projection

Review is a separate internal state/reason set on a submitted pending order, not a
buyer-visible fraud verdict. Confirmation basis is separate from lifecycle.

| Lifecycle | Meaning | Allowed transitions |
| --- | --- | --- |
| awaiting_buyer | Link created, no completed submission | pending, expired, cancelled |
| pending | Completed submission, awaiting a qualifying match or seller decision | confirmed, rejected, cancelled; seller corrections keep pending |
| confirmed | Accepted allocation committed | cancelled; logged delivery-detail edits keep confirmed |
| rejected | Seller explicitly declined, with reason | Terminal in Phase 1 |
| cancelled | Seller explicitly stopped the order, with reason | Terminal in Phase 1 |
| expired | No completed submission before the 48-hour deadline | Terminal; seller can replace the order |

- At the deadline itself, initial submission is expired: acceptance requires server
  time strictly before expiry. Deadline and submission are evaluated atomically.
- A submitted pending order never expires automatically. Seller corrections do not
  erase first submission time or start a new expiry period.
- Automatic matching uses the active payment-claim revision's server acceptance time
  as its upper bound; delivery-only edits do not extend that bound. Preserve original
  claim/revision times. A newly paid/corrected claim may be submitted by the seller.
- Clear seller-side payment time must be on/after order creation and on/before active
  claim submission for automatic acceptance. Ambiguous precision/timezone needs review.
- Buyer pending view covers no match, parse failure, conflicts and review. It must
  not claim that address/contact correctness was verified by a payment match.
- Expired/cancelled/rejected views direct the buyer to contact the seller, without a
  buyer resubmission control. Confirmation shows the actual accepted COD balance.
- After retention deletion, return a neutral unavailable-record projection rather
  than incorrectly changing a historic confirmed order into an expired order.

## Reconciliation and concurrency

On accepted claim submission, seller correction, transaction ingestion or conflict
resolution, reconcile eligible pending orders against the shop's records. A successful
response means relevant outcomes or durable pending reasons are committed; no invisible
in-process task may be the only copy of required work. A retry/recovery scan must be
able to recompute missed pending matches after restart.

For automatic acceptance, check the provider, receiving account, full sender, TrxID,
exact required advance and clear time interval. Check all currently known competing
active claims to that transaction identity, including sender-mismatch claims; do not
silently choose the first. A claim does not reserve funds and a seller can resolve
malicious/incorrect claims with a reason.

Within one database transaction, lock/revalidate the order and received transaction,
versions, conflicts, known claims, eligibility and unused marker; then insert allocation,
write confirmation/basis/completion time and audit, and persist idempotent outcome.
Use a consistent lock order and bounded retry of database serialization conflicts.
No observation of two independent application instances may allocate one payment twice.

Serialised outcomes respect the committed snapshot: two known pending claims require
review. If one confirmation commits before a later claim exists, the later claim is
held and alerts the seller; do not undo the earlier confirmation automatically.

Exact repeated imports are no-ops for payment value. Conflicting observations set a
review reason, retain both versions and stop new automatic allocation. An already
accepted allocation stays locked; later contradictory evidence alerts the seller.
Replaying an import after original SMS deletion still deduplicates by transaction
identity or used marker, not solely by a hash of the raw SMS.

## Manual decisions, edits and replacement

- Manual confirmation needs an existing same-shop received transaction, expected
  version, decision reason and amount preview. Provider/account/sender/time/amount
  mismatches must be visible; accepting any exception records what was overridden.
- Missing/unknown sender or timestamp requires review, not guessed values. A manual
  receipt still needs provider, receiving account, TrxID and received amount.
- Accept actual received amount only, at most total. A seller cannot type a smaller
  allocation to hide an excessive payment or turn one receipt into partial allocations.
- Under/over-advance acceptance derives the new COD balance before commitment. Store
  the amount/basis in allocation; screenshots do not determine accepted funds.
- Seller corrections before confirmation retain prior revisions and retrigger checks.
  After confirmation only name/contact/address can be corrected, with actor/reason.
- Unallocated receipt corrections retain observations and recheck claims. Collisions
  with another receipt identity require explicit resolution rather than silent merge.
  An allocated receipt's accepted fields cannot be edited through this route.
- Cancellation and rejection require reasons. Cancellation stops matching and keeps
  any allocation used; neither action processes or implies a refund.
- Replacement atomically cancels an unallocated predecessor and creates a new order
  with new immutable terms/token and predecessor reference. Never transfer claims
  or money silently. Allocated predecessors require separate payment resolution;
  Phase 1 does not supply a payment-reassignment or refund endpoint.

## Retention and failure behavior

- Raw images, SMS and raw AI evidence: delete 30 days after original collection.
  Reprocessing does not extend a raw object's original deadline.
- Completed-order personal details and structured payment/audit records: remove
  12 calendar months after completion. A calendar anniversary absent in the target
  month uses that month's last day. Unresolved orders are not automatically deleted.
- Preserve minimal consumed-payment identity markers while the shop is active.
  Use a protected deterministic digest so records can be recognised without retaining
  the buyer's address, sender, image or raw SMS. Marker-key availability/rotation must
  not permit reuse; missing protection fails closed.
- For an unallocated transaction with known competing claims, do not delete shared
  evidence needed by an unresolved order merely because another order completed.
  Raw originals still follow the 30-day deadline; structured dependencies remain.
- Retry deletion durably and report failed/overdue cleanup; storage version history,
  backups and AI/log copies need a documented purge lifecycle before real-data use.
- Account deletion policy is deferred and must be settled before launch, including
  retained markers, backups and open financial disputes; do not invent it here.
- Structured receipts unattached to any order have no agreed retention period yet;
  settle it before real-data use instead of assuming indefinite storage or applying
  a nonexistent order-completion date. Their raw originals still expire after 30 days.
- Database/auth/storage outage returns an explicit unavailable result without a fake
  submission or confirmation. Gemini failure preserves manual operation. A timeout
  after possible commit is an unknown outcome: retry the same key, then refetch.
