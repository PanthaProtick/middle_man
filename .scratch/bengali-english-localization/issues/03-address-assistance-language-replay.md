# 03: Address assistance without repeated AI requests

**What to build:** Understand optional address assistance and saved results in the selected language without changing extracted addresses or repeating AI requests.

**Blocked by:** 01 — Language switching and buyer order summary

**Status:** resolved

- [x] Translate opt-in, limits, loading, unavailable/manual fallback, suggestion review, retention, errors, and announcements.

- [x] Fresh explicitly requested assistance uses the selected language for generated explanations. Keep any necessary locale metadata typed and separate from business extraction data.

- [x] Preserve extracted values, explicit review, opt-in, and submission boundaries. Switching does not invoke AI, consume another reservation, change stored revisions or buyer lifecycle, or alter idempotency meaning.

- [x] Replay preserves the original extraction. Saved generated text without a translation receives a localized explanation and an explicit way to view the original; do not regenerate it.

- [x] Localize known service codes and safe unknown-error guidance while retaining original evidence and offline/manual behavior.

- [x] Extend rendered assistance journeys and backend request/provider-double tests for fresh requests, replay, limits, provider failure, saved foreign-language text, and pending/failed/review switches. Assert preserved results and provider-call counts.

- [x] Keep approved standard Bangladeshi Bengali and plain English wording. Include Bengali-capable offline font fallback, phone wrapping and reachable controls, localized document/control language, associated errors, announcements, and preserved keyboard focus; test visible behavior rather than implementation details.

- [x] Run focused repository tests for changed behavior, then root npm run check as the final pre-handoff gate. Record changed paths, exact results, and failed/blocked/unrun browser or provider acceptance in the existing task record. Mocks and HTTP smoke do not prove live acceptance.

## Implementation record (2026-10-28)

- Implemented in commit `f43889a`: localized assistance consent, pending, review,
  retention and safe error states; added optional typed language presentation
  metadata excluded from the idempotency fingerprint; fresh provider requests
  receive the selected language while historical records replay unchanged with
  unknown language and an explicit original display.
- Focused checks passed: address routes/adapter/Postgres-double tests (13 passed,
  2 PostgreSQL skipped), assistance locale tests (4 tests) and the updated
  assistance suite (3 tests); `npm run typecheck` passed.
- Root `npm run check` passed at `.cache/checks/check-v8aMlg/result.json`.
- Two-axis review fixed missing terminal service codes and focus preservation.
- NOT RUN: live AI provider, hosted deployment, phone-browser wrapping/font,
  keyboard and screen-reader acceptance. Automated tests do not establish them.
- Full evidence and changed paths are recorded in
  `tasks/bengali-english-localization-design.md` (Ticket 03 implementation).
