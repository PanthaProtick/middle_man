# 02: Buyer submission and delivery locations

**What to build:** Complete manual buyer submission in Bengali or English, including payment details, delivery locations, validation, and recovery.

**Blocked by:** 01 — Language switching and buyer order summary

**Status:** resolved

- [x] Translate buyer identity/contact/address/payment fields, labels, help, placeholders, submit/acknowledgement, pending/failure/retry states, and accessible descriptions.

- [x] Translate location selection and loading/empty/unavailable/retry states while retaining authoritative Pathao names and IDs.

- [x] Preserve names, addresses, messages, provider names, TrxIDs, account numbers, payload meanings, and opaque identifiers. Accept Bengali digits only at numeric boundaries; preserve monetary precision.

- [x] Render stable server field/request codes and parameters as localized errors, adding narrow typed metadata where needed. Unknown failures receive safe localized guidance rather than raw technical text alone.

- [x] Switch with populated fields, validation errors, pending/failed submission, and selected locations without losing inputs, first-invalid focus, error meaning, or idempotency state, and without repeating requests.

- [x] Extend existing rendered buyer/location journeys and relevant request tests for both locales, invalid input, expired access, unavailable catalogs, retry, retained payloads, and no repeated mutations. Address assistance is ticket 03.

- [x] Keep approved standard Bangladeshi Bengali and plain English wording. Include Bengali-capable offline font fallback, phone wrapping and reachable controls, localized document/control language, associated errors, announcements, and preserved keyboard focus; test visible behavior rather than implementation details.

- [x] Run focused repository tests for changed behavior, then root npm run check as the final pre-handoff gate. Record changed paths, exact results, and failed/blocked/unrun browser or provider acceptance in the existing task record. Mocks and HTTP smoke do not prove live acceptance.

## Implementation evidence

Buyer form/payment and Pathao catalog copy now use locale catalogs. Validation
keeps codes and safe typed length parameters; rate-limit timing uses Retry-After.
Money accepts Bengali digits at parsing only. Original text, provider names,
location IDs and uncertain submission payload/key remain intact on switching.

Agreed TDD seams: existing rendered buyer/location journeys and request tests.
Focused frontend buyer/locale tests: 15 files, 99 tests passed. Focused backend
buyer boundaries/public routes/Pathao locations: 25 passed. Typecheck passed.
Two-axis code review returned 0 Standards and 0 Spec findings. Root `npm run check`
passed: `.cache/checks/check-kAjJYU/result.json` (459 backend passed, 170 skipped;
50 frontend files, 252 tests passed; tooling/lint/types/build/HTTP smoke passed).
The first full run (`check-srOFAb`) failed on Windows pytest temp permissions;
the passing run used repository-local TEMP/TMP and PYTEST_ADDOPTS basetemp.
Phone-browser,
physical-device, screen-reader and live Pathao acceptance have not been run.
Full changed paths and final verification will be recorded in
[the existing task](../../../tasks/bengali-english-localization-design.md).
