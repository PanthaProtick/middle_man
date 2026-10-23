# Environment recovery

Read this reference for setup, dependency, or cache failures. Routine coding uses
root commands in `AGENTS.md`; verification details are in [verification.md](verification.md).

## Prerequisites and setup

Use Node 22.12+ (Node 22 LTS is recorded in `.node-version`), Python 3.12, and uv.
`backend/.python-version` selects Python 3.12 for uv, matching CI and Mypy.
From the workspace root, run `npm run doctor`. On a fresh machine or after
incomplete dependency installation, run `npm run setup`, then repeat doctor.

Setup uses `backend/uv.lock` and `frontend/package-lock.json`. A fresh install
needs network access. `npm ci` replaces frontend dependencies; uv rejects stale
lockfiles instead of silently updating them. No root npm installation is needed.
Doctor checks prerequisite versions, lockfiles, the installed backend interpreter
and package metadata, and the local TypeScript executable. It runs no sync/install
or application imports and needs no cloud credentials. It does not prove package
integrity or application behavior; the full check does the behavioral verification.

## Cache and copied-environment failures

Root backend commands default to `.cache/uv`; npm uses `.cache/npm`. Explicit
`UV_CACHE_DIR` / `npm_config_cache` overrides take precedence. If an override is
inaccessible, clear or correct it in the current shell. Keep secret values out of logs.

If this template was copied with an old virtual environment, recreate its local
dependencies through setup before debugging application code. Check whether Git
is available before relying on branches or diffs; a template folder may not be a checkout.

## Antigravity discovery problems

Antigravity documents root `AGENTS.md` and `.agents/skills/` discovery. Keep the
root file as the shared rule source rather than duplicating it in `GEMINI.md`.
If discovery is in doubt, ask the installed agent to identify the rules and skill
paths it loaded. Repository file presence alone does not establish runtime discovery.

Official references: [rules](https://www.antigravity.google/docs/rules/) and
[skills](https://www.antigravity.google/docs/skills/). Imported skills are managed
separately; this environment setup does not alter them.

## Supplying context to either harness

Run `npm run context` for a bounded source map, then select the relevant callers,
contracts, and tests with `npm run context -- <path> "<path>#L10-L40"`. Complete
files preserve their text; ranges show original line numbers and total lines.
The command prints to stdout and creates no report. It rejects output over 24 KB
before emitting file content; select fewer files or narrower ranges to continue.
This is a byte budget, not an estimate of a model's remaining context window.

Common credential files, dependencies, caches, binary content, and paths or linked
targets outside the workspace are refused. This is not a secret scanner: review
selected source before sending it outside your trusted harness. Real `.env` files
stay private; `.env.example` can describe required settings. Normal scoped `rg`
and file reads remain available; use a specific stage log for verification failures.

Keep `AGENTS.md` as the only shared rule source and imported skill bodies on demand.
Avoid generating a second context summary that can drift from source. Host model,
permission, compaction, and MCP settings remain user choices; this template does
not impose global harness settings or require an API key for its local checks.

Codex references: [instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
and [skills](https://learn.chatgpt.com/docs/build-skills).
