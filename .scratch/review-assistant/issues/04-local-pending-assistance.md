# 04: Explain uncoded pending submissions locally

**What to build:** A seller opens Ask AI on a pending buyer submission and receives
an honest local explanation of a missing matching seller transaction record or an
unknown pending cause, with permitted next-step links and no external AI request.

**Blocked by:** None (can start immediately).

**Status:** complete

**Implementation difficulty:** 4/5 — High.

**Why:** This establishes the narrow end-to-end assistant boundary: authorization,
truthful pending-state derivation, typed responses, actions, locale, and freshness.
Weak contracts here would leak into every later ticket.

**Agent fit:** Strong full-stack domain design and authorization experience, with
careful React request/view lifecycle reasoning.

**Parent:** [Approved spec](../spec.md). Follow the [shared contract](../ticket-index.md).

- [x] Add a seller-authenticated review-assistance interface and visible button
  for every pending buyer submission, including those with no stored reason codes.
  Awaiting-buyer and completed orders are ineligible.
- [x] Derive the shop from authenticated identity and reuse existing ownership
  and retention guards. Unauthenticated, wrong-shop, retained, and nonpending
  requests cannot expose records or invoke any provider.
- [x] Reuse authoritative current records to distinguish no recorded matching
  receipt from an unknown cause. Missing receipt does not mean payment was never
  made. Unknown stored codes receive honest generic guidance until supported.
- [x] Define the typed review context and explanation/action response through
  this working slice. Keep business facts and allowed actions backend-established;
  reject client attempts to supply prompts, findings, or another shop's authority.
- [x] Render concise local guidance in Bengali/English and label its local source.
  Map backend-approved action identifiers to application-owned links/controls;
  explanations cannot approve, edit, resolve, or book anything.
- [x] Preserve existing review labels and corrective controls. A local explanation
  is an advisory aid, not new evidence or an independent verification result.
- [x] Bind advice to relevant context and provide cheap provider-free revalidation.
  Invalidate on fact/lifecycle changes; discard late stale responses and clear view
  state on order/shop changes or sign-out.
- [x] Reopening unchanged assistance reuses only the current view's authorized
  result. Do not persist content in browser storage or server caches; locale
  changes use local translated guidance without triggering generation.
- [x] HTTP tests prove eligibility, privacy/ownership, no mutation, cause accuracy,
  unknown handling, and freshness. Rendered tests prove button behavior, local
  source, accessible links, locale switching, reuse, and view cleanup.
- [x] No live provider is introduced or called. Run focused HTTP/UI tests and
  final root `npm run check`; document the interface for later reason slices.

## Notes

Prefer existing order/receipt lookup and reconciliation seams. New helper seams
must serve this observable behavior rather than build an unused generic AI framework.

## Verification and fixes — 2026-10-30

Reviewed the uncommitted implementation against base
`fdac49b9d988f594b59a8bc86bb22080bca4f11e`, the parent specification, and shared
contract. Standards review found unrestricted action/fact types and missing
maintained API documentation. Spec review found indefinite stale reuse, late-response
and session cleanup gaps, a retry that closed the panel, and ineffective action
navigation. These findings were fixed before completion.

- Narrow typed conditions/actions/facts; receipt ownership and retention checks;
  current revision selection; missing revision stays unknown. Database order
  changes during local context construction return `REVIEW_CHANGED`.
- Opaque context identity includes order/revision/lifecycle, claim, reasons,
  matching receipt presence/version and selected receipt identity/version.
  Reopening, focus/visibility return and suggested actions revalidate through the
  same always-local POST. Unchanged authorized advice is reused within the view;
  changed advice requires another explicit action click. Locale switches use local
  text without requests. View keys discard content and late requests on scope changes.
- Retry performs a request; duplicate requests are blocked. Approved identifiers
  route to Received Payments or the actual buyer correction tab. No new mutation
  authority or provider is introduced. Selected-receipt explanations remain ticket 06.

Changed paths: `backend/app/{api,models,services}/review_assistance.py`, route
registration in `backend/app/main.py`; seller assistant client/panel/view and
locale copy; `OrderCard`, `OrderList`, `OrderDetailModal`, `OrderPaymentDetails`,
`SellerWorkspace`; HTTP and rendered assistant tests plus bounded test support;
`docs/contracts/review-assistance.md` and the API contract index.

Checks: focused HTTP tests **17 passed**; focused rendered tests **18 passed**;
`npm run typecheck` passed. Final root `npm run check` **PASS**:
`.cache/checks/check-Zz7NqK/result.json` (527 backend passed, 174 skipped;
459 frontend passed; tooling, conventions, lint/types, build and HTTP smoke passed).
The initial run (`check-I5pRNh`) hit a Windows temporary-directory permission error
in the existing smoke-environment test; reran successfully with
`PYTEST_ADDOPTS=--basetemp=E:\middle_man\.cache\pytest-review-assistance-04-20261030`.
Browser, PostgreSQL integration and live-provider acceptance are **NOT RUN**.
No external AI request was made. Next work: ticket 05; retain the local,
provider-free revalidation path when generation is added in ticket 07.
