# Remote migration verification — 2026-10-27

User explicitly requested applying the pending remote schema migration with checks.

- Target: configured Neon **development/self-test** database `neondb`, schema
  `public`; verified writable primary and expected endpoint before changing it.
- Preflight found the schema through 0021 present, with no migration ledger table.
  Both 0022 (`buyer_revisions.address_pathao`) and 0023 (`courier_drafts` review
  choices/fingerprint) were absent. No earlier migrations were rerun.
- Applied the exact repository SQL for **0022 and 0023**, in order, within one
  transaction. Used a migration advisory lock, 5-second lock timeout, 30-second
  statement timeout and explicit locks on the two affected tables.
- Verified column types, nullability, length and absence of defaults before
  commit. Compared counts and deterministic row hashes excluding the new columns:
  **existing data preserved** (10 buyer revisions; 0 courier drafts). Confirmed
  all newly added fields were NULL on existing rows.
- Fresh connection after commit: schema verified and SQLAlchemy projections for
  both affected models compiled/executed successfully with zero-row reads.
- Final independent read-only preflight: **no pending 0022/0023 migrations**.
- Result: **PASS**. The disposable execution report was removed from the
  repository; it recorded the SQL source hashes and safe checks. Migration
  SHA-256 values were `4757169e451ced5f0cdb7e7c035bc088a009d60ae5f6ff50cef6d6e6f30442a4`
  for `0022_pathao_locations.sql` and
  `f72f360bd02907a1251194245a881403cbb4298c800fa5c1c8c766e78d0f90d5` for
  `0023_courier_review.sql`. Credentials and private row contents were not
  retrieved into output. Temporary execution scripts removed after verification.
- This records actual remote schema acceptance. It does not establish browser,
  Clerk, provider, sandbox booking, or production acceptance. No courier request,
  data cleanup, or application deployment was performed.
