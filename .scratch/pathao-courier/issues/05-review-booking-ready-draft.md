# 05: Review a booking-ready draft

**What to build:** A seller can complete unresolved delivery details and review the current recipient, pickup store, service, parcel, and remaining COD in one draft. Corrections require review of current data, and cancelled or incomplete orders cannot be submitted.

**Blocked by:** 02 — Capture parcel details early; 04 — Collect Pathao delivery locations from buyers.

**Status:** ready-for-agent

- [ ] Deliver a complete seller review view that combines the current buyer submission, parcel fields, connected account/environment, selected store/service, and server-derived remaining COD.
- [ ] Allow the seller to resolve missing location selections and parcel information, review or override eligible saved pickup/service defaults, and see all remaining readiness blockers.
- [ ] Revalidate location relationships, supported service, store membership, account/environment, and explicit parcel values on the backend. Missing connection or metadata blocks booking, not order collection or committed confirmation.
- [ ] COD uses the accepted advance, including seller payment exceptions and fully prepaid zero collection. The review never replaces this value with the expected advance or allows an arbitrary client override.
- [ ] Bind review to the order, buyer, draft, and selected connection/settings revisions needed to detect stale information. Corrections committed before submission refresh the draft and invalidate stale review where relevant.
- [ ] A cancelled, retained/erased, unconfirmed, or no-longer-eligible order cannot become submit-ready. Repeated review operations do not create a booking or another draft.
- [ ] Preserve existing payment locks: delivery correction cannot rewrite accepted payment terms or allocation. Keep shop ownership, version conflicts, session isolation, and late-response handling consistent with existing seller operations.
- [ ] The interface clearly distinguishes completed review from an actual Pathao booking. Do not enable a real external submission before the protected attempt workflow exists.
- [ ] Verify API/PostgreSQL and seller component behavior for metadata completion, default overrides, actual COD, disconnected/unsupported blockers, stale review, correction, cancellation, cross-shop access, and session changes.
- [ ] Run focused tests and root `npm run check` as the final gate; record actual results and any unrun browser/provider checks.
