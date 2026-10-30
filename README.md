# Dev Template

A React and FastAPI starting point for developers building full-stack prototypes with Codex or Antigravity.

Dev Template brings a typed frontend, validated API contracts, local mock Gemini demos, and a shared verification command into one workspace. Start locally without cloud credentials, then replace the demo behavior with your application's domain logic.

## What's included

- **React 19 + TypeScript:** Vite development server, strict types, and feature folders for UI and related tests.
- **FastAPI + Pydantic v2:** Typed Python endpoints with interactive API documentation.
- **Working demos:** Gemini chat, structured idea generation, and item creation/listing.
- **Checks from the root:** Tooling tests, repository conventions, Ruff, Mypy, pytest, Oxlint, Vitest, production build, and local HTTP smoke.
- **Agent guidance:** Shared rules in [AGENTS.md](AGENTS.md), focused references in `docs/`, and resumable task templates.
- **GitHub Actions:** The same setup and verification commands on Windows and Ubuntu for pushes and pull requests targeting `main` or `master`.

This is a development template. Item persistence and authentication still need implementation before use in a deployed application.

## Quickstart

Install **Node.js 22.12+**, **Python 3.12+**, and **uv**, then open a terminal in the project root. The recorded Node version is in [`.node-version`](.node-version).

```sh
npm run setup
npm run doctor
```

Setup installs dependencies from `backend/uv.lock` and `frontend/package-lock.json` and requires network access. No root `npm install` or cloud credentials are needed.

Start the backend:

```sh
npm run dev:backend
```

In a second terminal, also at the project root:

```sh
npm run dev:frontend
```

Open the [app](http://localhost:5173) and [interactive API docs](http://localhost:8000/docs). Public chat and idea-generation demos always return local mock responses, including when Gemini credentials are configured, and consume no provider quota. Vite prints the actual frontend URL if port 5173 is occupied; a different origin may require updating backend CORS settings.

To verify the workspace:

```sh
npm run check
```

A successful run prints a PASS summary for each stage and a unique `.cache/checks/<run>/result.json` path. The result records reached and skipped stages; adjacent files retain full logs. See [environment recovery](docs/agents/environment.md) if setup or prerequisite checks fail.

## Try the demo

| App tab | What to try | Expected behavior without credentials |
| --- | --- | --- |
| Gemini Playground | Send a chat message or generate a project pitch | Mock chat and a structured sample idea |
| Data & Storage | List items and create an item | API records kept in memory until the backend restarts |
| Stack Runbook | Read local setup instructions | Reference commands and configuration guidance |

The API exposes these routes under the default `/api` prefix:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Runtime status and provider configuration flags |
| POST | `/api/chat` | Local mock chat response |
| POST | `/api/generate-idea` | Local structured sample idea |
| GET | `/api/items` | List demo items |
| POST | `/api/items` | Create a demo item |
| GET | `/api/team` | Sample team roster |

For request and response schemas, use the running API docs. See [API contracts](docs/API_CONTRACTS.md) for conventions and demo boundaries.

## Configuration and limits

Environment files are optional for the local standby demo. To customize settings, copy [`backend/.env.example`](backend/.env.example) to `backend/.env` and [`frontend/.env.example`](frontend/.env.example) to `frontend/.env`, preserving any existing files. Restart the affected development server after changing configuration.

| Setting | Location | Current role |
| --- | --- | --- |
| `PROJECT_NAME` | Backend | API title and health response; defaults to `Dev Template API` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Backend | Shared settings reserved for the later seller review assistant; public demos remain local mocks |
| `DATABASE_URL` or individual `PG*` fields | Backend | Configure the optional SQLAlchemy/asyncpg database layer |
| `DIRECT_URL` | Backend | Reserved configuration; no migration workflow is included |
| `CLERK_*` | Backend | Configuration scaffolding; authentication is not enforced |
| `CORS_ORIGINS` | Backend | Allowed browser origins |
| `VITE_API_BASE_URL` | Frontend | API base URL; defaults to `http://localhost:8000/api` |
| `VITE_CLERK_*` | Frontend | Configuration scaffolding; no sign-in flow is implemented |

Keep private credentials in backend environment settings. Vite exposes `VITE_*` values to the browser; use them only for public configuration.

Before extending the template, account for these boundaries:

- **Items are temporary.** Routes use process memory even with a database URL configured. Records disappear on restart and are not shared across worker processes.
- **Clerk keys do not secure routes.** Token validation, authorization, and sign-in flows require implementation. Example webhook settings do not imply a working webhook endpoint.
- **Fallbacks can conceal failures.** The frontend can return simulated results when API requests fail, including item creation. A displayed item does not prove a server write.
- **Badges describe configuration.** A provider shown as connected or ready does not establish a successful provider call, durable storage, or authentication enforcement.
- **Checks have a defined scope.** The HTTP smoke checks local API behavior and built assets. It does not exercise React in a browser or validate live providers or a deployment.

## Everyday commands

Run these from the project root so the wrappers preserve cache and lockfile handling.

| Command | Purpose |
| --- | --- |
| `npm run setup` | Install locked backend and frontend dependencies |
| `npm run doctor` | Check prerequisites, backend package metadata, and the local TypeScript executable |
| `npm run context` | List source paths; append paths or quoted `path#L10-L40` ranges for bounded context |
| `npm run check` | Run the complete local verification gate |
| `npm run conventions` | Check source/test sizes, tracked scratch Markdown, documentation links, and root commands |
| `npm run test` | Run tooling, backend, and frontend tests |
| `npm run lint` | Run backend and frontend linters |
| `npm run typecheck` | Check Python and TypeScript types |
| `npm run build` | Build the frontend for production |
| `npm run smoke` | Check local HTTP behavior; requires a frontend build |
| `npm run audit:frontend` | Run the separate online frontend dependency audit |

For focused iteration:

```sh
npm run test:backend -- tests/test_health.py
npm run test:frontend -- src/services/api.test.ts
```

## Project layout

```text
backend/
  app/api/           API routes
  app/core/          Settings and optional database layer
  app/models/        Pydantic request and response schemas
  app/services/      Gemini integration and standby behavior
  tests/             Backend tests
frontend/
  src/components/    Shared UI
  src/features/      Gemini and item feature slices
  src/services/      Typed API client and fallbacks
scripts/             Workspace commands and HTTP smoke
docs/                Architecture, contracts, and agent references
tasks/               Task and evaluation templates
AGENTS.md            Shared working rules for coding agents
```

## Contributing and adapting

Read [AGENTS.md](AGENTS.md) before making changes. Trace the relevant contracts and callers, keep changes focused, and add meaningful tests when changing behavior. Run `npm run check` before handing off code; record failed, blocked, and unrun gates explicitly.

Use the [architecture guide](docs/ARCHITECTURE.md) for module boundaries, the
[repository conventions](docs/CONVENTIONS.md) for size and work-storage rules, the
[verification reference](docs/agents/verification.md) for acceptance limits, and the
[task template](tasks/task-template.md) when work needs a handoff or multiple
sessions. Replace sample domain content and the team roster as you adapt the template.

## License

No project license file is included. Choose and add a license before distributing the template under specific reuse terms.
