# 06: Add optional Gemini assistance within the agreed privacy boundary

**What to build:** Offer optional bilingual explanations from permitted structured facts while guided seller actions remain usable without Gemini.

**Blocked by:** 01: Unify the floating seller assistant and contextual review.

**Status:** complete

- [x] Keep workflow interpretation, sensitive collection, identifiers, links, counts, available actions, confirmations, and save outcomes application-controlled; the model cannot authorize or execute mutations.
- [x] Construct provider payloads exclusively from allowlisted structured facts. Never send arbitrary raw chat, product names, transaction IDs, names, phone numbers, addresses, raw SMS, or notes; redaction alone is not the boundary.
- [x] Validate provider output; render safely, reject invented actions/links and unsupported success claims, and discard stale or cross-shop responses on context change.
- [x] Remain private synthetic-data development, with live generation off by default. Disabled, unavailable, rejected, or failed generation falls back to local bilingual guidance; no automatic provider retries.
- [x] Remove/suspend existing shared application Gemini daily/minute ceilings for this development scope and introduce no replacement caps, throttles, or artificial request limits. Preserve authorization and duplicate-action safety.
- [x] Follow conversation language and explicit switching independently of app locale without translating entered data. Explanations only reference capabilities/facts currently available.
- [x] Use fake providers only in automated verification, including payload capture for malicious/raw sensitive input, invalid output, language, disabled/error states, and stale-response tests. No live Gemini calls; manual live tests belong to the user.

## Verification and handoff

### Scope

Review explanations only. The existing contextual review explanation remains the
only model-backed surface: provider output may replace plain explanation wording,
while conditions, facts, actions, blockers, and navigation stay backend-owned.
Guided order/payment/search workflows remain local and never call the provider.

### Changed paths

- `backend/app/services/review_generation.py`: removed attempt ceilings, added an
  in-process in-flight duplicate guard (opaque review/context/locale hash; `busy`
  only for an identical concurrent request), added narrow English/Bengali
  unsupported-success-claim rejection. Provider timeout, output bounds,
  no-retry behavior, and post-provider revalidation are unchanged.
- `backend/app/services/review_generation_limits.py`: deleted.
- `backend/app/core/config.py`: removed `REVIEW_GEMINI_SHOP_DAILY_LIMIT`; retained
  enablement, key, model, and self-test override settings.
- `backend/app/models/review_assistance.py`: removed `limited` from fallback status.
- `backend/tests/conftest.py`: removed the obsolete limit environment setting.
- `backend/tests/test_review_generation.py`: removed cap assertions; added
  no-ceiling sequential/cross-shop coverage, non-consumed failures, hostile output,
  unsupported/negative success claims, and cross-shop change discard.
- `backend/tests/test_review_generation_privacy.py`: new fake-provider tests for
  hostile raw input allowlisting, Bengali conversation locale, and bilingual local
  fallback.
- `backend/tests/test_review_generation_transport.py`: duplicate-guard reset and
  removed limit counters; wire and no-retry assertions retained.
- `backend/tests/test_review_generation_caps.py`: deleted.
- `frontend/src/features/seller/reviewAssistanceApi.ts` and
  `frontend/src/features/locale/reviewGenerationCopy.ts`: removed `limited` from
  the fallback type and English/Bengali copy.
- `frontend/src/features/seller/ReviewAssistantGeneration.test.tsx`: fallback matrix
  no longer includes `limited`; explicit-generation, duplicate-click, reuse,
  locale, sign-out, and late-response assertions retained.
- `docs/contracts/review-assistance.md`: replaced quota documentation with no-cap
  behavior and the duplicate-only guard.
- `docs/adr/0010-seller-agent-confirmed-actions-and-data-boundary.md`: records the
  quota suspension as implemented.

### Evidence

Base commit: `e2ee90f` on `main`. Working tree contained only these changes.

- `npm run test:backend -- tests/test_review_generation.py tests/test_review_generation_transport.py tests/test_review_generation_privacy.py tests/test_review_assistance_api.py`
  — 64 passed in 1.84s, zero live Gemini calls (fake providers and HTTP mocks only).
- `npm run test:frontend -- src/features/seller/ReviewAssistantGeneration.test.tsx`
  — 10 passed.
- `npm run typecheck` — passed.
- `npm run check` — PASS: tooling tests, repository conventions (1014 tracked
  files; 31 at the 250-line review trigger), backend lint/types/tests, frontend
  lint/test/build, HTTP smoke. Result:
  `.cache/checks/check-MPMnYd/result.json`.

### Unrun or manual gates

- No live Gemini provider call, manual browser walkthrough, or real-provider
  Bengali wording review was performed; those remain user-owned manual gates.
- No production durability or provider-quota behavior was exercised. The removed
  limits were application-side only; Google/provider limits still apply externally.

### Risks

- The in-flight guard is process-local and resets on restart; multiple worker
  processes can still dispatch identical concurrent calls. This is duplicate
  suppression, not a quota or cross-process lock.
- Unsupported-success detection is deliberately narrow (selected English/Bengali
  result phrases) and falls back safely on match; novel phrasing may pass.
- Generated wording quality and Bengali fluency remain unverified against a live
  provider.

### Next action

Commit the change to `main`. Manual live-provider verification can be run later by
the user with `REVIEW_GEMINI_ENABLED=true` and a real key on synthetic data.

## Verification follow-up — 2026-11-01

- Reviewed committed implementation `2a3f7c6` from a clean working tree,
  including provider transport, context allowlisting, API authorization/freshness,
  and frontend generation/language handling.
- Fixed active-voice unsupported success claims: statements such as "I have
  confirmed the payment" and "We already saved your order" now fall back to local
  guidance. Added three rejection cases and two negative-statement controls.
- This remains a phrase-based check, not semantic proof of arbitrary model prose;
  novel claims or invented instructions can still evade it. Model text cannot
  authorize actions, and backend-owned controls and blockers remain authoritative.
- Focused backend verification: 69 passed across generation, transport, privacy,
  and assistance API tests. Focused frontend generation verification: 10 passed.
- No live provider calls or manual browser acceptance performed.
- Final gate: `npm run check` PASS with `PYTEST_DEBUG_TEMPROOT` pointing to
  `.cache/pytest-ticket06`; result `.cache/checks/check-Lp557C/result.json`.
  Tooling, conventions, backend lint/types/tests, frontend lint/tests/build, and
  HTTP smoke all passed. PostgreSQL integration cases remain skipped locally.
- Initial gate `.cache/checks/check-8O3AmH/result.json` stopped on an unrelated
  pytest temp-directory permission error (692 passed, 179 skipped, 1 setup error);
  the repository-local temporary root resolved it without changing test code.
- Next action: commit this verification follow-up; live-provider and browser
  acceptance remain manual and unrun.
