# 05: Explain all seven automatic payment review reasons

**What to build:** Sellers receive a combined local explanation and ordered,
permitted next steps for every automatic payment review reason, using only the
minimal facts needed to explain the current review.

**Blocked by:** 04 — Explain uncoded pending submissions locally.

**Status:** ready-for-agent

**Implementation difficulty:** 4/5 — High.

**Why:** Reconciliation reasons interact, and competing claims can instead mean
this claim was held by a prior resolution. Context must preserve those distinctions
without disclosing related buyers or independently reimplementing matching rules.

**Agent fit:** Strong payment-domain, related-record projection, and privacy
reasoning; comfortable testing combined conditions rather than just labels.

**Parent:** [Approved spec](../spec.md). Follow the [shared contract](../ticket-index.md).

- [ ] Explain SENDER_MISMATCH, AMOUNT_MISMATCH, TIME_UNCLEAR,
  WRONG_RECEIVING_ACCOUNT, CONFLICTING_RECEIPTS, COMPETING_CLAIMS, and PAYMENT_USED
  through the existing assistant interface and rendered seller view.
- [ ] Derive facts from current authoritative records and established reconciliation
  rules, not stale labels alone or a second independently invented matching engine.
- [ ] Distinguish sender missing/different and time missing/before creation/after
  claim submission without sending phone numbers or exact timestamps externally.
- [ ] Include only applicable required/claimed/received amounts and currency,
  account comparison, reliable conflict categories, active claim counts, hold state,
  and used/allocated status as specified by the parent allowlist.
- [ ] Distinguish prior-resolution-held claims from active competing claims.
  Related same-shop records contribute aggregate facts, never other buyer identities.
- [ ] Explain multiple concurrent reasons coherently; suggestions stay within
  backend-established permitted actions and preserve every acceptance blocker.
- [ ] Maintain the uncoded/unknown fallback from 04. All guidance remains advisory
  and makes no changes to claims, receipts, allocations, or review status.
- [ ] Keep the context ready for the later fake/live provider boundary through an
  explicit typed allowlist. Exclude identifiers, names, phones, addresses, raw SMS,
  notes, product descriptions, credentials, and unrelated history.
- [ ] Context freshness covers related receipt and resolution changes as well as
  the order/buyer revision; a related change invalidates current-view reuse.
- [ ] HTTP tests cover each code, combined reasons, held/active claim distinctions,
  unknown codes, same-shop aggregation, unchanged business records, and an exact
  minimal-context projection seeded with conspicuous excluded private values.
- [ ] Rendered bilingual tests verify explanations, suggested controls, and
  invalidation; no unsupported action or link can be introduced.
- [ ] Run focused reconciliation/assistant/UI tests and final root `npm run check`.
  Generation stays local with zero live Gemini calls.
