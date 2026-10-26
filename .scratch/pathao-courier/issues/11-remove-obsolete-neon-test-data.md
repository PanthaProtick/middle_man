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
