# Scheduled retention operations

`backend/vercel.json` requests `GET /api/maintenance/retention` daily at 00:00 UTC
(06:00 Asia/Dhaka). It runs existing raw SMS and structured-order policies across
all shops using server time. There is no caller-controlled shop or cutoff.
It neither imports screenshots nor crawls location catalogues.

## Authorization and environment isolation

Set a unique random `CRON_SECRET` (at least 32 random bytes) in the backend
project's encrypted production environment; redeploy after changing it. Vercel
sends `Authorization: Bearer <CRON_SECRET>`. Never share this key with Clerk,
payment-marker protection, frontend bundles, or another environment. An empty
secret disables the endpoint (503); incorrect/missing authorization returns 401.
The credential grants only maintenance invocation, never seller identity.
A missing durable session factory returns 503; there is no memory fallback.
Leave preview secrets empty by default. Manual preview tests require a separate
secret and an explicitly isolated self-test database, as in
[Vercel deployment](vercel-deployment.md).

## Cadence and hosting constraints

Vercel cron runs against production deployments. Hobby allows a daily schedule
but invocation can occur anywhere within the scheduled hour. Function duration
and usage limits apply; failed jobs are not automatically retried, and duplicate
or overlapping delivery is possible. Check the current plan and function duration
before enabling this schedule. See the official
[management guide](https://vercel.com/docs/cron-jobs/manage-cron-jobs) and
[plan constraints](https://vercel.com/docs/cron-jobs/usage-and-pricing), consulted
2026-11-04.

Daily execution leaves due data pending until the next successful run; this is
not a guarantee of erasure at the exact deadline. If that lag is unacceptable,
choose a supported more frequent scheduler and measure its operating limits.
The current worker enumerates shops and runs each phase sequentially. It reuses
the existing shop locks for structured cleanup and row locks for raw SMS cleanup.
For datasets exceeding the function budget, stop rollout and add bounded durable
progress rather than increasing retention periods or claiming a timeout succeeded.

## Failure visibility and retry

A 200 response means both phases completed without due work remaining at their
fixed evaluation time. JSON includes `checked_at`, `shops_checked`, `raw_purged`,
`orders_removed`, `phases_failed`, and `status`. Any failed phase returns 503 with
`partial_failure`; discovery/database absence returns `failed`. Safe aggregate
summaries and phase errors go to function logs without driver messages or record
identifiers. Completed phase transactions stay committed; failed transactions
roll back. Seller retention status retains the existing per-order failure codes
and successful raw-cleanup history. A raw phase exception is visible in scheduler
logs/response rather than a new persisted failure row.

Configure an operator alert for non-200 invocations, function timeouts, and a
missing daily success after the scheduled hour plus an agreed grace period.
No alert integration is installed by this ticket. Inspect the backend project's
cron history and function logs; a timeout or missing completion summary is an
incomplete run even if some records were already removed.

For missed/failed runs:

1. Confirm the intended environment/database, migrations, and runtime access.
   For structured marker failures restore the original payment-marker secret;
   never rebind consumed identities to a replacement key.
2. Correct the reported infrastructure/secret fault, then issue an HTTPS GET to
   the backend `/api/maintenance/retention` with the scheduler bearer header from
   a trusted operator client. Keep the secret out of command history and logs.
3. Require HTTP 200 and `status=clean`; inspect seller retention status for overdue
   data. A 503/timeout requires investigation and another retry. Do not override
   timestamps to conceal missed work. Repeated execution discovers remaining work
   from durable state and preserves prior erasures and used-payment protection.

Ticket 09 must verify deployed delivery/auth, log visibility, alert routing,
missed-run detection, duration, isolated preview retry, and production recovery.
Local tests do not establish hosted operation or backup/provider-copy erasure.
See the [retention lifecycle](retention-lifecycle.md) for those separate gates.
