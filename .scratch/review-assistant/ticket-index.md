# Review assistant implementation tickets

Published: 2026-10-30. Status: ready-for-agent.
Parent: [approved specification](spec.md). The parent remains unchanged.

Difficulty is a relative implementation assessment, not a measured time estimate
or a relaxation of acceptance criteria. Use a fresh agent context for each ticket.

| Level | Meaning | Assignment guidance |
| --- | --- | --- |
| 1/5 | Small, isolated mechanical edit | Routine implementation |
| 2/5 | Bounded behavior with straightforward regression coverage | General implementation agent |
| 3/5 | Several connected states with established interfaces | Agent comfortable with API/UI integration |
| 4/5 | Broad ownership, persistence, or lifecycle reasoning | Agent strong in architecture and regression analysis |
| 5/5 | Concurrency, privacy, and external-service failure behavior together | Strongest available agent; careful review |

| Ticket | Difficulty | Blocked by | Best-fit experience |
| --- | --- | --- | --- |
| [01: Retire address AI](issues/01-retire-address-ai.md) | 4/5 — High | None | Forward migrations, retention, compatibility |
| [02: Require available Pathao choices](issues/02-require-pathao-choices.md) | 4/5 — High | None | Async forms, catalog validation, replay safety |
| [03: Keep public demos local](issues/03-public-demos-local.md) | 2/5 — Low | None | Bounded service cleanup and HTTP regressions |
| [04: Explain uncoded pending submissions](issues/04-local-pending-assistance.md) | 4/5 — High | None | Domain boundaries, authorization, React state |
| [05: Explain automatic review reasons](issues/05-automatic-review-reasons.md) | 4/5 — High | 04 | Reconciliation, related claims, data minimization |
| [06: Explain selected receipt previews](issues/06-selected-receipt-assistance.md) | 3/5 — Medium | 05 | Existing preview integration and stale selection handling |
| [07: Add quota-bounded free Gemini](issues/07-free-gemini-assistance.md) | 5/5 — Very high | 01, 03, 06 | Async concurrency, quotas, provider contracts, privacy |

## Execution order

- Initial frontier: 01, 02, 03, 04. These have no semantic blockers; 03 is the
  lowest-risk starting task for a less experienced implementation agent.
- Assistant chain: 04 -> 05 -> 06 -> 07.
- 07 additionally requires 01 and 03 so old live-call surfaces cannot bypass limits.
- 02 is independent of assistant generation but required to complete the feature.
- Dependency independence does not imply safe simultaneous edits in one checkout.
  Address retirement and Pathao entry share buyer surfaces; coordinate ownership
  or implement serially. Preserve all unrelated checkout changes.
- All seven tickets must satisfy their own acceptance criteria and checks; there
  is no final ticket that retroactively supplies missing tests or safety controls.

## Shared implementation contract

- Each ticket is a complete, verifiable behavior slice. Follow the parent spec and
  accepted domain decisions; use existing seams before introducing new ones.
- Live generation remains disabled through 06. Ticket 07 introduces the provider
  only together with all quota, privacy, freshness, and failure protections.
- HTTP behavior with a fake provider is the primary test boundary. Rendered UI
  and migration tests cover their distinct observable behaviors where applicable.
- Automated tests make zero live Gemini requests. Do not inspect real credentials,
  perform live provider probes, batch synthetic live tests, or silently retry calls.
- Run focused tests during each cluster, then root `npm run check` as the final
  code gate. Report actual results, skipped/blocked checks, and the fresh result
  artifact. Browser and live-provider acceptance are separate evidence.
- Keep application/test sources within repository size rules. Update the owning
  ticket with decisions, changed paths, checks, risks, and next action at handoff.
- Manual live verification is optional, requires a separate explicit request,
  and begins with one synthetic review. Ticket completion never requires spending
  free quota merely to obtain a live success screenshot.

No application implementation or live API verification was performed when these
tickets were published. Existing glossary/ADR design changes remain in the checkout.
