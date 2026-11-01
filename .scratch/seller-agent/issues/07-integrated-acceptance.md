# 07: Verify and refine the complete assistant journey

**What to build:** Complete integrated desktop/mobile journeys and deliver a polished, accessible assistant with explicit evidence of what was verified.

**Blocked by:** 02: Create orders through guided conversation; 03: Record seller transactions through guided conversation; 05: Find and prioritize orders needing attention; 06: Add optional Gemini assistance within the agreed privacy boundary.

**Status:** ready-for-agent

- [ ] Verify all four workflows through the shared window, including creation-to-search-to-review transitions without draft loss or competing assistant windows.
- [ ] Refine consistent bilingual result cards, editable summaries, badges, clarification/loading/error/empty states, launcher placement, mobile layout, and restrained motion.
- [ ] Verify keyboard navigation, screen-reader semantics, focus restoration, reduced motion, and contextual review/modal interactions in actual browser/mobile viewport acceptance.
- [ ] Verify reset/sign-out/shop-switch isolation, invalidated confirmations, conflicts, lost-response recovery, truthful results, and shared dashboard membership with controlled synthetic data.
- [ ] Run meaningful fake-provider integration tests and the final root verification gate. Record exact results and separate mocked/local checks from browser, storage/concurrency, and provider acceptance; do not claim unrun gates passed.
- [ ] Make zero live Gemini calls during agent verification. Leave manual provider tests to the user and confirm no application request limiting was reintroduced.
- [ ] Update existing design/ticket records with changed behavior, exact check results, unresolved risks, and next action. Keep feature-specific tests in their owning slices rather than deferring them all to this ticket.

## Verification and handoff

Use focused checks while implementing and the root verification gate before completion.
Automated tests use fake providers with zero live Gemini calls. Record actual results,
unrun acceptance gates, remaining risks, and the next action in this ticket.

