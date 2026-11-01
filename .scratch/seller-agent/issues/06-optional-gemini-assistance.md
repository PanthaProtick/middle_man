# 06: Add optional Gemini assistance within the agreed privacy boundary

**What to build:** Offer optional bilingual explanations from permitted structured facts while guided seller actions remain usable without Gemini.

**Blocked by:** 01: Unify the floating seller assistant and contextual review.

**Status:** ready-for-agent

- [ ] Keep workflow interpretation, sensitive collection, identifiers, links, counts, available actions, confirmations, and save outcomes application-controlled; the model cannot authorize or execute mutations.
- [ ] Construct provider payloads exclusively from allowlisted structured facts. Never send arbitrary raw chat, product names, transaction IDs, names, phone numbers, addresses, raw SMS, or notes; redaction alone is not the boundary.
- [ ] Validate provider output; render safely, reject invented actions/links and unsupported success claims, and discard stale or cross-shop responses on context change.
- [ ] Remain private synthetic-data development, with live generation off by default. Disabled, unavailable, rejected, or failed generation falls back to local bilingual guidance; no automatic provider retries.
- [ ] Remove/suspend existing shared application Gemini daily/minute ceilings for this development scope and introduce no replacement caps, throttles, or artificial request limits. Preserve authorization and duplicate-action safety.
- [ ] Follow conversation language and explicit switching independently of app locale without translating entered data. Explanations only reference capabilities/facts currently available.
- [ ] Use fake providers only in automated verification, including payload capture for malicious/raw sensitive input, invalid output, language, disabled/error states, and stale-response tests. No live Gemini calls; manual live tests belong to the user.

## Verification and handoff

Use focused checks while implementing and the root verification gate before completion.
Automated tests use fake providers with zero live Gemini calls. Record actual results,
unrun acceptance gates, remaining risks, and the next action in this ticket.

