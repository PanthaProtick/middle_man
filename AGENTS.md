# Agent instructions

## Work loop

- Before editing, trace the relevant code, callers, contracts, and tests. Identify
  acceptance cases, assumptions, and architectural trade-offs; challenge weak fixes.
- Make one testable behavior work at a time. Preserve unrelated code, comments,
  and checkout changes. Add regression tests for bugs and success/failure cases
  for changed endpoints or domain logic; keep meaningful existing assertions.
- Decompose broad visual or architectural changes into bounded feature clusters.
  Run focused test commands after each feature cluster before modifying subsequent
  files or screens.
- After two failures with the same hypothesis, gather new evidence and revise it.
  Escalate an unresolved decision with a reproducer and the remaining uncertainty.
- Use focused tests while editing. Before completing code or tooling changes, run
  root `npm run check`. Report actual results and any failed, blocked, or unrun gates.
  Mock tests and HTTP smoke do not prove browser or live-provider behavior.

## Repository invariants

- Backend: FastAPI, typed Python, Pydantic v2 request/response contracts; tests in
  `backend/tests/`. Frontend: strict TypeScript, explicit payload/prop types, no
  `any`; feature-specific UI, hooks, types, and tests in `frontend/src/features/`.
- Source files: review at 250 physical lines, 300 maximum. Tests follow the same
  rule; only narrow documented cohesive-scenario or fixture exceptions may exceed
  300. Decompose by responsibility, not by compressed formatting. Documentation
  reviews at 250 and splits by topic without rewriting historical records.
  Ownership, exception, and storage details: [conventions](docs/CONVENTIONS.md).
- Development and unit tests support offline standby behavior without live
  credentials. Current item routes use process memory; Clerk settings alone do
  not implement authentication. Configuration flags do not establish readiness.
- Code and executable checks are ground truth. Keep this file below 200 lines;
  put task history in task records and detailed references in `docs/`.

## Context discipline

- Codex and Antigravity share this file and `.agents/skills/`. Read only the
  matching skill; adapt host-specific tools to the active harness. Imported
  workflows do not change repository contracts or authorize external actions.
- Start with `git status --short` and scoped `rg` searches. `npm run context`
  lists source paths; `npm run context -- <file> "<file>#L10-L40"` emits bounded,
  numbered text for handoffs. Follow callers and tests before choosing an edit.
- Navigation discipline: mandate bounded line-range queries for large files and
  prohibit consecutive redundant reads of identical files in a single turn.
  Establish a target inventory before inspecting leaf components.
- Keep conventions intact; reduce retrieved material, not verification coverage.
  Read failure tails and relevant files instead of dumping lockfiles, all skills,
  generated assets, or entire logs. Never include real environment/credential files.
- Before a handoff or context reset, update the existing ticket with decisions,
  changed paths, exact checks/results, unresolved risks, and the next action.
  Resume by checking the current diff and evidence; summaries are not ground truth.

## Execution and orchestration guardrails

- Subagents: Pass base commit, changed paths, and acceptance targets, then yield
  the turn. Never run sleep timers (`schedule`) or call status tools such as
  `manage_task` and `manage_subagents` while waiting; both Codex and Antigravity wake
  you automatically on completion.
- Background tasks: After starting a background test or verification run, yield the
  turn and wait for its completion event. Never poll status with tools such as
  `manage_task` or `manage_subagents`, and never run sleep timers while waiting.
  While the run is active, send no interim progress messages or partial summaries;
  read the output and deliver one report once that event arrives.
- Windows PowerShell: Use PowerShell-compatible syntax (comma-separated lists
  `file1, file2` instead of bash braces `{file1,file2}`). Write scratch Python to
  ignored `.cache/` with UTF-8 instead of nested inline quotes (`-c "..."`).
- Context and diffs: Run `git diff --stat` before full diffs; scope diffs to
  target files. Bound large reads with `StartLine`/`EndLine` or `npm run context` to avoid truncation.
- Testing tier: Use focused test commands (`npm run test:backend`,
  `npm run test:frontend`) during inner iteration; run root `npm run check` strictly
  as the final pre-handoff verification gate.

## Commands (workspace root)

Use root wrappers to preserve cache and lockfile handling:

- `npm run check`: tooling, repository conventions, lint, strict types, tests,
  build, and HTTP smoke.
- `npm run conventions`: low-cost size, scratch, documentation link, and command checks.
- `npm run test:backend -- tests/<file>.py` or
  `npm run test:frontend -- src/<path>.test.ts`: focused iteration.
- `npm run typecheck`: check both applications' types.
- `npm run doctor`: diagnose prerequisites; `npm run setup`: install locked dependencies.

Other commands are discoverable in `package.json`. Successful checks print short
summaries and a fresh `.cache/checks/<run>/result.json` path; adjacent logs hold
full output. Gates reject filters; use the focused test commands during iteration.

## Context and task records

Read only references needed for the current decision:

- Setup, dependency, or cache failures: [environment recovery](docs/agents/environment.md).
- Verification failures, browser/live acceptance, or log interpretation:
  [verification reference](docs/agents/verification.md).
- Architecture/state changes: [architecture](docs/ARCHITECTURE.md).
- API/client changes: [contracts](docs/API_CONTRACTS.md) and its domain annexes.
- Size, ownership, and work-storage rules: [conventions](docs/CONVENTIONS.md).
- Resumable or multi-session work: use [the task template](tasks/task-template.md).
  Small changes need no separate plan file. Update an existing ticket instead of
  duplicating its status. Load imported skills only when relevant to the task.
- Issue tracker operations: [local tracker](docs/agents/issue-tracker.md);
  triage status: [labels](docs/agents/triage-labels.md);
  domain terminology/ADRs: [domain conventions](docs/agents/domain.md).
