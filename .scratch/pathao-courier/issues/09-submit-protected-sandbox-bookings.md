# 09: Submit protected bookings to Pathao's sandbox

**What to build:** The seller's existing protected submission and reconciliation workflow can use the actual Pathao sandbox, creating a synthetic delivery request and recording its consignment without enabling production pickup requests.

**Blocked by:** 07 — Resolve unknown booking outcomes; 08 — Handle changes after submission.

**Status:** ready-for-agent

- [ ] Audit owning sources and available runtime contracts for create-order payloads, monetary units/precision, location requirements, success/failure responses, consignment lookup, authentication/token handling, timeouts, logging, and automatic retry policy. Record concrete evidence and choose the community SDK only if its behavior is suitable; a narrow direct client is acceptable where verified.
- [ ] Wire the real sandbox transport through the same external-courier adapter used by offline tests. Reuse durable attempts, snapshots, duplicate guards, error classification, and reconciliation; do not add an unprotected shortcut.
- [ ] Explicitly select sandbox credentials, stores, catalogs, and references. Reject environment/account mismatches and keep production submission disabled on the server.
- [ ] Configure bounded timeouts and no automatic replay of create-order POST requests. Do not block async application handling with synchronous SDK network calls, hold database transactions across the network, or assume merchant references guarantee provider idempotency.
- [ ] Translate exact server-derived COD and validated recipient/parcel/service metadata. Reject unsupported precision or contract values rather than silently rounding, guessing, or substituting destinations.
- [ ] Treat accepted-but-unpersisted or ambiguous responses as unknown and preserve the submission lock. Redact provider errors and avoid storing unnecessary raw personal data.
- [ ] Verify actual sandbox access and an account-owned usable test store before any request. Use synthetic recipients/payment evidence only; do not silently switch to production if sandbox access is unavailable.
- [ ] Complete an actual sandbox booking through the seller-facing workflow and record safe evidence of the request outcome and consignment association. Validate available consignment verification and credential/store/catalog behavior without overstating capabilities the provider does not expose.
- [ ] Keep transport regression tests offline through the established boundary, covering definitive rejection, rate limiting, ambiguous failures, malformed responses, timeout, and recovered success. Do not claim simulated faults occurred inside Pathao.
- [ ] Run focused tests and root `npm run check` as the final code gate. Report local, PostgreSQL, and actual sandbox results separately; missing access or an unsuccessful sandbox journey remains BLOCKED/FAIL, not a simulated PASS.
