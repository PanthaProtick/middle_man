# 11: Remove obsolete Neon test data

**What to build:** The project owner receives a bounded inventory and cleanup report showing obsolete synthetic orders and associated links/data removed from the intended Neon development data, while seller setup, unrelated records, and payment-reuse protections remain usable.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Inventory and positively identify the intended Neon project/branch/database, owning shops, exact obsolete synthetic records, and their dependent evidence/replay/cache references before mutation. The user's authorization covers obsolete test data, not arbitrary accounts, unrelated orders, production data, or a broad database reset.
- [ ] Produce a bounded dry-run inventory with safe counts and target identifiers, without dumping buyer personal data or credentials. If the environment or obsolete-record classification cannot be established, stop that destructive portion and report the specific uncertainty.
- [ ] Implement or reuse a restricted maintenance operation over the identified records; do not add a public deletion/reset endpoint, globally shorten normal retention, accept an arbitrary deletion clock, or truncate unrelated tables.
- [ ] Verify the complete operation first on disposable PostgreSQL data with representative relationships, cached replays, buyer revisions, payment evidence, and consumed receipts. Include only confirmed obsolete records in the actual target set.
- [ ] Remove the selected obsolete links and readable order/buyer/evidence data, including sensitive extraction/observation or replay copies where associated and safe to erase. Preserve seller accounts/settings, unrelated records, and required minimal tombstones/receipt skeletons.
- [ ] Preserve consumed-payment digests and uniqueness protection so a deleted readable receipt cannot fund another order. Do not bypass protections by blindly deleting order or allocation rows.
- [ ] Apply existing per-record rollback/retry principles where appropriate. Repeat execution is safe, partial failures are reported, and an unavailable Neon connection must not fall back to memory and report success.
- [ ] Execute the authorized bounded cleanup against the positively identified development target after disposable verification. Report actual removed/remaining/failed counts and verify old links no longer expose data, seller setup still works, unrelated data is untouched, and used payments remain nonreusable.
- [ ] Record application-row deletion separately from physical disk reclamation and backup/log/object-version retention. Make no guarantee about immediate Neon disk reduction or erased backups.
- [ ] If code/tooling changes are needed, run focused tests and root `npm run check` as the final code gate. Report disposable tests and actual Neon cleanup separately; an unexecuted or blocked real cleanup cannot be marked complete based on synthetic verification.

## Comments

### 2026-10-27: Scope clarified; restricted operation under verification

The owner clarified: "I meant the orders that I created during phase 1 before
the pathao courier phase" and approved the maintenance/PostgreSQL and HTTP test
seams. This resolves the classification blocker below. Select only the five
October 25 orders listed in `scripts/cleanup-phase1-orders.py`; preserve the six
October 26 orders. Ticket 20/21 provenance and the October 26 courier spec date
corroborate the phase boundary. No age-based automatic selection is used.

- Read-only scoped dry run succeeded on the same Phase 1 endpoint fingerprint
  `ecd013abe3562868`, database `neondb`, with five exact order/shop pairs.
  `../ticket11-scoped-dry-run.json` records safe counts, selected receipt IDs and
  a whole-dataset digest. Selected dependencies: 5 buyer revisions, 5 receipts,
  5 observations, 4 allocations, 1 image, 3 raw SMS rows, 3 import results,
  14 replay rows, 13 link measurements, 4 audit rows and 1 review reason.
- Internal maintenance seam: `backend/app/services/obsolete_cleanup.py`.
  Uses bounded explicit identity mapping, shop/order locks, current real time,
  per-record savepoints and safe failure IDs. Refuses courier drafts and shared
  receipts owned/claimed by preserved orders. Erases selected SMS/raw evidence
  and replay copies, reusing receipt skeleton/digest preservation. Normal
  retention scheduling is unchanged. File deletion cannot roll back with SQL;
  it is idempotent and happens after structured cleanup validation/flush.
- Runner defaults to read-only, rejects other endpoint/database/environment
  identities and requires an unchanged dry-run snapshot for `--apply`. It checks
  protected rows, old links, consumed identities and repeat execution separately.
- TDD initial red: missing maintenance module. Disposable PostgreSQL initially
  unavailable; started the existing repository-local cluster on loopback 55447.
  Two test-fixture mistakes (current confirmation creates courier draft; helper
  reuses its idempotency key) were corrected to represent historical data.
- Latest focused run: 14 passed, 0 skipped (7 new maintenance cases plus 7 existing
  structured-retention PostgreSQL cases). Typecheck passed; import sorting fixed
  after focused lint. Full gate and independent review remain pending.
- Actual Neon cleanup remains NOT EXECUTED at this checkpoint. Next: final code
  gate, independent standards/spec review, then execute the already authorized
  bounded operation and record actual deletion/verification results.

### 2026-10-27: Read-only inventory; destructive portion awaiting classification

- Base revision: `2c71c88c700618ed30c0f90229747776504026ae` on `main`.
- Re-executed the existing, initially untracked inventory probe using
  `backend/.venv/Scripts/python.exe .scratch/pathao-courier/ticket11_inventory_probe.py`.
  It completed a repeatable-read, read-only transaction and rolled back. Its
  configured endpoint/database matched `remote-migrations-result.json`;
  database `neondb`, schema `public`, recovery false. This verifies the recorded
  endpoint, not an independent Neon control-plane project/branch lookup.
- Snapshot: `../ticket11-inventory.json` (local untracked artifact). There are
  11 orders in 2 shops: 7 confirmed, 3 pending, 1 cancelled; 10 buyer revisions,
  10 receipts, 7 allocations, 7 consumed-payment markers, 38 idempotency records,
  1 order evidence row, 3 SMS evidence rows, 3 SMS imports, 10 observations,
  2 payment accounts and 2 marker keys. These are table totals, not a verified
  dependency inventory for a deletion allowlist. No buyer fields or credentials
  were printed by the successful inventory.
- Prior Ticket 20/21 records corroborate synthetic provenance for some older
  orders. Neither those records nor lifecycle/age establish which current
  records are obsolete. The snapshot explicitly reports classification unconfirmed.
- Actual cleanup: **NOT EXECUTED**. Removed 0; 11 orders remain in the read-only
  snapshot. No mutation attempted, so no per-record deletion failures measured.
  Seller operation, old-link denial and consumed-payment reuse after deletion
  remain unverified; no deletion acceptance criterion is checked off.
- Traced `structured_retention.py`, `structured_retention_db.py` and associated
  PostgreSQL retention tests. Existing retention uses a calendar-year deadline,
  shop/order locking, per-order savepoints, receipt skeletons and digest checks.
  Do not advance its clock or delete allocations to force this maintenance task.
  Shared receipt claims and associated SMS/replay data require scoped analysis
  before reusing that operation for an early, explicit maintenance allowlist.
- Requested owner selection: all 11 snapshot order IDs, or an explicit subset.
  This is needed by the ticket's classification guard, not a request to authorize
  an already identified cleanup again. Preserve the two pre-existing untracked
  probe/inventory files; they are not part of this documentation commit.
- No application/tooling changes or new tests. TDD, disposable cleanup tests,
  typecheck and root `npm run check` were not run for this evidence-only update.
- Next action: resolve obsolete-record selection, confirm project/branch identity
  and exact dependent references, implement a restricted operation if needed,
  verify on disposable PostgreSQL, then perform and verify the bounded Neon
  cleanup. Row deletion would not establish physical disk reclamation or erasure
  from backups, logs or object versions.
