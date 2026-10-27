# 07: Payment history, evidence resolution, SMS import, and retention

**What to build:** Localize historical payment reasons, evidence comparison and
resolution, SMS import outcomes, receipt correction, and retention panels.

**Blocked by:** 01

**Status:** ready

- [ ] Localize `PaymentHistory`, `EvidenceResolution`, `resolution.ts` display
      copy, `ReceiptCorrection`, `SmsImportPanel`, `RetentionSection`,
      `EvidenceRetentionPanel`, and `StructuredRetentionPanel`.
- [ ] Cover review reasons, comparison sides, accepted allocation, decision/
      correction forms, retry-same-decision, SMS import states/issues, masked or
      manually entered records, purge/progress/failure summaries, counts, and
      loading/empty/error states.
- [ ] Known historical codes and reasons render in the selected language with a
      safe fallback for unknown codes. Preserve original raw evidence, actor/source
      values, SMS text, identifiers, and stored amounts exactly.
- [ ] Localize dates and counts with 0-9 digits, Bangladesh time, and localized
      months; do not change retention windows, expiry, purge behavior, or evidence
      stored by the backend.
- [ ] Switching language preserves an open comparison, correction draft, import
      batch state, pending decision, and displayed evidence; it sends no new
      decision, correction, import, or purge request.
- [ ] Extend history/evidence/SMS/retention tests for both locales, preserved
      evidence, code fallbacks, and no repeated mutations on switch.
- [ ] Focused `npm run test:frontend` passes for these suites.
