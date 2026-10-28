# Verification evidence

This directory holds historical development evidence moved out of `.scratch/`.
Scratch keeps only Markdown work records; screenshots, logs, and JSON command
results live here when their content is safe to track.

The evidence is historical. Moving a record does not rerun it, strengthen its
result, or make it a current readiness claim. Read each record for its date,
revision, command, and stated boundary.

## Scope

- Most records use synthetic shop, order, buyer, and payment data with mocked or
  offline services.
- Browser records cover the components and viewports named in the report; they do
  not establish authenticated whole-app journeys, physical-device behavior, or
  live-provider behavior.
- Migration records cover the named development database operation at the time it
  was performed; they do not establish hosted production migrations.
- PostgreSQL, sandbox Pathao, live Clerk, Gemini, and deployment gates remain
  separate. A record that says NOT RUN was not run.

## Layout

- [`pathao-courier/`](pathao-courier/ticket07-browser-verification.md): Ticket 07
  component browser verification, the 0022/0023 remote migration application
  record, screenshots, and focused check logs. Ticket 12 migration and schema
  preflight outcomes are summarized in the scratch issue, not here. See
  [`remote-migrations-verification.md`](pathao-courier/remote-migrations-verification.md).
- [`localization/`](localization/ticket12-live-session.png): Ticket 12 embedded
  authentication session evidence. The companion screenshot that showed a live
  account identifier was removed from tracking and retained only in ignored
  private evidence storage; earlier Git history still contains the prior commit.
- [`payment-screenshot-removal/`](payment-screenshot-removal/screenshot-removal-browser-result.json):
  forwarded mocked-API browser result for the retired payment-screenshot surface.

## Reproduction limits

Temporary fixtures and probe scripts were disposable and have been removed. The
reports describe what was checked; they are not runnable launchers. Some records
cite `.cache/checks/...` or adjacent cache artifacts from the original run; those
paths are local and may be pruned. The written result and its stated boundary
remain the durable evidence, not the cache file. For current behavior, use the
maintained backend, frontend, and tooling suites.
