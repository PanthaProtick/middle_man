# Production seller sessions

Use one Clerk **production instance** for the frontend and API. The owner must
replace the example domains below with the actual deployed domains; they are
not an approved deployment or an acceptance record.

## Matching configuration

| Scope | Variable | Example / rule |
| --- | --- | --- |
| Frontend build | `VITE_CLERK_PUBLISHABLE_KEY` | Production instance's `pk_live_...` key |
| Frontend build | `VITE_API_BASE_URL` | `https://api.shop.example/api` |
| API runtime | `ENV` | `production` |
| API runtime | `CLERK_ISSUER` | `https://clerk.shop.example`, copied from that instance's Frontend API URL |
| API runtime | `CLERK_AUTHORIZED_PARTY` | `https://shop.example`, the exact seller frontend origin |
| API runtime | `CORS_ORIGINS` | `["https://shop.example"]` |
| API runtime | `CLERK_JWT_KEY` | Optional RSA public PEM from the same instance; otherwise keys come from issuer JWKS |
| API runtime | `CLERK_AUDIENCE` | Leave empty unless the session token explicitly has the matching audience |
| API runtime | `CLERK_PUBLISHABLE_KEY` | Optional; if set, use the same production key as the frontend |
| API runtime | `CLERK_SECRET_KEY` | Optional for the implemented JWT verification flow; never a frontend variable |

The current verifier accepts **one** authorized party. A second CORS origin does
not authorize sessions minted for that origin. Use the canonical seller origin;
redirect aliases there. Do not add wildcard previews or localhost to production.
Origin settings use HTTPS with no path, trailing slash, credentials, query, or
fragment. Do not copy a comma-separated origin list into `CLERK_AUTHORIZED_PARTY`.
Changing Vite variables requires rebuilding the frontend.

Only the publishable key belongs in `VITE_*`. Never expose Clerk secret or webhook
keys, database URLs, encryption keys, or payment secrets through public variables.
There is no implemented Clerk webhook workflow; do not register a webhook or
provision its signing secret just because an example mentions it.

Clerk documents the [session claims](https://clerk.com/docs/guides/sessions/session-tokens)
and [manual signature verification](https://clerk.com/docs/guides/sessions/manual-jwt-verification).
Here, signatures, expiration, issuer, configured audience, and authorized party
are checked before using `sub` as the seller identity. Missing `azp` is rejected
when the authorized party is configured, including production. Development tokens
and production identity dependency overrides are forbidden. Startup also checks
durable storage and independent application secrets; see
[production secrets](production-secrets.md).

## Hosted acceptance (ticket 09; not established by local tests)

Use two distinct production Clerk users and isolated synthetic shop/order data.
Record deployment revisions, exact origins, timestamps, and outcomes without tokens
or secrets.

1. Open the canonical seller URL signed out. Sign in through the embedded Clerk
   flow and confirm the seller's own shop loads. Refresh and confirm persistence.
2. Create an order and record its identifier privately. Sign out; confirm seller
   data disappears and subsequent private API requests without a bearer return 401.
3. Sign in as the second user. Confirm separate shop setup/data. Attempt reads and
   writes using the first user's order, transaction, and payment-account IDs;
   expect the same 404 response as nonexistent IDs, with no foreign data or mutation.
4. Return to the first user and confirm the attempted mutations had no effect.
   Exercise account switching and sign-out while a seller request is in flight;
   old responses must not populate the next session.
5. With a controlled test client, confirm expired, tampered, wrong-issuer, wrong-
   party, and development tokens return 401. Do not paste bearer tokens in logs.
6. Confirm direct buyer-link navigation works independently of Clerk sign-in.

The frontend keeps bearer tokens in memory, renews them through Clerk, and clears
seller request state at session boundaries. Sign-out removes local access; this
JWT verifier does not consult Clerk for immediate session revocation. A copied,
previously issued JWT can remain valid until its expiry. Static PEM verification
also requires an operator key-rotation update; JWKS discovery uses a process-local
key cache. Neither local tests nor configuration validation proves hosted DNS,
key alignment, browser cookie behavior, or PostgreSQL isolation.
