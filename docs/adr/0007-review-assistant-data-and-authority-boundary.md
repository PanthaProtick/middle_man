# Bound review assistance to one shop and advisory authority

Status: accepted design; not implemented.

On 2026-10-30, we agreed that review assistance uses backend-enforced shop
isolation and a minimal snapshot of one order review and directly related
records. Gemini may receive selected facts externally; shop isolation does not
mean processing stays on our infrastructure. The assistant explains issues and
suggests existing corrective actions, while sellers retain decision authority
and existing validation and authorization remain authoritative.

Sending complete order records or granting the model mutation authority would
increase disclosure and bypass the separation between payment claims,
seller-supplied evidence, and seller acceptance established in ADR-0001. We
accept less open-ended assistance to preserve that separation.

The user also approved reason-specific minimal facts, current review codes,
seller language, and backend-established available actions. Names, phone
numbers, addresses, transaction IDs, raw SMS, and free-text notes are excluded.
Eligibility includes all pending buyer submissions, including uncoded states
whose cause must first be established server-side. Manual-preview exceptions
and blockers are included only for an authorized selected receipt; advice must
preserve hard blockers. Identifiers and navigation links remain application-side.

Assistance is explicitly requested, has no chat or saved content history, and
reuses output only in the current view. Relevant fact changes invalidate advice.
Deterministic explanations preserve offline and failure behavior. Duplicate
generation, automatic paid retries, and unlimited requests are disallowed;
per-context and shop quotas use content-free operational metadata.

Gemini address assistance is fully retired, including historical AI copies and
suggestions, while buyer-confirmed addresses remain. Supported Pathao selections
are required when available; outages or unsupported coverage preserve submissions
but require seller resolution before courier submission.

The current scope is private development with the free Gemini API and no planned
launch; paid-service configuration is not required. All order/payment data sent
to Gemini in this scope is synthetic. Public Gemini demo routes must not make
live provider calls. Automated tests use fake providers with zero live calls;
live verification is a separate manual step. A single backend process and
in-memory request counters, which reset on restart, are acceptable for this scope.

The user confirmed live generation off by default, five attempts per Asia/Dhaka
calendar day across the application, and at most one attempt per minute. Failures
consume attempts; current-view reuse does not. Per-context and configurable shop
limits remain within that shared ceiling. These limits do not establish Google's
remaining free quota and reset with the accepted in-memory counters on restart.

The user subsequently requested specification only. See the published
[specification](../../.scratch/review-assistant/spec.md), marked ready-for-agent.
No application behavior or historical-data cleanup has been implemented.
