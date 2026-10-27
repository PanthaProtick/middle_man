# 02: Buyer submission and delivery locations

**What to build:** Complete manual buyer submission in Bengali or English, including payment details, delivery locations, validation, and recovery.

**Blocked by:** 01 — Language switching and buyer order summary

**Status:** ready-for-agent

- [ ] Translate buyer identity/contact/address/payment fields, labels, help, placeholders, submit/acknowledgement, pending/failure/retry states, and accessible descriptions.

- [ ] Translate location selection and loading/empty/unavailable/retry states while retaining authoritative Pathao names and IDs.

- [ ] Preserve names, addresses, messages, provider names, TrxIDs, account numbers, payload meanings, and opaque identifiers. Accept Bengali digits only at numeric boundaries; preserve monetary precision.

- [ ] Render stable server field/request codes and parameters as localized errors, adding narrow typed metadata where needed. Unknown failures receive safe localized guidance rather than raw technical text alone.

- [ ] Switch with populated fields, validation errors, pending/failed submission, and selected locations without losing inputs, first-invalid focus, error meaning, or idempotency state, and without repeating requests.

- [ ] Extend existing rendered buyer/location journeys and relevant request tests for both locales, invalid input, expired access, unavailable catalogs, retry, retained payloads, and no repeated mutations. Address assistance is ticket 03.

- [ ] Keep approved standard Bangladeshi Bengali and plain English wording. Include Bengali-capable offline font fallback, phone wrapping and reachable controls, localized document/control language, associated errors, announcements, and preserved keyboard focus; test visible behavior rather than implementation details.

- [ ] Run focused repository tests for changed behavior, then root npm run check as the final pre-handoff gate. Record changed paths, exact results, and failed/blocked/unrun browser or provider acceptance in the existing task record. Mocks and HTTP smoke do not prove live acceptance.
