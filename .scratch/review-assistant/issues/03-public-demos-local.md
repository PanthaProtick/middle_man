# 03: Make public Gemini demonstrations permanently local

**What to build:** Public chat and idea demonstrations continue to provide useful
mock responses without consuming Gemini quota, regardless of configured credentials.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Implementation difficulty:** 2/5 — Low.

**Why:** This is a bounded service/route behavior change with clear regression
assertions. The main risk is leaving an initialization or fallback path capable
of contacting Gemini, or showing misleading configuration instructions in the UI.

**Agent fit:** General implementation agent; suitable as the lowest-risk starting
ticket, with normal regression review.

**Parent:** [Approved spec](../spec.md). Follow the [shared contract](../ticket-index.md).

- [ ] Public chat and idea-generation demonstrations are permanently mock-only,
  including with apparently valid Gemini credentials and self-test mode disabled.
- [ ] Remove live client initialization, primary generation, retry, and alternate
  provider/model fallback from public demonstration paths.
- [ ] Preserve useful response contracts and mock output; make demo UI/help text
  truthful and remove instructions implying a key enables these public calls.
- [ ] Health/configuration presentation does not imply public demos are live.
  Keep shared Gemini settings available for the later seller review feature.
- [ ] HTTP tests cover both demos with configured synthetic credentials, prove
  zero provider invocations, and preserve expected response shapes.
- [ ] Existing self-test and offline behavior stays local. No real credentials
  or live calls are needed to validate the change.
- [ ] Run focused demo/policy tests and final root `npm run check`; record results.

## Notes

This prevents a public bypass of the review assistant's eventual usage controls.
It does not enable the new assistant or independently remove address extraction.
