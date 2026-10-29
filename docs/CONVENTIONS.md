# Repository conventions

Authoritative source for file-size, ownership, and work-storage rules. Root
`AGENTS.md` keeps the working loop concise and links here for detail.

## Source and test size

- Review application and tooling source at **250 physical lines**. Decompose a file
  by responsibility before it reaches **300**; do not compress formatting to evade
  the count.
- Source scope: `backend/app`, non-test `frontend/src`, and `scripts`.
- Tests follow the same 250 review / 300 maximum rule. Scope: `backend/tests`,
  `frontend/src/**/*.test.*`, and `scripts/*.test.mjs`.
- A narrow exception is allowed only for a test that is one cohesive behavioral
  story or fixture whose split would duplicate setup or hide transitions. Record
  the reason and owning ticket, and add it to `sizeExceptions` in
  `scripts/conventions.mjs`. Source files get no 300-line exception.
- Migrations are immutable history. Size rules do not apply and migration order is
  never rewritten as housekeeping.

## Documentation

- Review a documentation file at **250 physical lines** and split it by topic when
  navigation or ownership suffers. This is a review trigger, not a hard maximum.
- Historical specifications, completed work records, and design records stay
  truthful history. Do not rewrite them only to satisfy a count. Add a dated note
  when a later decision supersedes current guidance; correct a stale setup claim in
  place when leaving it would misdirect current work, preserving the historical
  decision in the text.
- Maintained contract indexes link domain annexes instead of one growing file.

## Ownership boundaries

- Backend routes stay under `backend/app/api/`, request/response models under
  `backend/app/models/`, orchestration and domain rules under
  `backend/app/services/`, and configuration/auth/database seams under
  `backend/app/core/`. Migrations remain in `backend/migrations/`.
- Frontend UI, hooks, feature types, and colocated tests stay under
  `frontend/src/features/<feature>/`. Shared HTTP types live with the owning
  feature or `frontend/src/services/`.
- Workspace commands belong in `scripts/` and are exposed through root
  `package.json`. Preserve the cache and lockfile handling in the existing
  wrappers.

## Work records and execution output

- `.scratch/<feature>/` holds Markdown specifications, issues, indexes, acceptance
  notes, and contract annexes. Completed records stay in place.
- Do not track logs, screenshots, JSON command results, generated probes, previews,
  or temporary scripts in `.scratch/`. Disposable execution output belongs in
  ignored `.cache/`; reusable historical verification evidence belongs in
  `docs/verification/`.
- Operational tools belong in maintained `scripts/`; one-off destructive scripts do
  not stay loose in scratch.
- A task file in `tasks/` is only for resumable or multi-session work. It links to
  evidence instead of copying successful output.

## Enforcement

`npm run conventions` checks the low-cost structural rules. Root `npm run check`
runs it as the **Repository conventions** stage after tooling tests.

- Tracked `.scratch/` files must end in `.md` (Git tracked files only).
- Source/test files above 300 lines fail unless a documented test exception exists.
  Files at 250-299 lines are reported as review triggers, not failures.
- Relative links in `README.md`, `AGENTS.md`, `docs/**/*.md`, and `tasks/**/*.md`
  must resolve. External URLs, anchors, and `.scratch` history are not fetched or
  checked.
- `npm run <script>` references in those maintained documents must name a script in
  root `package.json`.

The check does not prove browser behavior, live providers, semantic contract
correctness, or that a reviewed file has good cohesion. Historical `.scratch`
links and copied command transcripts are intentionally outside its scope.
