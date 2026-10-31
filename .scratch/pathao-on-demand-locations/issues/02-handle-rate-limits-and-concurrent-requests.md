# 02: Keep buyer submissions usable during rate limits and concurrent requests

**What to build:** Simultaneous buyers share identical location requests, provider
rate limits do not trigger retry storms, and buyers retain their details and can
use written-address fallback when choices are unavailable. Lookups recover when
the provider becomes available again.

**Blocked by:** 01 — Restore on-demand buyer location selection and submission.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Concurrent requests for the same list in the same shop, environment and
  connection revision share provider work. Different parents or authority scopes
  remain isolated. Concurrent cache misses do not cause token issuance storms.
- [ ] Shared request failure or cancellation cannot leave permanent pending
  entries or stranded buyers. A subsequent eligible request can recover.
- [ ] Both authentication and location-endpoint rate limits respect valid provider
  retry guidance. Missing/invalid guidance uses bounded backoff; neither server
  nor buyer retry controls create immediate retry loops.
- [ ] Cooldown state remains limited to the affected provider authority scope;
  one shop or environment cannot block another. Provider errors are not cached
  as successful empty lists or converted into resolved destinations.
- [ ] Eligible requests may use a still-valid cached list during provider problems;
  expired entries do not silently acquire an indefinite stale lifetime.
- [ ] During established unavailability, buyers see localized guidance and retain
  their name, contact number, written address, selections where still appropriate
  and payment claim. Retry preserves unrelated details and stale responses cannot
  overwrite a newer selection or connection.
- [ ] Buyers can submit written-address fallback during established unavailability.
  The server discards unverified location metadata, preserves the payment claim,
  and requires seller resolution before booking. An in-flight lookup does not
  bypass available-choice validation.
- [ ] Once cooldown expires and provider requests succeed, buyers can retry and
  complete selection without restarting the form. Accepted submission replays
  remain independent of provider recovery and new catalogue work.
- [ ] Controlled provider-transport tests cover simultaneous identical requests,
  token/list expiry, auth and list HTTP 429 responses, timeout, malformed responses,
  cancellation/failure cleanup and successful recovery. Assert externally visible
  outcomes and provider call counts, using controlled time rather than real sleeps.
- [ ] Existing API and rendered buyer-form seams verify fallback submission,
  retained details, localized guidance and recovery end to end. Retain fresh
  seller-review tests demonstrating that fallback cannot authorize booking.
- [ ] Keep token/list/in-flight/cooldown storage bounded and connection-aware.
  Document process-local coordination limits without claiming deployment-wide
  rate-limit protection or adding shared cache infrastructure.
- [ ] Run focused tests and final root `npm run check`; record fresh results and
  browser acceptance status. Do not reproduce throttling through live requests
  or make booking calls as part of automated verification.

## References

- [Feature specification](../spec.md)
- [Blocking ticket 01](01-restore-on-demand-selection-and-submission.md)
