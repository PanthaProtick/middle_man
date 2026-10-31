# Production booking and manual trial

Status: In-Progress

- User explicitly requested real production courier booking, with manual submission.
- Existing checkout changes include seller UI/metrics work; preserve those edits.
- Enable production with an explicit default-off server flag. The flag requires
  durable mode, thereby enforcing startup checks and verified seller authentication.
- Preserve review/version/reservation safeguards, single-send transport and unknown
  outcome protection. Enable production lookup even after disabling new bookings.
- Correct production/sandbox labels and expose the server capability in settings.
- Manual instructions: [production trial](../../../../docs/pathao-production-trial.md).

## Verification

- Backend focused: 26 existing tests passed; 5 new production tests passed.
- Frontend focused: 21 passed after fixing the sandbox settings capability notice.
- Root check: PASS `.cache/checks/check-d9qn0O/result.json`: 604 backend passed,
  174 opt-in tests skipped; 494 frontend passed; tooling, conventions, lint, types,
  build and HTTP smoke passed. First run hit the Windows pytest temp permission
  issue; rerun used repository-local `PYTEST_ADDOPTS=--basetemp=...`.
- Real provider booking: not run; final submission belongs to the user.
- Durable startup: PASS against configured database: schema inventory, link key
  compatibility and payment marker protection verified. API healthy on port 8000.
- Local ignored backend configuration now enables production booking and production
  buyer locations. Existing keys/credentials preserved. User has production API
  access and a pickup store; credentials still need manual entry in the app.
- Browser: BLOCKED by repeated desktop window capture timeouts. No live provider
  connection or booking acceptance claimed.
- Startup initially failed when launching uvicorn without reload because Windows
  Proactor is incompatible with configured psycopg. The repository's normal reload
  startup uses Selector and passed. Owned reload launcher PID 21892; logs in
  `.cache/pathao-production-reload-error.log`.

## Next action

User connects production credentials, saves pickup/service defaults, creates and
confirms their intended order, reviews production delivery choices and manually submits.
Do not print secrets or create a production booking on the user's behalf.
