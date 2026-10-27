# 03: Address assistance without repeated AI requests

**What to build:** Understand optional address assistance and saved results in the selected language without changing extracted addresses or repeating AI requests.

**Blocked by:** 01 — Language switching and buyer order summary

**Status:** ready-for-agent

- [ ] Translate opt-in, limits, loading, unavailable/manual fallback, suggestion review, retention, errors, and announcements.

- [ ] Fresh explicitly requested assistance uses the selected language for generated explanations. Keep any necessary locale metadata typed and separate from business extraction data.

- [ ] Preserve extracted values, explicit review, opt-in, and submission boundaries. Switching does not invoke AI, consume another reservation, change stored revisions or buyer lifecycle, or alter idempotency meaning.

- [ ] Replay preserves the original extraction. Saved generated text without a translation receives a localized explanation and an explicit way to view the original; do not regenerate it.

- [ ] Localize known service codes and safe unknown-error guidance while retaining original evidence and offline/manual behavior.

- [ ] Extend rendered assistance journeys and backend request/provider-double tests for fresh requests, replay, limits, provider failure, saved foreign-language text, and pending/failed/review switches. Assert preserved results and provider-call counts.

- [ ] Keep approved standard Bangladeshi Bengali and plain English wording. Include Bengali-capable offline font fallback, phone wrapping and reachable controls, localized document/control language, associated errors, announcements, and preserved keyboard focus; test visible behavior rather than implementation details.

- [ ] Run focused repository tests for changed behavior, then root npm run check as the final pre-handoff gate. Record changed paths, exact results, and failed/blocked/unrun browser or provider acceptance in the existing task record. Mocks and HTTP smoke do not prove live acceptance.
