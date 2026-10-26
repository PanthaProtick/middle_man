# 10: Include courier data in retention cleanup

**What to build:** Existing seller retention visibility and maintenance operations account for courier data, remove due personal delivery information and sensitive replays, and retain only the minimum references needed to prevent payment reuse or unsafe repeat booking.

**Blocked by:** 07 — Resolve unknown booking outcomes; 08 — Handle changes after submission.

**Status:** ready-for-agent

- [ ] Integrate draft metadata, reviewed payload snapshots, attempt/booking records, and reconciliation details with the existing structured/evidence-retention boundaries. Do not create an unrelated retention schedule or change the agreed production retention policy.
- [ ] Use existing seller retention operations and UI/status conventions to make cleanup behavior and safe failures observable. Preserve shop scoping, server-owned deadlines, and explicit database-unavailable behavior.
- [ ] Erase due buyer names, contact/address details, raw payload copies, and sensitive cached/idempotent responses so replay, status, audit, or seller views cannot resurrect removed personal data.
- [ ] Retain only the minimal nonpersonal attempt/association/tombstone data required to prevent another booking and the existing consumed-payment safeguards. Cleanup of an unresolved attempt cannot make the order submit-ready or imply its external booking was cancelled.
- [ ] Existing retention deadlines are not reset by corrections, booking, settings changes, retries, or reconciliation. Seller accounts/settings and connection secrets are not incidentally deleted with an order; keep their dedicated access/security boundaries.
- [ ] Bound provider-error and audit retention; do not store raw responses indefinitely or duplicate merchant secrets into history. Ordinary raw-evidence cleanup continues to respect its existing independent deadline.
- [ ] Verify on disposable PostgreSQL data using the existing retention/API seams: due/not-due boundaries, cross-shop isolation, complete redaction, unknown/booked protection, replay after cleanup, partial failure, repeat execution, and restart.
- [ ] Add component coverage where retention status or removed-order behavior changes, and confirm old buyer links cannot expose retained personal courier data.
- [ ] Run focused tests and root `npm run check` as the final gate. Do not claim application-row cleanup purges external object versions, logs, or database backups.
