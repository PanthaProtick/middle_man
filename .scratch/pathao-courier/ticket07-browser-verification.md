# Ticket 07: browser component verification — 2026-10-27

**Result: PASS for the changed local component interactions.**

Rendered the actual `CourierReview` / `CourierReconciliation` components with
the repository stylesheet in a real browser using a disposable Vite fixture.
The fixture replaces fetch responses with explicit synthetic cases; it does not
prove authenticated whole-app integration, live Pathao evidence, or provider behavior.
Chrome accessibility inspection confirmed the initial protected state. Native
Chrome screenshot capture timed out and click geometry was unavailable, so the
interactive checks and visual captures continued in the in-app browser.

| Case | Observed browser result |
| --- | --- |
| Initial unknown | Warning present; attach disabled without an ID; noncreation disabled without acknowledgement. |
| Rejected evidence | Error explains evidence cannot be verified; unknown warning and reconciliation controls remain. |
| Interrupted response | Error shown; next identical action retains the original key. |
| Pending request | “Recording reconciliation…” shown; evidence input, attach button, and acknowledgement disabled. |
| Recovered success | Completing the held response replaces unknown controls with consignment and preserved-snapshot confirmation. |
| Cancelled-order recovery | Lifecycle blocker remains; recovered success explicitly says local cancellation does not cancel Pathao and requires external action. No submission control appears. |
| Confirmed noncreation | Checkbox enables action; submitting shows recorded noncreation and explains current facts are revalidated before another attempt. |

The fixture's visible request log confirmed the rejected, interrupted, and pending
attach requests all used `reconcile-f1cd4c6f-04e5-4131-ae31-da69aaa89033`.
The initial actions each generated exactly one recorded request; loading controls
were disabled. Duplicate API mutation safety is separately covered by the
PostgreSQL tests; disabled controls alone do not prove database concurrency behavior.

Screenshots inspected and saved:

- [Cancelled-order recovered booking](ticket07-cancelled-recovery.png)
- [Confirmed noncreation](ticket07-noncreation.png)

For reproduction, copy `ticket07-browser.html` and `ticket07-browser.tsx` from this
directory into `frontend/.scratch/`, run
`npm exec -- vite --host 127.0.0.1 --port 5178 --strictPort` from `frontend/`, and
open `http://127.0.0.1:5178/.scratch/ticket07-browser.html`. The fixture imports
actual seller components; its toolbar controls only the synthetic responses.
The temporary frontend copies and owned Vite process were removed/stopped after
verification. No production source changes were made in this verification pass.

The previous full automated gate remains PASS at
`.cache/checks/check-6eNPhc/result.json` (630 backend, 191 frontend tests).
Physical-device, authenticated whole-app journey, sandbox/live Pathao/Clerk,
and hosted migrations remain NOT RUN in this pass.
