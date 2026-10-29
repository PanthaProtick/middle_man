# 04: Explain uncoded pending submissions locally

**What to build:** A seller opens Ask AI on a pending buyer submission and receives
an honest local explanation of a missing matching seller transaction record or an
unknown pending cause, with permitted next-step links and no external AI request.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Implementation difficulty:** 4/5 — High.

**Why:** This establishes the narrow end-to-end assistant boundary: authorization,
truthful pending-state derivation, typed responses, actions, locale, and freshness.
Weak contracts here would leak into every later ticket.

**Agent fit:** Strong full-stack domain design and authorization experience, with
careful React request/view lifecycle reasoning.

**Parent:** [Approved spec](../spec.md). Follow the [shared contract](../ticket-index.md).

- [ ] Add a seller-authenticated review-assistance interface and visible button
  for every pending buyer submission, including those with no stored reason codes.
  Awaiting-buyer and completed orders are ineligible.
- [ ] Derive the shop from authenticated identity and reuse existing ownership
  and retention guards. Unauthenticated, wrong-shop, retained, and nonpending
  requests cannot expose records or invoke any provider.
- [ ] Reuse authoritative current records to distinguish no recorded matching
  receipt from an unknown cause. Missing receipt does not mean payment was never
  made. Unknown stored codes receive honest generic guidance until supported.
- [ ] Define the typed review context and explanation/action response through
  this working slice. Keep business facts and allowed actions backend-established;
  reject client attempts to supply prompts, findings, or another shop's authority.
- [ ] Render concise local guidance in Bengali/English and label its local source.
  Map backend-approved action identifiers to application-owned links/controls;
  explanations cannot approve, edit, resolve, or book anything.
- [ ] Preserve existing review labels and corrective controls. A local explanation
  is an advisory aid, not new evidence or an independent verification result.
- [ ] Bind advice to relevant context and provide cheap provider-free revalidation.
  Invalidate on fact/lifecycle changes; discard late stale responses and clear view
  state on order/shop changes or sign-out.
- [ ] Reopening unchanged assistance reuses only the current view's authorized
  result. Do not persist content in browser storage or server caches; locale
  changes use local translated guidance without triggering generation.
- [ ] HTTP tests prove eligibility, privacy/ownership, no mutation, cause accuracy,
  unknown handling, and freshness. Rendered tests prove button behavior, local
  source, accessible links, locale switching, reuse, and view cleanup.
- [ ] No live provider is introduced or called. Run focused HTTP/UI tests and
  final root `npm run check`; document the interface for later reason slices.

## Notes

Prefer existing order/receipt lookup and reconciliation seams. New helper seams
must serve this observable behavior rather than build an unused generic AI framework.
