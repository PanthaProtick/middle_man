# Guided seller order creation

The seller assistant collects one awaiting-buyer order locally. Labeled fields
(`product:`, `total:`, `advance:`, `account:`, `weight:`, `quantity:` and Bengali /
Banglish equivalents) and editable inputs preserve entered text. Clear BDT, Tk,
৳, টাকা, Bengali digits, and correctly grouped amounts are interpreted as BDT.
Ambiguous amounts and account matches require correction. Product names, chat,
and account details are never sent to Gemini. Unmatched wording gets local help.

The summary shows interpreted amounts and selected account. Only the explicit
Create order button confirms its current payload. Conversational agreement and
Enter in the composer cannot submit it. Optional weight and quantity reuse parcel
validation. The API revalidates authorization, account activity, and `OrderInput`.
The result includes the actual buyer link and a seller-detail action. No buyer
delivery details or courier booking are collected.

## Confirmed action API

All routes require seller authentication and an owned shop, and return private,
non-cacheable results:

- `GET /api/seller/order-submissions` returns `{storage_epoch}`.
- `POST /api/seller/order-submissions/{key}` takes `OrderInput` and returns the
  created `SellerOrder` with 201, or the same original result on replay.
- `GET /api/seller/order-submissions/{key}` returns
  `{state: "succeeded", order: SellerOrder}` or `{state: "not_found", order: null}`.

The tab generates a key from the server epoch plus a UUID, with a maximum of
64 characters. The existing idempotency receipt binds owner, `create_order`, and
normalized payload hash; creation and lookup also require the result's current
authorized shop. The operation cannot replay another shop's result. Reusing a
successful identity with changed terms returns `409 IDEMPOTENCY_KEY_REUSED`.

Creation and recovery serialize using the shop row lock. Account validation locks
the account until the order and receipt commit together. This fixes the older
two-commit window for ordinary order creation as well. A lookup waits for a
transaction already holding the lock; there is no separately committed processing
record. Pending HTTP work displays processing; transport/server errors display
unknown. A not-found lookup may precede an original request arriving at the server,
so retry always uses the original identity and immutable confirmed payload.

The UI freezes edits, discard, and new creation while processing or unknown. A
failed recovery lookup, including lost authorization, does not prove the original
write failed. Only a not-found result offers explicit retry with the same payload.
Definitive validation errors preserve fields for correction and fresh confirmation.
No automatic writes or external-model retries occur.

## Storage, restart, and retention

Durable storage uses the stable `durable` epoch. The order and idempotency receipt
survive app-process restart together. Existing structured retention replaces replay
results with `RECORD_UNAVAILABLE` tombstones rather than deleting mutation guards;
lookup/replay then returns 410 and cannot recreate an erased order with that key.

Offline standby uses one process's memory, including an async shop lock and random
process epoch. Records last only for that process's lifetime. An existing tab's
old key returns `409 SUBMISSION_STORAGE_RESET` after restart; it cannot silently
resubmit. The seller must review orders and explicitly discard before starting a
new action. Standby is a single-process adapter, unsuitable for multi-worker
durability. Durable mode never falls back to this adapter.

Conversation, drafts, and the current identity stay in React state only. Reload,
sign-out, and shop replacement clear them, as required by the temporary-chat
contract. A reload therefore requires checking the order list before deliberately
starting another action; cross-reload draft recovery is outside this contract.

## Verification boundary

The agreed seams are the assistant UI and authenticated order API. Automated tests
cover interpreted/corrected/incomplete input, ambiguity, explicit confirmation,
parcel limits, actual result actions, account changes, shop isolation, concurrent
duplicates, recovery, and standby restart. Opt-in PostgreSQL cases cover concurrent
HTTP requests and receipt-failure rollback. Mock DOM and offline-memory tests do
not establish browser/mobile, hosted authentication, or durable concurrency
acceptance. No automated test calls live Gemini.
