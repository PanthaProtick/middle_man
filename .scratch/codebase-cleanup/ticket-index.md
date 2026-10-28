# Codebase cleanup ticket index

Breakdown approved on 2026-10-28. Parent: [cleanup specification](spec.md).
Each ticket is `ready-for-agent`; blocking edges still govern eligibility.
No implementation has started as part of ticket publication.

| Ticket | Blocked by | Spec acceptance focus |
| --- | --- | --- |
| [01: Inventory and convention baseline](issues/01-inventory-and-convention-baseline.md) | None | A3, A5, A8; baseline for all |
| [02: Scratch and artifact producers](issues/02-clean-scratch-and-artifact-producers.md) | 01 | A1–A4, A7–A8 |
| [03: Obsolete scaffolding](issues/03-remove-proven-obsolete-scaffolding.md) | 01 | A2–A3, A6–A8 |
| [04: Buyer workflows](issues/04-organize-buyer-workflows.md) | 02, 03 | A2–A3, A5–A8 |
| [05: Seller shell and orders](issues/05-organize-seller-shell-and-orders.md) | 02, 03 | A2–A3, A5–A8 |
| [06: Payments and reconciliation](issues/06-organize-payments-and-reconciliation.md) | 02, 03 | A2–A3, A5–A8 |
| [07: Courier workflows](issues/07-organize-courier-workflows.md) | 02, 03 | A2–A3, A5–A8 |
| [08: Authentication and shared infrastructure](issues/08-organize-authentication-and-shared-infrastructure.md) | 04, 05, 06, 07 | A2–A3, A5–A8 |
| [09: Prevention and conventions](issues/09-prevent-convention-and-artifact-regressions.md) | 02, 03, 08 | A1–A2, A4–A8 |
| [10: Complete verification](issues/10-verify-complete-cleanup.md) | 09 | A1–A8 |

## Execution

- Initial frontier: ticket 01 only. After 01, tickets 02 and 03 are eligible.
- After both 02 and 03, tickets 04–07 are eligible. Shared-file overlap requires
  coordination or serial execution even when dependency edges allow concurrent work.
- After 04–07, complete 08, then 09, then 10.
- Ticket 01 bounds downstream targets; if a ticket exceeds one fresh context
  window, propose a split before implementation rather than silently expanding it.
- Preserve the parent specification. Record decisions, changed paths, checks,
  exceptions, and next actions in the relevant ticket during implementation.
- Each code/tooling ticket runs focused checks during work and root
  `npm run check` as its final pre-handoff gate. Final acceptance also requires
  a fresh complete check on the integrated result.
