# 13: Attach optional screenshots privately

**What to build:** A buyer optionally attaches a valid payment screenshot and the owning seller can retrieve it privately, while the manual form stays usable.

**Blocked by:** [03: Submit buyer details and see pending status](03-manual-buyer-submission.md)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Accept JPEG/PNG up to initial 5 MiB/20 megapixel limits, checking actual decoded content/dimensions and stripping metadata; reject invalid MIME/content, excessive images and foreign evidence references.
- [ ] Bind private evidence to order/shop and authorized non-live/live-policy scope; only owning sellers retrieve evidence through a short-lived private access mechanism, never public object URLs.
- [ ] Permit upload only for unsubmitted, unexpired orders. Upload cannot extend expiry, count as submission, or confirm receipt; public operations remain subject to the existing live gate.
- [ ] Create collection/deletion deadlines and durable orphan/failed-upload tracking immediately; raw evidence expires after 30 days and raw copies stay out of logs/audit.
- [ ] Support idempotent staged uploads and unknown-outcome recovery without falsely claiming uploaded content exists during a storage outage.
- [ ] Provide upload progress/success/error/removal-from-form states and seller evidence view; manual submission remains possible when upload fails or is skipped. Evidence unavailable state is explicit.
- [ ] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC09, AC11, AC28, AC31, AC32, AC37, AC38, AC40, AC44, AC45, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API decoded-image/ownership/size/deadline/idempotency tests; private-storage adapter failures and real PostgreSQL evidence metadata checks; browser optional upload, manual fallback and seller-only retrieval. Actual storage ACL evidence is separate.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

