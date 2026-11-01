# Seller agent prepares actions under seller confirmation

Status: accepted design, not implemented; interview details remain in progress.

On 2026-11-01, the seller agent design expanded assistance to order creation,
seller transaction entry, and outstanding-work queries. The application collects
fields locally and requires an editable summary plus explicit seller confirmation
before writes through existing authorized domain services. Gemini receives only
allowlisted structured facts, never arbitrary raw conversation text, product names,
or sensitive payment fields. This trades open-ended language flexibility for an
enforceable disclosure boundary; the model does not acquire mutation authority.

This extends [ADR-0007](0007-review-assistant-data-and-authority-boundary.md)'s
advisory-only product scope for the seller agent while retaining its external-data
restrictions and the distinction between payment claims, seller records, and
seller acceptance. Recording a transaction retains existing reconciliation effects,
including possible automatic confirmation of an eligible order. Application-side
queries, identifiers, links, counts, and save results remain authoritative.

The development version suspends application Gemini quotas and request-rate limits,
including the prior shared daily/minute ceiling. This explicitly supersedes those
ADR-0007 limits for this development scope. Gemini remains optional and off by
default; development data remains synthetic. Automated verification makes zero
live calls, and live tests are performed manually by the user. This is not a
decision to launch for real sellers or a change to provider-side limits.

Conversation and creation drafts are temporary within the signed-in tab; reload,
sign-out, and shop changes clear them. No persistent conversation history is added.
See the [design interview](../../.scratch/seller-agent/spec.md) for accepted workflow
and presentation decisions and remaining questions.
