# 05: Organize seller shell and order workflows

**Status:** ready-for-agent

**What to build:** Maintainable seller navigation, onboarding, order creation, and order details with colocated behavior tests and unchanged user interactions.

**Blocked by:** 02 — Clean scratch storage and fix artifact producers; 03 — Remove proven obsolete scaffolding.

- [ ] Use inventory-bounded targets and trace UI callers, state ownership, API contracts, and tests before changing each workflow.
- [ ] Organize shell and order responsibilities within existing feature boundaries, decomposing oversized components without adding generic layers solely for line counts.
- [ ] Preserve navigation/history behavior, onboarding/session states, form values, accessible focus, order creation, details, and buyer-link actions.
- [ ] Preserve localization, entered business data, error recovery, and no-repeat mutation behavior.
- [ ] Preserve backend authority and payload contracts; coordinate shared ownership through the disposition record rather than duplicating helpers.
- [ ] Keep meaningful rendered interaction and API coverage discoverable; follow agreed source-size rules and document narrow test exceptions.
- [ ] Verify each bounded workflow before the next, then run final root `npm run check`; identify browser/device acceptance not run.
- [ ] Record evidence-backed no-change findings where applicable, moved/deleted files, results, and shared follow-up targets.

