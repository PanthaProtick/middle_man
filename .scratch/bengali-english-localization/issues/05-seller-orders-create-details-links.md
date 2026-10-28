# 05: Order creation, details, and buyer links

**What to build:** Create and inspect orders and manage buyer links in either language without changing order or link semantics.

**Blocked by:** 01 — Language switching and buyer order summary

**Status:** resolved

- [x] Translate lists, search, filters, pagination, lifecycle/review labels, creation, parcel-entry guidance, computed balances, details, empty/loading/error states, and accessible names.

- [x] Translate validation and server field errors, preserving first-invalid focus, numeric precision, and acceptance of Bengali digits at numeric boundaries.

- [x] Translate link viewing/copy/rotation/revocation feedback and warnings; preserve generated URLs, clipboard link payloads, access rights, and shared-link language independence.

- [x] Use stable coded labels and safe unknown-value guidance without changing enums, query parameters, authorization, or idempotency contracts.

- [x] Preserve product/buyer/address/account data, IDs, parcel values, evidence, filters, drafts, open dialogs, and pending/failed operations across switching. No create/link mutation is repeated.

- [x] Extend rendered creation/list/details/link journeys and relevant endpoint tests for both languages, success/failure, retained values, original payloads, and request counts.

- [x] Keep approved standard Bangladeshi Bengali and plain English wording. Include Bengali-capable offline font fallback, phone wrapping and reachable controls, localized document/control language, associated errors, announcements, and preserved keyboard focus; test visible behavior rather than implementation details.

- [x] Run focused repository tests for changed behavior, then root npm run check as the final pre-handoff gate. Record changed paths, exact results, and failed/blocked/unrun browser or provider acceptance in the existing task record. Mocks and HTTP smoke do not prove live acceptance.

## Completion

Implemented and locally verified. The task record contains changed paths, review
findings and fixes, checks, and unrun browser/phone/screen-reader acceptance.
Summary/CSV and embedded payment/courier/outcome workflows remain in their own tickets.
