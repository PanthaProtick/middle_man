# Conversational Seller Assistant Ticket Index

Status: ready-for-agent; published on 2026-11-03.

Source: [specification](spec.md).

| Ticket | Blocked by |
| --- | --- |
| [01: Chat Stream Layout & Conversational Shell](issues/01-chat-stream-conversational-shell.md) | None (can start immediately). |
| [02: Auto-Triggered Order Creation with Pre-Filled Inline Form](issues/02-auto-triggered-order-creation-form.md) | 01: Chat Stream Layout & Conversational Shell. |
| [03: Order Reconfirmation & Final Result Card with Buyer Link](issues/03-order-reconfirmation-buyer-link.md) | 02: Auto-Triggered Order Creation with Pre-Filled Inline Form. |
| [04: Auto-Triggered Payment Recording with Reconfirmation & Match Result](issues/04-auto-triggered-payment-recording.md) | 01: Chat Stream Layout & Conversational Shell. |
| [05: Inline Work Queries for Attention & Delivery Preparation](issues/05-inline-work-queries.md) | 01: Chat Stream Layout & Conversational Shell. |
| [06: Draft Protection, Contextual Order Review & Integrated Lifecycle](issues/06-draft-protection-integrated-lifecycle.md) | 03: Order Reconfirmation & Final Result Card with Buyer Link; 04: Auto-Triggered Payment Recording with Reconfirmation & Match Result; 05: Inline Work Queries for Attention & Delivery Preparation. |

## Working frontier

Start with **01**. Once **01** is completed, **02**, **04**, and **05** are unblocked and can be worked independently. **03** follows **02**. **06** brings together the full integration and lifecycle verification once **03**, **04**, and **05** are completed.
