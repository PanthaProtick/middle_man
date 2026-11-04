# Hosted development on Vercel

Use this profile for the isolated `submission-demo` demo with verified Clerk
development sessions, durable Neon storage, live Gemini and real Pathao production
bookings. It is an explicit alternative to `ENV=production`, not a self-test or
disposable Preview. This work configures the application only; no deployment,
migration, provider call or booking is performed by local verification.

## Deployment configuration

Use a dedicated pair of Vercel projects, with root directories `frontend` and
`backend`, following [Vercel deployment](vercel-deployment.md). Use stable HTTPS
frontend/API aliases. Enter the variables from
[`backend/.env.hosted-development.example`](../backend/.env.hosted-development.example)
and [`frontend/.env.hosted-development.example`](../frontend/.env.hosted-development.example)
in those projects' **Production** scope only. Do not change a real production
project to this profile or share its secrets. Vercel supplies `VERCEL_ENV`; leave
system variables enabled. Ordinary Preview builds retain their existing isolated,
offline defaults and cannot enable this backend profile or real bookings.

`ENV=hosted-development` selects the backend profile. `VITE_APP_ENV=hosted-development`
explicitly permits a development publishable key in the optimized frontend build;
it requires a nonempty `pk_test_*` key and still mounts Clerk. These two settings
must be paired. Rebuild after frontend variable changes. Unlabelled and production
seller builds still require `pk_live_*`; `ENV=production` still rejects development
Clerk credentials and issuers.

## Database and secrets

Set frontend `VITE_API_BASE_URL` to the absolute API URL including `https://`
and its `/api` prefix (for example `https://demo-api.vercel.app/api`). Rebuild
the frontend after changing it. Health, seller requests (including exports and
session refresh retries), buyer submissions and location lookups all use this
configured destination. With no configured base, product requests retain relative
`/api` paths for the local Vite proxy.

If health works but shop setup fails, inspect the browser's shop request URL.
It must target the API domain, not the frontend's SPA fallback. A cached HTML
response from the frontend is not an authenticated API response; do not disable
Clerk verification or widen CORS to work around incorrect routing.

In Neon, select the intended project and the **`submission-demo` branch**, database
and runtime role before copying its pooled TLS connection string to `DATABASE_URL`.
Verify the branch-to-endpoint mapping in the console. A database name such as
`neondb` does not identify a Neon branch; the application cannot prove branch
ownership from a URL. Use an empty/schema-only branch without copied customer data
and a restricted runtime role. Audit inherited Vercel variables and Neon integration
settings so neither project receives the primary branch's credentials or a fallback
`PG*` connection. Do not grant the runtime role migration privileges.

Apply the repository migrations separately using that same branch's **direct**
endpoint and a migration identity. Follow [database initialization](database-initialization.md),
including its target confirmation. The confirmation names the database, not the
Neon branch, so independently check the endpoint. Keep `DIRECT_URL` out of runtime.
No build or startup migration is added. Missing/incompatible storage fails closed;
there is no hosted memory fallback.

Generate fresh stable, independent demo secrets using the formats in
[production secrets](production-secrets.md): link and courier keys are Fernet keys;
the payment marker secret and `CRON_SECRET` need strong random values. Preserve them
across redeploys to retain buyer links, encrypted courier credentials and used-payment
protection. Startup checks schema, secret independence, link-key compatibility and
payment-marker compatibility just as production does. Shared PostgreSQL admission,
shop ownership and existing transaction/idempotency rules remain active.

## Clerk and live services

Use one dedicated Clerk **development instance** for both projects. Copy its
Frontend API URL to `CLERK_ISSUER` and its publishable key to both templates.
`CLERK_SECRET_KEY` is optional for the existing JWT verification flow; if supplied,
keep it in the backend only. A bare secret key never establishes session trust.
Use the exact frontend HTTPS origin for `CLERK_AUTHORIZED_PARTY` and `CORS_ORIGINS`,
without paths, trailing slashes, localhost or wildcards. Configure that origin and
sign-in/out URLs in Clerk. Session signatures, issuer, expiry and authorized party
remain verified. Mock/dev bearer tokens and dependency identity overrides remain
forbidden. Development Clerk keys do not mean mock authentication.

Keep `SELF_TEST_MODE=false`; it is incompatible with this profile and disables AI.
Supply a valid backend-only `GEMINI_API_KEY`, the desired available `GEMINI_MODEL`
and `REVIEW_GEMINI_ENABLED=true`. Existing AI data boundaries and seller confirmation
requirements remain active; AI output cannot authorize writes. Never put provider
secrets in `VITE_*` variables.

The template explicitly accepts the existing buyer possession-of-link policy using
`PRODUCTION_BUYER_ACCESS_POLICY=link_possession`; leaving it empty disables public
buyer access. This never grants seller authority or exposes buyer identity.

For real Pathao operations, keep `PATHAO_LOCATION_ENVIRONMENT=production` and
`PATHAO_PRODUCTION_BOOKING_ENABLED=true`, then connect the intended shop's production
merchant account through authenticated Accounts settings. Merchant credentials stay
encrypted per shop. Follow [Pathao production trial](pathao-production-trial.md) for
store/service selection and readiness. A reviewed, confirmed order and the seller's
explicit **Submit booking to Pathao production** action are still required. Review,
Gemini advice and saving a draft never create bookings. Unknown outcomes require
reconciliation, not an automatic create retry. Turning the booking flag off stops
new bookings without disabling durable storage or recovery of existing attempts.

## Verification boundary

Run `npm run check` locally. Tests use synthetic signed sessions and mocked providers;
they must not use Neon credentials, deploy or create bookings. Hosted TLS/routing,
Clerk sign-in and cross-shop denial, Neon permissions/schema/redeploy persistence,
Gemini availability and Pathao host/merchant compatibility require later authorized
acceptance. A successful local check or health response does not prove these.
Keep actual booking acceptance separate and explicitly authorized.

Platform references checked 2026-11-04:
[Vercel environment scopes](https://vercel.com/docs/deployments/environments),
[Clerk development instances](https://clerk.com/docs/guides/development/managing-environments),
[Neon branch connections](https://github.com/neondatabase/website/blob/main/content/docs/manage/branches.md).
