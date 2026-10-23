# Seller SMS import

`POST /api/seller/transactions/sms-import` accepts an owning-shop
`payment_account_id`, `messages: string[]`, and a required `Idempotency-Key`.
Batches contain 1–50 messages, at most 65,536 UTF-8 bytes of message content.
The React panel separates messages on blank lines. Multiline messages stay intact.
Unknown write fields fail validation. Results and history contain structured values,
field issues, receipt IDs, confirmation order IDs and evidence metadata, never raw SMS.

`GET /api/seller/transactions/sms-imports` supplies seller-only history with a bounded
cursor page (default 25, maximum 100). Authentication, ownership and private-cache
headers apply to both endpoints, including validation errors.

## Tested format boundary

Only this **synthetic fixture grammar** is supported in this implementation:

```text
bKash: You have received Tk 150.00 from 01799998877. TrxID SYNTHETIC1 at 2026-10-24T12:00:00+06:00
```

This is fabricated test data, not a permissioned sample received from a provider.
There are **zero permissioned live formats validated**. Do not claim general bKash
or Nagad support. The account must be bKash for this grammar. The whole message must
match; arbitrary extra destination/balance text is unsupported. Amounts are integer
minor units. Full supported Bangladesh sender numbers use existing canonicalization.
Explicit `?` required fields are missing, masked senders are masked, and invalid or
non-timezone-qualified times are ambiguous. No receiving number or timezone is
inferred from text. The seller explicitly associates the SMS with the selected
receiving account; it is not independently authenticated provider evidence.

Add a format only after obtaining sanitized, permissioned examples and documenting
the exact timestamp/destination semantics with regression cases. Until then, use the
visible manual form to enter observations reviewed in the seller's payment app.
Buyer screenshots do not become seller receipt evidence. SMS never invokes Gemini.

## Durability and retention

Migration `0007_sms_import.sql` adds separate private raw evidence and structured
import-result tables. Same-shop raw-text digests retain their original ownership,
collection instant and 30-day deadline. Reimport never resets that deadline or
restores erased raw content. Raw bodies can be set to NULL independently; the digest
and metadata remain a tombstone. The cleanup worker belongs to ticket 18 and is not
implemented here. Do not launch until that retention gate is demonstrated.

All batch observations are recorded before reconciliation. An intra-batch conflict
therefore prevents a new allocation regardless of message order. Existing committed
allocations are preserved by the existing reconciliation contract. Structured receipts,
result and idempotency identity commit together; an unknown response can be retried
with the same key. Same-shop imports serialize on the shop row. Deadlocks/database
errors roll back and retry the complete import up to three times, then return 503.
A changed payload with the same key returns 409. No partial successful response is
returned on infrastructure failure; parse failures coexist with committed good items.

The process-memory adapter is offline standby only. PostgreSQL tests use fresh
schemas in a disposable loopback database. Production migration, live identity,
permissioned format acceptance, rate limiting, backup and raw-cleanup enforcement
remain deployment gates, not consequences of passing local tests.
