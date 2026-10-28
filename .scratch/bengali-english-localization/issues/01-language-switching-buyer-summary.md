# 01: Language switching and buyer order summary

**What to build:** Choose Bengali or English from either entry path, retain that device preference, and read buyer order terms without changing order data.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Add shared locale selection, catalogs, and formatting alongside existing copy. Prefactor only what is needed and deliver a translated buyer summary; keep unmigrated workflows working.

- [x] Show a discoverable বাংলা / English switch in both entry paths, including signed-out and no-Clerk paths. Use a valid explicit device preference first, then preferred browser language (Bengali or English fallback). Ignore invalid stored values; unavailable storage must not prevent switching.

- [x] Persist explicit choices across reloads and buyer/seller screens. Shared links do not inherit the seller's language; no account synchronization is added.

- [x] Translate buyer order terms, payment instructions, lifecycle/status explanations, expiry, loading, empty, unavailable, retry, terminal states, and copy feedback. Render known server errors through stable codes, adding narrow typed metadata only if necessary.

- [x] Preserve shop/product/account text, providers, numbers, IDs, and order state. Explain delivery advance and remaining COD accurately; seller acceptance must not imply independent provider verification.

- [x] Provide 0-9 money/date output with unchanged precision, localized Gregorian month names, unambiguous dates, and Asia/Dhaka timestamps. Numeric digit normalization is limited to numeric parse boundaries.

- [x] Test both entry paths, initialization, explicit override, persistence, statuses, original data, and zero extra requests on switching. Add required-key and interpolation-parity checks for migrated catalogs.

- [x] Keep approved standard Bangladeshi Bengali and plain English wording. Include Bengali-capable offline font fallback, phone wrapping and reachable controls, localized document/control language, associated errors, announcements, and preserved keyboard focus; test visible behavior rather than implementation details.

- [x] Run focused repository tests for changed behavior, then root npm run check as the final pre-handoff gate. Record changed paths, exact results, and failed/blocked/unrun browser or provider acceptance in the existing task record. Mocks and HTTP smoke do not prove live acceptance.

## Completion

Implemented shared locale selection/catalogs/formatting and the translated buyer
order summary. Evidence, changed paths, and the remaining browser/Clerk
acceptance gaps are recorded in
[the task record](../../../tasks/bengali-english-localization-design.md#current-state-and-next-action).
Later workflow strings remain intentionally unmigrated for tickets 02–12.
