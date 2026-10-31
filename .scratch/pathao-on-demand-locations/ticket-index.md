# On-demand Pathao location tickets

Status: in-progress
Approved breakdown: 2026-10-31.

The [feature specification](spec.md) remains the parent record. Each ticket includes
its own acceptance criteria and verification requirements. Tickets 01 and 02 are
implemented; ticket 03 remains.

| Ticket | Blocked by | Status |
| --- | --- | --- |
| [01 — Restore on-demand selection and submission](issues/01-restore-on-demand-selection-and-submission.md) | None | done |
| [02 — Handle rate limits and concurrent requests](issues/02-handle-rate-limits-and-concurrent-requests.md) | 01 | done |
| [03 — Retire full-catalogue synchronization](issues/03-retire-full-catalogue-synchronization.md) | 01 | ready-for-agent |

Tickets 01 and 02 pass the root check; ticket 03 is still required to retire the
retained manual refresh/status surfaces and scheduled crawler. Browser, PostgreSQL,
hosted scheduling and live-provider checks remain separately reportable.

Preserve pre-existing checkout changes, existing snapshot tables and unrelated
seller work. No live Pathao traffic or booking calls are authorized by this ticket
publication.
