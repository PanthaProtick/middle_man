# 07: Payment history, evidence, and retention

**What to build:** Read historical payment decisions and operate evidence, SMS import, corrections, and retention in either language while preserving evidence.

**Blocked by:** 01 — Language switching and buyer order summary

**Status:** ready-for-agent

- [ ] Translate history, comparisons, evidence resolution, receipt corrections, incoming SMS import results, retention controls, progress/counts, empty/loading/error/retry states.

- [ ] Localize known historical reason/status/source codes and safe unknown-code guidance. Preserve original raw evidence, user-written reasons, actor IDs, SMS text, amounts, and audit records.

- [ ] Localize existing server errors through stable codes without rewriting persisted evidence or changing ownership, prerequisites, correction semantics, masking, or privacy protections.

- [ ] Use shared date/count/money presentation without changing stored instants, expiry windows, retention durations, or purge rules.

- [ ] Switch with open comparisons, correction drafts, import results, pending decisions, and purge failures without repeating decisions, corrections, imports, or deletion requests.

- [ ] Extend rendered history/evidence/import/retention journeys and relevant request tests in both locales for preserved evidence, accurate counts, failures, access controls, and non-repeated mutations.

- [ ] Keep approved standard Bangladeshi Bengali and plain English wording. Include Bengali-capable offline font fallback, phone wrapping and reachable controls, localized document/control language, associated errors, announcements, and preserved keyboard focus; test visible behavior rather than implementation details.

- [ ] Run focused repository tests for changed behavior, then root npm run check as the final pre-handoff gate. Record changed paths, exact results, and failed/blocked/unrun browser or provider acceptance in the existing task record. Mocks and HTTP smoke do not prove live acceptance.
