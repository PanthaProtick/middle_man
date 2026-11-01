# Seller agent ticket index

Status: approved breakdown; tickets published on 2026-11-01.

Source: [specification](spec.md).

| Ticket | Blocked by |
| --- | --- |
| [01: Unify the floating seller assistant and contextual review](issues/01-unified-assistant-workspace.md) | None (can start immediately). |
| [02: Create orders through guided conversation](issues/02-guided-order-creation.md) | 01: Unify the floating seller assistant and contextual review. |
| [03: Record seller transactions through guided conversation](issues/03-guided-transaction-entry.md) | 02: Create orders through guided conversation (shared confirmed-action and submission-recovery mechanism). |
| [04: Find orders awaiting delivery preparation](issues/04-delivery-preparation-query.md) | 01: Unify the floating seller assistant and contextual review. |
| [05: Find and prioritize orders needing attention](issues/05-attention-query.md) | 04: Find orders awaiting delivery preparation (shared work-query and dashboard-filter behavior). |
| [06: Add optional Gemini assistance within the agreed privacy boundary](issues/06-optional-gemini-assistance.md) | 01: Unify the floating seller assistant and contextual review. |
| [07: Verify and refine the complete assistant journey](issues/07-integrated-acceptance.md) | 02: Create orders through guided conversation; 03: Record seller transactions through guided conversation; 05: Find and prioritize orders needing attention; 06: Add optional Gemini assistance within the agreed privacy boundary. |

## Working frontier

Start with 01. After 01, tickets 02, 04, and 06 can start independently.
Ticket 03 follows 02; ticket 05 follows 04. Ticket 07 follows 02, 03, 05,
and 06. A ready-for-agent status does not override incomplete blocking edges.

Every feature slice includes its own bilingual UI, contracts, validation, tests,
and accessible presentation. Ticket 07 verifies integration rather than deferring
all correctness or visual work to the end. No application request limits are to be
added; automated verification makes zero live Gemini calls.

