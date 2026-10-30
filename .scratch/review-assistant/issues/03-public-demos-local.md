# 03: Make public Gemini demonstrations permanently local

**What to build:** Public chat and idea demonstrations continue to provide useful
mock responses without consuming Gemini quota, regardless of configured credentials.

**Blocked by:** None (can start immediately).

**Status:** completed

**Implementation difficulty:** 2/5 — Low.

**Why:** This is a bounded service/route behavior change with clear regression
assertions. The main risk is leaving an initialization or fallback path capable
of contacting Gemini, or showing misleading configuration instructions in the UI.

**Agent fit:** General implementation agent; suitable as the lowest-risk starting
ticket, with normal regression review.

**Parent:** [Approved spec](../spec.md). Follow the [shared contract](../ticket-index.md).

- [x] Public chat and idea-generation demonstrations are permanently mock-only,
  including with apparently valid Gemini credentials and self-test mode disabled.
- [x] Remove live client initialization, primary generation, retry, and alternate
  provider/model fallback from public demonstration paths.
- [x] Preserve useful response contracts and mock output; make demo UI/help text
  truthful and remove instructions implying a key enables these public calls.
- [x] Health/configuration presentation does not imply public demos are live.
  Keep shared Gemini settings available for the later seller review feature.
- [x] HTTP tests cover both demos with configured synthetic credentials, prove
  zero provider invocations, and preserve expected response shapes.
- [x] Existing self-test and offline behavior stays local. No real credentials
  or live calls are needed to validate the change.
- [x] Run focused demo/policy tests and final root `npm run check`; record results.

## Notes

This prevents a public bypass of the review assistant's eventual usage controls.
It does not enable the new assistant or independently remove address extraction.

## Implementation and review evidence (2026-10-30)

- Decisions: public chat and structured ideas return local samples unconditionally.
  Removed provider initialization, generation, retries, and alternate-model fallback.
  Shared Gemini configuration remains available for the later seller review feature;
  configured credentials do not activate public demos.
- Changed paths: `backend/app/services/gemini.py`, `backend/app/core/config.py`,
  `backend/tests/test_gemini.py`, `frontend/src/features/demo/DemoTools.tsx`,
  `frontend/src/features/gemini/GeminiPlayground.tsx`, `README.md`, and this ticket.
  README guidance now describes both public routes as permanently local and the
  Gemini settings as reserved for later seller review assistance.
- Focused verification: `npm run test:backend -- tests/test_gemini.py tests/test_ai_policy.py`
  passed (7 tests), covering synthetic configured credentials, self-test policy,
  response contracts, and zero calls to the injected provider methods.
- Initial `npm run check` stopped at a Windows pytest temporary-directory permission
  error (509 passed, 174 skipped, 1 setup error). Result:
  `.cache/checks/check-gZC8Es/result.json`.
- Review rerun with
  `$env:PYTEST_ADDOPTS = '--basetemp=E:/middle_man/.cache/pytest-ticket03-review'; npm run check`
  passed every stage. Result: `.cache/checks/check-qkczIb/result.json`.
- Acceptance limits: browser acceptance was not run; no live Gemini calls or real
  credentials were used. PostgreSQL-dependent tests were skipped without a disposable
  test database. Automated checks do not establish browser or live-provider behavior.
- Final verification after the README corrections:
  `$env:PYTEST_ADDOPTS = '--basetemp=E:/middle_man/.cache/pytest-ticket03-doc-fix'; npm run check`
  passed all stages. Result: `.cache/checks/check-WCMOb2/result.json`.
  Only this result record was appended after the gate.
- Next action: none for these review findings. Browser acceptance remains unrun.
