# Buyer Pathao destination collection

Ticket 04, source review and local verification: 2026-10-26. Booking remains disabled.

`GET /api/public/orders/{portal_token}/pathao-locations` returns cities; `?city_id=N`
returns that city's zones; `?city_id=N&zone_id=M` returns that zone's areas. IDs are
positive integers; zones require a city. Every parent is checked against its own
catalog. The existing public gate, ingress quota, bearer-link revocation, retention,
expiry and unsubmitted-order policy apply, including before serving cached results.
No merchant credentials, settings, shop identifiers or personal data are returned.
Responses are private/no-store, including failures. This is a fixed catalog interface,
not an arbitrary URL/path proxy.

The server selects `PATHAO_LOCATION_ENVIRONMENT` (`offline` by default, `sandbox`,
or `production`). Only that shop's connection in that environment is used; no
automatic environment switching or shared merchant credentials. Offline choices are
visibly simulated. A missing connection returns `condition: disconnected` and an
empty list. Provider/auth/key/format failures return `unavailable` and an empty list.
Invalid known relationships return 422 `PATHAO_LOCATION_INVALID`.

Catalog results use a process-local LRU cache: 128 entries, five-minute TTL, maximum
5000 entries per list and 1 MiB upstream response. Keys include shop, environment,
connection revision, level and parent ID. Failures are not cached. A four-operation
semaphore bounds upstream concurrency; each lookup has an eight-second deadline
including queue wait, TLS, authentication and body reading. Submission validation
has one ten-second hierarchy deadline and never holds a database transaction across
provider requests. No retries, bearer-token retention or response-body logging.
Each worker owns its cache/quota; these limits are not distributed rate limiting.

Buyer submission adds optional `address.pathao: {city_id?, zone_id?, area_id?,
unsupported?}`. Server-only labels, environment, condition and `booking_blocked`
are derived again, never trusted from the request. Existing district/thana/area
text stays separate. Membership validation uses one connection revision; a changed
revision invalidates the result. The original submitted payload determines retry
identity. Saved retries bypass new catalog validation and still recheck current link
authority under the existing order lock; an accepted replay performs no catalog work
and returns the prior result even if provider availability has changed.
Validation errors also recheck the connection revision before rejecting a submission;
a changed revision yields unavailable fallback instead of a stale required/invalid
choice error. Required and invalid choice errors identify the affected form field.

Where the catalog offers choices, city, zone and area selections are mandatory.
A missing choice returns 422 `PATHAO_LOCATION_REQUIRED`; a known forged ID or
parent mismatch returns 422 `PATHAO_LOCATION_INVALID`, regardless of client-supplied
labels, conditions or resolved flags. The buyer may mark the destination as
explicitly unsupported to submit without IDs. Empty city or zone lists are treated
as established unavailability rather than permission to skip verification: the
written address and payment claim are preserved as `missing_choices`, and any
unverified saved IDs are discarded instead of being rejected or fabricated.

`resolved` means selected IDs/labels were found in this catalog and the selected
area advertises home delivery; it does not prove booking readiness. `missing_choices`,
`disconnected`, `unavailable`, `unsupported`, and `no_area_unverified` all require seller
resolution. During outage/disconnection, unverified IDs and labels are discarded while
the written address and payment claim are retained. Unsupported coverage never
triggers ID substitution; supplied IDs are still validated, and an explicit
unsupported flag keeps the result `unsupported`. Empty area lists do not require a
nonexistent choice, but remain `no_area_unverified`. All resolutions currently carry
`booking_blocked: true`; existing draft blockers and absence of a submission endpoint
remain in effect. Later review/booking work must establish current readiness.
The explicit unsupported flag is retained in saved metadata and courier review;
supported IDs alone cannot clear a buyer's stated coverage problem. The seller must
explicitly resolve the destination in review before approval becomes available.

The revision's nullable `address_pathao` JSON text is added by migration 0022 and
projected only through private seller revision history, alongside the detailed
address and independent contact/payment-sender numbers. Address corrections reset
location authority to `missing_choices`; name/payment-only corrections retain it.
Structured retention erases the entire revision and existing replay redaction also
covers location metadata. Historical pre-migration revisions have null metadata.

## Source evidence and limits

Reviewed the owning [SDK location module](https://github.com/mojnomiya/pathao-python/blob/main/pathao/modules/location.py),
blob `58da77cf55a0f360df65c121cc72713a1a8796d7`: bearer-authenticated GET
`aladdin/api/v1/city-list`, `cities/{city_id}/zone-list`, and
`zones/{zone_id}/area-list`; direct/nested data lists, numeric IDs, names, and
area `home_delivery_available` / `pickup_available` fields. The adapter requires
boolean coverage and rejects malformed, duplicate or oversized lists. Pickup
availability does not establish delivery support.

The SDK's [models](https://github.com/mojnomiya/pathao-python/blob/main/pathao/models.py)
declare boolean area coverage. Its [order module](https://github.com/mojnomiya/pathao-python/blob/main/pathao/modules/order.py)
omits recipient area altogether. That omission is insufficient proof of provider
acceptance for no-area zones, so this implementation records the ambiguity explicitly.
The production-host discrepancy and authentication limits in
[the merchant settings contract](pathao-account-contract.md) still apply.

HTTP transport fixtures, offline catalogs and disposable loopback PostgreSQL are
simulated/local evidence. No live Pathao catalog, sandbox merchant, production host,
Clerk journey, hosted migration, physical device or external booking is verified.
