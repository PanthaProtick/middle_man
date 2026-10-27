# 09: Courier reconciliation and Pathao settings

**What to build:** Localize courier reconciliation and Pathao account settings,
including provider-state labels and audit wording.

**Blocked by:** 01

**Status:** ready

- [ ] Localize `CourierReconciliation` and `PathaoSettings`, including connection
      states, environment labels, credential validation/progress/failure/session
      lost states, revision history, booking-disabled notice, unresolved-booking
      guidance, and status announcements.
- [ ] Cover reconciliation states, preserved snapshots, local-cancellation vs
      provider-cancellation distinction, "resolve in Pathao" instructions, reload
      actions, and error fallbacks.
- [ ] Keep provider/environment values (`offline`, `sandbox`, `production`), store
      IDs, secrets, revision numbers, and Pathao evidence verbatim; only labels
      change. Preserve the rule that no booking operation is enabled here.
- [ ] Dates use localized months, Bangladesh time, and 0-9 digits. Stable codes
      get localized labels with a fallback for unknown values.
- [ ] Switching language preserves unsaved credential fields without exposing
      secrets, the current revision view, pending checks, and failed-operation
      state; no credential check or reconciliation mutation is repeated.
- [ ] Extend reconciliation/settings tests for both locales, preserved values, and
      no repeated requests on switch.
- [ ] Focused `npm run test:frontend` passes for these suites.
