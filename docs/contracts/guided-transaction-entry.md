# Guided seller payment entry

The seller assistant records received-payment evidence through one explicit,
recoverable action. Receiving account, exact transaction ID, and a positive amount
are required; sender number and occurrence time are optional. Labeled text
(`account:`, `trx id:`, `amount:`, `sender number:`, `occurred at:` and Bengali /
Banglish equivalents) fills editable structured fields. Amounts reuse conversational
BDT parsing. Account selection matches only active accounts by id, label, provider,
or receiving number; a provider shared by two active accounts stays ambiguous and is
never guessed. Transaction identifiers keep their exact case and spacing apart from
outer trimming.

The preview states that recording runs reconciliation and may automatically confirm
an eligible order, and that recording is not provider verification. Only the
explicit **Record payment** button submits the current payload. The assistant derives
the provider from the selected account. The backend revalidates authorization,
account ownership, provider match, and active status (`422 PAYMENT_ACCOUNT_INACTIVE`).
The older `/api/seller/transactions` manual-entry behavior is unchanged.

## Confirmed action API

All routes require seller authentication and an owned shop, and return private,
non-cacheable results:

- `GET /api/seller/transaction-submissions` returns `{storage_epoch}`.
- `POST /api/seller/transaction-submissions/{key}` takes `ManualReceipt` and returns
  `{receipt: ReceiptView, allocated_order_ids: string[]}` with 201, or the same
  original result on replay.
- `GET /api/seller/transaction-submissions/{key}` returns
  `{state: "succeeded", result}` or `{state: "not_found", result: null}`.

The tab builds the key from the server epoch plus a UUID (at most 64 characters).
The idempotency receipt binds owner, `record_manual_transaction`, and the normalized
payload hash. Lookup and replay also require the receipt's current authorized shop.
Reusing a successful identity with changed evidence returns
`409 IDEMPOTENCY_KEY_REUSED` without overwriting the original result.

Submission and recovery serialize on the shop row lock. The receipt, transaction,
observations, and reconciliation changes commit once. `allocated_order_ids` is
derived from the current receipt comparison and allocations, not from stale cached
receipt JSON. Pending HTTP work displays processing; transport or server failures
display unknown. Only a not-found lookup offers retry, and retry reuses the original
identity and immutable payload. Editing definitive validation or inactive-account
failures preserves fields and selects a fresh identity on the next confirmation.

## Actual reconciliation outcomes

The result shows the saved receipt and the reconciliation result actually observed:

- unmatched evidence is saved without inventing a buyer claim;
- identical evidence is reported as an existing receipt with no new record;
- conflicting evidence is preserved, marks the receipt conflicted, and never
  overwrites the original amount or identifiers;
- an eligible order confirmation lists the allocated order and can open the fetched
  actual seller order.

The action also offers to open the exact receipt in the payments section. UI copy
never claims that the payment provider verified the transaction.

## Storage, privacy, and recovery

Conversation text, pasted messages, transaction identifiers, phone numbers, and the
current submission identity stay in React state and request bodies only. They are
never sent to Gemini or persisted in conversation logs. Reload, sign-out, and shop
replacement clear them.

Durable storage uses the stable `durable` epoch, so the receipt and idempotency
record survive app-process restart together. Structured retention replaces replay
results with `RECORD_UNAVAILABLE` tombstones; lookup/replay then returns 410 and
cannot recreate an erased receipt with that key. Offline standby uses process memory
and a process epoch; an old key returns `409 SUBMISSION_STORAGE_RESET` after restart
and cannot silently resubmit. Durable mode never falls back to standby.

## Verification boundary

Automated tests cover bilingual entry, account ambiguity, optional fields,
authorization and shop isolation, exact identifier preservation, explicit
confirmation, unmatched/duplicate/conflict outcomes, actual order confirmation,
stale accounts, concurrent submission, lost-response recovery, and standby restart.
Mock DOM and offline-memory tests do not establish browser, hosted authentication,
durable concurrency, or live-provider acceptance. No automated test calls a live
payment provider or Gemini.
