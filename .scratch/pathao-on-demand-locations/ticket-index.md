# On-demand Pathao location tickets

Status: ready-for-agent
Approved breakdown: 2026-10-31.

The [feature specification](spec.md) remains the parent record. Each ticket includes
its own acceptance criteria and verification requirements; implementation has not
started.

| Ticket | Blocked by | Status |
| --- | --- | --- |
| [01 — Restore on-demand selection and submission](issues/01-restore-on-demand-selection-and-submission.md) | None | ready-for-agent |
| [02 — Handle rate limits and concurrent requests](issues/02-handle-rate-limits-and-concurrent-requests.md) | 01 | ready-for-agent |
| [03 — Retire full-catalogue synchronization](issues/03-retire-full-catalogue-synchronization.md) | 01 | ready-for-agent |

Start with ticket 01. After it completes, tickets 02 and 03 are independently
unblocked. All three are required to finish the feature; a passing first ticket
does not by itself establish resolution of the overall rate-limit problem.

Preserve pre-existing checkout changes, existing snapshot tables and unrelated
seller work. No live Pathao traffic or booking calls are authorized by this ticket
publication.
