# Verification reference

Read this for a failed check, log interpretation, or browser/live acceptance.
Routine task commands are listed in root `AGENTS.md` and `package.json`.

## Results and logs

`npm run check` executes eight stages: tooling tests, backend lint/types/tests,
frontend lint/tests/build (including TypeScript), and HTTP smoke. It stops at the
first failure. `check:backend` and `check:frontend` use the same stage definitions.
Gates reject arguments so a filtered suite cannot be reported as a full pass;
use focused test commands while editing.

Every invocation prints its unique `.cache/checks/<run>/result.json` path before
running stages. That machine-readable result records timestamps, duration,
PASS/FAIL/RUNNING/NOT RUN states, log names, and failing exit codes. Each stage
prints PASS only after success; full stdout/stderr go to adjacent logs. Failures
print the last 16 KB with the full log path. Read the result for this invocation;
previous runs retain their own evidence, including when checks run concurrently.
An interrupted run can remain RUNNING and is incomplete, never a pass. Results
describe the files when executed; rerun relevant checks after subsequent edits.
CI retains only these result/log files as `verification-<os>` artifacts for seven
days, including failed runs. Workflow configuration alone does not prove CI passed.

Focused commands keep their normal output. Set `CHECK_VERBOSE=1` in the current
shell to print log tails for successful check stages too. Inspect a specific log
when its summary leaves uncertainty; avoid loading all logs into the conversation.
For check gates, API smoke startup diagnostics are adjacent to their stage log.
Standalone `npm run smoke` uses `.cache/smoke-api.log`.

The full gate retains strict Mypy, warning-failing pytest and frontend lint,
TypeScript, and production build checks. Successful output is compressed, not
the verification itself. `npm run audit:frontend` is a separate online dependency
audit and is outside the offline check.

## Acceptance boundaries

Backend tests clear provider inputs, isolate demo records, and reject external
socket connections. Loopback remains allowed for Windows asyncio. Frontend tests
replace fetch with an explicit test double. These are process safeguards, not an
operating-system network sandbox.

HTTP smoke starts an owned local API with empty provider inputs and disposable
in-memory records. It checks health, mock chat, create/list, validation, and the
built page/assets, then terminates its servers. It does not execute React in a
browser or prove live database, authentication, or Gemini behavior.

For changed UI, exercise the applicable success, loading, and failure states in
a browser. For authorized provider/deployment work, verify those integrations
separately. Report PASS, FAIL, BLOCKED, or NOT RUN with concise evidence and log
paths. An interrupted or timed-out stage has not passed.

## Comparing agent quality

Use [the comparison template](../../tasks/agent-evaluation-template.md) only when
evaluating agents. Hold starting files, acceptance cases, and model fixed while
comparing environment changes; then compare models with the environment fixed.
Record correctness, regressions, repair time, elapsed time, and available cost.
Repository check results do not establish improved model performance.
