# Pathao merchant settings contract

Source review: 2026-10-26. Ticket: `.scratch/pathao-courier/issues/03-connect-seller-pathao-account.md`.

Seller settings are independent of receiving-payment accounts. Creating links and collecting orders
does not require a courier connection. The accounts section contains a separate Pathao settings panel.

## Management API

All routes derive the shop from the authenticated seller, never a body/query shop ID.
All responses, including errors, use `Cache-Control: no-store, private`.

Base: `/api/seller/courier/pathao/{environment}`, where environment is `offline`, `sandbox`, or `production`.

| Method | Operation |
| --- | --- |
| GET base | Read masked connection metadata, version, status and saved defaults; version 0 is disconnected. |
| PUT base | Verify and replace connection using `expected_version` and write-only `credentials` (`client_id`, `client_secret`, `username`, `password`). Offline setup omits credentials. Replacement clears defaults. |
| GET base/stores?expected_version=N | Fetch active merchant-owned pickup choices; reject a stale revision before and after lookup. |
| PATCH base | Save `default_store_id` and `default_delivery_type` (48 normal, 12 on-demand) with `expected_version`; re-fetch store membership before committing. |

Updates use optimistic versions rather than caching secret-bearing mutation payloads in idempotency
records. After an ambiguous save response, reload settings before retrying; a stale retry cannot overwrite
a newer revision. A disconnected settings read does not contact Pathao. Connected metadata describes
the last successful verification; reloading stores verifies access again and may report rejection/outage.
Service codes are defaults, not a promise of availability for a particular destination or merchant.

`0021_pathao_connections.sql` adds immutable revisions keyed by shop/environment/version. Writers lock
the shop only for the final compare-and-append transaction. Provider requests hold no database transaction
open. Changes never edit a courier draft, review or booking. Later booking work must bind to the exact
revision and environment, revalidate readiness, and keep production submission disabled.

## Secret handling and operation

Set `PATHAO_CREDENTIAL_ENCRYPTION_KEY` to a dedicated Fernet key: URL-safe base64 encoding of 32 random
bytes. Missing, malformed, reused authentication/link/payment keys, and incompatible ciphertext fail
with `PATHAO_KEY_UNAVAILABLE`. Offline fixtures need no key and reject credentials. Real credential
bundles are encrypted before persistence, including in standby memory. Secret input is excluded from
validation responses, and metadata returns only a fixed masked merchant hint. No raw provider errors
are returned or logged. Form values are cleared on submit, environment/session changes, and unmount;
the client does not persist credentials in browser storage.

Tokens are issued per lookup operation, used only in that operation and discarded, including refresh
tokens. No token cache, refresh grant, or token persistence exists in this ticket. This trades additional
authentication calls for a small lifecycle surface; provider limits must be checked during sandbox
acceptance before scaling. Key rotation requires an operator migration/re-encryption of retained
revisions; replacing the configured key alone intentionally makes old ciphertext unreadable.
Retention and erasure of superseded credential revisions belong to ticket 10.

## Owning-source review and limitations

Reviewed actual files in the candidate [SDK repository](https://github.com/mojnomiya/pathao-python):

- [client.py](https://github.com/mojnomiya/pathao-python/blob/main/pathao/client.py), Git blob `3bd1de274b011d820336d273db108b017589c1af`: requires four credential fields; supports sandbox/production. Its production host is `courier-api.pathao.com`, which conflicts with the merchant API documentation mirror's `api-hermes.pathao.com`. This remains a live-provider verification prerequisite.
- [modules/auth.py](https://github.com/mojnomiya/pathao-python/blob/main/pathao/modules/auth.py), blob `4502c022f9fe1e1ea26822db19a80cf122843077`: password/refresh grants POST to `/aladdin/api/v1/issue-token`; parses bearer token, expiry and refresh token. In-memory caching/refresh only; exception interpolation could propagate upstream text.
- [modules/store.py](https://github.com/mojnomiya/pathao-python/blob/main/pathao/modules/store.py), blob `0a72d57b5f8c677cf61e939e1f0b7fbef17e7bfe`: bearer-authenticated GET `/aladdin/api/v1/stores`; `page`/`per_page`, nested `data.data`, current/last page, store ID/name/activity fields.
- [http_client.py](https://github.com/mojnomiya/pathao-python/blob/main/pathao/http_client.py), blob `fa2f9420daab4e3ff1b4fddb0df5a4aa026712be`: synchronous requests, 30-second timeout, up to three retries including POST, blocking backoff, and exceptions retaining raw response data. Not adopted.
- [validators.py](https://github.com/mojnomiya/pathao-python/blob/main/pathao/validators.py): accepts service codes 12 and 48. This is an SDK-supported set, not provider certification.

The [merchant documentation mirror](https://hackmd.io/@saikat/HyX7Wa2eR) corroborates the sandbox host,
password/refresh grant payloads and endpoint paths, but is not an authoritative runtime result.
The application uses the mirror's `api-hermes.pathao.com` for production setup and the agreed sandbox
host for sandbox. Neither host's acceptance has been tested here with merchant credentials.

The application adapter uses existing async HTTPX, TLS verification, fixed hosts, no redirects,
no environment proxies and no retries. Each I/O phase has an 8-second timeout (4-second connect),
and the complete authentication/pagination operation has a 20-second deadline. Pagination is capped
at 20 pages of 100 stores. Malformed/inconsistent or oversized responses fail closed. These bounds
can reject unusually large merchant accounts rather than silently accepting incomplete authority.
Offline store IDs are deterministically shop-specific and visibly simulated.

Verified locally: API fixtures, simulated transport, component behavior and disposable PostgreSQL.
Not verified: live Pathao authentication, refresh behavior, production host compatibility, sandbox
merchant stores, destination/service availability, or any external booking. No booking API is exposed.
