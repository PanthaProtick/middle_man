# 08: Courier draft review and submission outcomes

**What to build:** Review courier drafts, parcels, location blockers, and submission outcomes in either language without changing booking safety.

**Blocked by:** 01 — Language switching and buyer order summary

**Status:** ready-for-agent

- [ ] Translate courier workspace/draft/review, parcels, locations, coverage, blockers, provider state, submission progress, accepted/failed/unknown outcomes, and recovery.

- [ ] Distinguish local courier drafts from accepted Pathao bookings. Do not enable booking or bypass eligibility, review, staleness, cancellation, or reconciliation safeguards.

- [ ] Localize stable blocker/error codes and known historical failures. Add narrow structured metadata only if necessary; unmapped provider text receives safe guidance and access-controlled original evidence where appropriate.

- [ ] Preserve Pathao names/IDs, recipients, addresses, evidence, revisions, and parcel values; accept Bengali digits only at numeric boundaries.

- [ ] Switch with edits, location selections, pending review/submission, or failed/uncertain results without re-running review, submitting another booking, or altering recorded outcomes.

- [ ] Extend rendered courier/parcel/location journeys and backend submission/replay/failure tests in both locales. Assert preserved evidence/state and no extra provider call or booking attempt.

- [ ] Keep approved standard Bangladeshi Bengali and plain English wording. Include Bengali-capable offline font fallback, phone wrapping and reachable controls, localized document/control language, associated errors, announcements, and preserved keyboard focus; test visible behavior rather than implementation details.

- [ ] Run focused repository tests for changed behavior, then root npm run check as the final pre-handoff gate. Record changed paths, exact results, and failed/blocked/unrun browser or provider acceptance in the existing task record. Mocks and HTTP smoke do not prove live acceptance.
