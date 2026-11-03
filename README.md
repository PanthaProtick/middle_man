# Middleman

> Order confirmation, payment reconciliation, and delivery preparation for Bangladesh social-commerce sellers.

Middleman handles the work after a seller and buyer agree on a sale in chat.
Sellers create an order and share a buyer link, compare payment claims with recorded
receipts, and review the order before sending it to a courier. Buyers use a focused
mobile web portal to review the terms and submit their delivery and payment details.

Built with **React 19, TypeScript, and FastAPI**, with Bengali and English interfaces.
The workflow targets one confirmation operator per shop.

**Status:** Under development. Local checks and synthetic exercises do not establish
production readiness, live-provider reliability, or measured seller outcomes.

[Quickstart](#quickstart) · [Seller workflow](#seller-workflow) · [Configuration](#configuration) · [Documentation](#documentation)

## What you can do

- **Share an order instead of repeating its details.** Create agreed product,
  total, delivery advance, and receiving-account terms, then share a buyer link.
- **Collect buyer details in one place.** The `/orders/:token` portal supports
  delivery information, payment claims, and Bengali/English presentation.
- **Keep payment evidence and decisions clear.** Record received transactions,
  compare claims, resolve exceptions, and track the remaining cash-on-delivery amount.
  Reconciliation does not independently verify payments with a payment provider.
- **Find the next orders to work on.** Use attention and delivery-preparation views,
  search, date filters, and CSV exports.
- **Prepare courier handoffs.** Review Pathao settings, location choices, courier
  drafts, submission outcomes, and uncertain results. Written-address and manual
  resolution paths remain available.
- **Use guided seller assistance.** Create orders, record transactions, find work,
  and review payment issues. Guided writes require explicit confirmation; optional
  Gemini review wording is separate from local parsing and domain decisions.

## Quickstart

### Requirements

- **Node.js 22.12+**; the recorded version is in [`.node-version`](.node-version).
- **Python 3.12** and **uv**.
- **Git**, and network access for the initial dependency installation.

From the repository root:

```sh
npm run setup
npm run doctor
```

Setup installs locked backend and frontend dependencies and configures the
repository's Git hooks. No root `npm install` is needed.

Start the API:

```sh
npm run dev:backend
```

In a second terminal, from the same directory:

```sh
npm run dev:frontend
```

Open the [web app](http://localhost:5173) and
[interactive API docs](http://localhost:8000/docs).
Vite prints a different URL if port 5173 is occupied; update backend CORS and
Clerk's authorized origin if you use another origin.

**Expected without credentials:** the app opens to its landing page and signed-out
workspace, and the API serves local standby endpoints. This starts the application;
it does not provide an authenticated seller session or enable public buyer links.
For example, `GET /api/health` returns runtime status and configuration flags.

For setup failures, see [environment recovery](docs/agents/environment.md).

## Seller workflow

With seller authentication and the relevant storage/access configuration in place:

1. Set up the shop and its receiving-payment accounts.
2. Create an order with the agreed total and delivery advance; share its buyer link.
3. The buyer reviews the terms and submits delivery details and a payment claim.
4. Record received transactions and review reconciliation or payment exceptions.
5. Review delivery readiness and the courier draft, then explicitly submit when ready.
6. Resolve uncertain courier outcomes before attempting another submission.

Buyer claims, seller-recorded receipts, and seller decisions are distinct records.
The seller retains authority over exception acceptance and courier actions. See the
[API contracts](docs/API_CONTRACTS.md) for validation and lifecycle rules.

## Configuration

Environment files are optional for the credential-free start. For configuration,
use [`backend/.env.example`](backend/.env.example) and
[`frontend/.env.example`](frontend/.env.example) as references; create local `.env`
files without overwriting existing settings. Replace placeholders only for the
services you intend to configure, then restart the affected servers.

| Area | Configuration and boundary |
| --- | --- |
| API connection | `VITE_API_BASE_URL` defaults to `http://localhost:8000/api`; backend `CORS_ORIGINS` controls allowed browser origins. |
| Seller sign-in | Frontend `VITE_CLERK_PUBLISHABLE_KEY`; backend trusted `CLERK_ISSUER` and verifier settings, including the authorized frontend origin. Keys alone do not prove a working session. |
| Durable storage | PostgreSQL via `DATABASE_URL` or `PG*` settings, the required schema, `ORDER_LINK_ENCRYPTION_KEY`, and payment-marker protection. Durable mode checks readiness at startup. |
| Buyer links | Public access is denied by default. The implemented link-possession policy is restricted to local synthetic self-tests and requires durable storage and verified seller authentication. |
| Pathao | Account settings, credential encryption, location environment, and booking controls are separate concerns. Configuration is not evidence of a successful booking. |
| Optional AI | `REVIEW_GEMINI_ENABLED`, `GEMINI_API_KEY`, and `GEMINI_MODEL` control optional generated review wording. Self-test mode disables AI; public chat/idea demos remain local mocks. |

Keep private credentials on the backend. Vite exposes `VITE_*` values to the
browser, so those values must be public configuration.

The [self-test reference](docs/phase-1-self-test.md) describes the restricted
buyer-access policy and integration prerequisites. It is a historical plan, not a
completed acceptance report or a production deployment guide.

### Development boundaries

- Offline development and unit tests work without live-provider credentials.
  Development identity adapters and test overrides do not establish live authentication.
- Demo `/api/items` records always use process memory, even with a database URL.
  They disappear on restart and are not shared across workers. Seller workflow
  durability is a separate storage path.
- Legacy demo clients can simulate results after network failures; a simulated
  result does not prove a server write.
- Health/configuration flags and passing local checks do not prove hosted auth,
  PostgreSQL concurrency, live Gemini/Pathao behavior, or browser/device acceptance.

## Development commands

Run commands from the root so workspace wrappers preserve cache and lockfile handling.

| Command | Purpose |
| --- | --- |
| `npm run setup` | Install locked dependencies and configure Git hooks |
| `npm run doctor` | Check prerequisites and installed dependency metadata |
| `npm run check` | Run the full local verification gate |
| `npm run conventions` | Check file sizes, documentation links, and repository rules |
| `npm run typecheck` | Check Python and TypeScript types |
| `npm run lint` | Run backend and frontend linters |
| `npm run build` | Build the frontend |
| `npm run context` | List source paths for bounded code exploration |

For focused tests:

```sh
npm run test:backend -- tests/test_health.py
npm run test:frontend -- src/services/api.test.ts
```

The full gate covers tooling, conventions, lint, types, backend/frontend tests,
a production build, and local HTTP smoke. Each invocation records stage results
under `.cache/checks/<run>/result.json`, with adjacent logs. Browser, device,
PostgreSQL integration, hosted authentication, and live-provider acceptance are
separate checks; see [verification scope](docs/agents/verification.md).

## Project layout

```text
frontend/src/
  features/          Seller, buyer, assistant, locale, landing, and demo UI
  components/        Shared UI
  services/          Shared typed API helpers and legacy demo clients
backend/
  app/api/           Workflow routers
  app/models/        Pydantic request and response contracts
  app/services/      Domain rules, storage adapters, and provider integrations
  app/core/          Configuration, authentication, database, and token handling
  migrations/        SQL schema migrations
  tests/             Backend tests and integration harnesses
scripts/             Workspace commands and local verification
docs/                Architecture, contracts, and verification references
tasks/               Task and handoff templates
```

## Documentation

- [Product context](PRODUCT.md): audience, scope, and product principles.
- [Architecture](docs/ARCHITECTURE.md): module ownership, data flow, and storage boundaries.
- [API contracts](docs/API_CONTRACTS.md): orders, payments, buyer access, courier, and assistant workflows.
- [Repository conventions](docs/CONVENTIONS.md): file size, ownership, and work-storage rules.
- [Documentation index](docs/README.md): deeper references and historical evidence.

## Contributing

Read [AGENTS.md](AGENTS.md) and the relevant workflow contract before changing
behavior. Trace callers and tests, keep changes focused, and add regression
coverage for bugs and changed domain logic. Run focused checks while editing and
`npm run check` before handing off code; report failed, blocked, and unrun gates.
Use the [task template](tasks/task-template.md) for work spanning multiple sessions.

## License

No project license file is included. Reuse and redistribution terms have not been
specified; do not assume an open-source license.
