# Vercel projects and preview isolation

Ticket 05 prepares configuration only. No account, DNS, plan, migration, or hosted
deployment is changed by this work. Hosted acceptance remains ticket 09.

## Two projects from one repository

| Setting | Frontend project | API project |
| --- | --- | --- |
| Root Directory | `frontend` | `backend` |
| Framework | Vite | FastAPI |
| Runtime | Node.js 22.x | Python 3.12.x |
| Install | `npm ci` | `uv sync --locked --no-dev` |
| Build | `npm run build` | Framework default; no migration/build override |
| Output | `dist` | Framework-managed function |
| Entry | `index.html` | `app.main:app` via `pyproject.toml` |

Import the same repository twice after separate owner authorization. Keep both
project roots as above; the per-root `vercel.json` files are independent. Do not
add legacy `builds`/`routes` overrides or a second FastAPI application. Commit
`frontend/package-lock.json` and `backend/uv.lock`; dependency changes require
lockfile regeneration. The backend install rejects stale locks and excludes dev
dependencies. Direct runtime imports of cryptography, Pydantic, and Starlette are
declared explicitly. Python minor and Node major are pinned; hosting supplies
patch/security updates. Local development may use a newer compatible Node runtime.

The frontend catch-all rewrite serves `index.html` for `/orders/:token`, including
refreshes. Existing static assets retain Vercel filesystem precedence. The API
project keeps `/api/...` routes; there is no frontend API proxy in production.
Set `VITE_API_BASE_URL` to the exact API HTTPS origin **plus `/api`** before building.
Changing it requires a rebuild. Never use a deploy-specific API URL for permanent
buyer links; the browser creates buyer links from its own frontend origin.

## Environment scopes and credentials

Use the matching `.env.production.example` and `.env.preview.example` in each
project directory as variable inventories, not ready-to-use credentials. Vercel
does not load these example files automatically. Enter values in the appropriate
project and Production or Preview scope. Do not upload `.env` files. Vercel supplies
`VERCEL_ENV`; leave system environment variables enabled and do not override it.

- Production backend: `ENV=production`, a verified durable database target,
  independent stable link/payment/encryption keys, and matching live Clerk issuer.
  Read [secret requirements](production-secrets.md) and
  [session trust](production-seller-sessions.md). Keep the direct migration
  credential out of runtime. Buyer access stays disabled until explicitly enabled
  with `PRODUCTION_BUYER_ACCESS_POLICY=link_possession`.
- Production frontend: only public `VITE_API_BASE_URL` and Clerk publishable key.
  The live key must match the backend issuer's instance. Backend secrets belong
  only in the API project, never under a `VITE_` prefix, build arguments, or logs.
- Preview defaults: no database, secrets, live providers, or buyer-link access.
  These previews are disposable demos, with process-local state that may vanish.
  They do not establish durable or hosted acceptance.
  Vite embeds only Vercel's public `VERCEL_ENV` label to distinguish optimized
  preview bundles from production. Preview bundles permit development Clerk keys
  and credential-free demos; production and unlabelled optimized builds continue
  to require a live key for seller pages.
- For an authenticated synthetic preview, provision an independent **empty**
  database/role with no production grants and a separate Clerk development
  instance. Do not clone production customer data. Set `SELF_TEST_MODE=true`,
  `PUBLIC_BUYER_ACCESS_POLICY=self_test_link_possession`, isolated stable secrets,
  database URL, and the preview instance's issuer/publishable key. Use synthetic
  data only. Readiness still requires the isolated schema and independent secrets.
  Keep courier booking and Gemini disabled.

Never give preview builds production write credentials, production secrets,
production API URLs, or roles that can reach production schemas. Audit inherited
team variables, integrations, branch overrides, and all `PG*` alternatives before
enabling previews. The startup guard rejects production mode, real courier booking,
and database access without explicit self-test mode in Vercel previews. It cannot
identify the owner of a database URL: resource permissions and scope separation
are mandatory even when self-test mode is enabled. Production Vercel deployments
must use `ENV=production` and therefore retain fail-closed readiness checks.

Use one stable preview frontend alias and paired preview API, or explicitly scope
a pair per branch. Configure its exact HTTPS frontend origin in preview
`CORS_ORIGINS` and `CLERK_AUTHORIZED_PARTY`. Random deployment URLs are not trusted
automatically. Configure production with only its exact frontend origin; never
add `*.vercel.app`, regex origins, or arbitrary previews. CORS is browser policy,
not authorization; Clerk token verification remains mandatory for seller writes.
The single authorized party is intentional even if CORS contains several entries.

## Owner decisions before setup

Record the following for **both** projects before any remote setup:

| Decision | Required owner-supplied value |
| --- | --- |
| Ownership | Vercel team/account, project names, repository access |
| Git | Production branch (do not assume the current branch), preview branch policy |
| Domains | Stable production frontend/API and isolated preview frontend/API |
| DNS | Registrar, owner authority, Vercel-provided DNS records and TLS validation |
| Region | Function region near the chosen database; verify availability on plan |
| Plan | Commercial-use eligibility, Python bundle size, memory, duration, concurrency, spend limits |
| Protection | Preview access protection and ability of the frontend to call its API |
| Clerk | Matching instance/key/issuer per environment; allowed origins and sign-in/out URLs |
| Database | Verified project/branch/role and schema; migration identity held separately |

Do not purchase plans or configure accounts as part of ticket 05. Set the selected
function region in API project settings only after approval; no arbitrary region
is committed here. Check current platform limits rather than assuming Hobby is
suitable for commercial traffic. Keep real Pathao booking disabled. Serverless
concurrency, database lifecycle, global admission controls, and retention are
separate tickets; configuration flags do not establish their readiness.
Shared public admission is implemented as documented in
[the admission operator guide](public-admission.md); deployed enforcement still
requires ticket 09 acceptance.

## Local verification and hosted acceptance

Local checks import the configured ASGI entry, request `/api/health`, exercise
allowed/foreign-origin preflights, reject unsafe preview configuration, inspect
the SPA fallback and template defaults, and run the normal production build.
They do not emulate Vercel's router, Linux packaging, DNS, TLS, or Clerk sessions.
An isolated Windows environment was also installed with `uv sync --locked --no-dev`;
the configured app imported, ran its offline lifespan, and served health without
pytest installed. This verifies the local production dependency graph, not the
hosted Linux bundle.
`/api/health` alone is not proof of database readiness or authenticated workflows.

Ticket 09 must verify actual Vercel build/install logs (without secrets), runtime
version, lockfile use, function bundle/native imports and size, lifespan startup,
duration/region settings, static asset precedence, and direct buyer-link load and
refresh. Verify API HTTPS and CORS with allowed and foreign origins, real Clerk
sessions and wrong-instance rejection, independent preview data/credentials,
redeploy persistence, deployment protection, and failure recovery. Do not invite
real users based on local checks or deployment success alone.

Primary platform references, consulted 2026-11-04:
[FastAPI](https://vercel.com/docs/frameworks/backend/fastapi),
[Python runtime and packaging](https://vercel.com/docs/functions/runtimes/python),
[Vite SPA fallback](https://vercel.com/docs/frameworks/frontend/vite),
[monorepo projects](https://vercel.com/docs/monorepos).

See [cross-instance durability](cross-instance-durability.md) for database/session
ownership, process-local coordination limits, and local PostgreSQL evidence.
