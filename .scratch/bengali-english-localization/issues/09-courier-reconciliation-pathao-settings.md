# 09: Pathao settings and courier reconciliation

**What to build:** Understand Pathao settings, connection feedback, reconciliation, and recovery in either language while preserving secrets and provider evidence.

**Blocked by:** 01 — Language switching and buyer order summary

**Status:** ready-for-agent

- [ ] Translate connection/environment labels, merchant settings, credential feedback, revision history, pickup-store labels, session loss, and existing booking-disabled guidance.

- [ ] Translate reconciliation states, unresolved-booking instructions, snapshots, recovery, and distinctions between local and provider cancellation.

- [ ] Localize stable settings/reconciliation codes with safe unknown-code guidance. Preserve original evidence, merchant/store IDs, credentials, revisions, and audit records.

- [ ] Switch without exposing secrets, resetting unsaved credentials or selected environment, repeating checks/reconciliation, or enabling previously disabled operations.

- [ ] Provide localized guidance before existing external provider links, while acknowledging external sites control their language. Add no new provider operations.

- [ ] Extend rendered settings/reconciliation journeys and relevant request/failure/replay tests in both locales for secret masking, retained evidence/state, and request counts.

- [ ] Keep approved standard Bangladeshi Bengali and plain English wording. Include Bengali-capable offline font fallback, phone wrapping and reachable controls, localized document/control language, associated errors, announcements, and preserved keyboard focus; test visible behavior rather than implementation details.

- [ ] Run focused repository tests for changed behavior, then root npm run check as the final pre-handoff gate. Record changed paths, exact results, and failed/blocked/unrun browser or provider acceptance in the existing task record. Mocks and HTTP smoke do not prove live acceptance.
