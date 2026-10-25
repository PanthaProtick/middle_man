# 06: Disable AI while preserving manual entry

**What to build:** Run the self-test with manual buyer entry while AI is explicitly disabled regardless of configured provider credentials.

**Blocked by:** None (can start immediately).

**Status:** completed

## Acceptance criteria

- [x] Both extraction entry points, including cached replays, return the defined disabled/manual outcome without any provider call.
- [x] Configured Gemini credentials do not enable AI in this mode; frontend controls accurately reflect backend availability.
- [x] Manual address/payment entry and optional screenshot use remain available, and existing enabled-mode contracts remain intact for future testing.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: AI feature configuration, address/payment extraction entry points and buyer assistance controls.

## Verification target

Use offline provider spies for direct/replayed requests with credentials configured and feature tests for disabled controls/manual submission.

Coverage: AC09, disabled portion of AC10, AC49. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Live Gemini requests, model evaluation and provider privacy acceptance.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. At publication, implementation had not started; completion evidence follows.


### 2026-10-25 implementation and verification

- SELF_TEST_MODE is the explicit disabling policy: credentials cannot override it. Address/payment services preserve order/evidence eligibility, then return the existing unavailable/manual response before cache replay, budget enforcement or provider work. Disabled requests create no AI records or budget reservations. Provider adapters also enforce policy; demo Gemini paths remain local.
- PublicOrder computes ai_assistance_available from current policy/configuration, including saved submission responses. Missing/false availability hides both transfer controls while preserving manual fields and optional screenshot upload. Enabled extraction contracts remain covered.
- Changed paths: backend/app/core/config.py; backend/app/models/buyer.py; backend/app/services/{address_assistance,address_provider,payment_extraction,payment_provider,gemini}.py; backend/tests/{test_address_routes,test_payment_extraction,test_ai_policy}.py; frontend/src/features/buyer/{types.ts,BuyerSubmissionForm.tsx,BuyerPortal.test.tsx,BuyerAiPolicy.test.tsx}; docs/API_CONTRACTS.md.
- Red/green: observed cached address/payment suggestions returned while self-test mode was enabled; regression tests now pass with synthetic configured credentials, fresh/repeated requests and no additional provider calls. An attempted in-memory submission with SELF_TEST_MODE correctly failed the durable-storage guard; it was removed from this storage-independent policy test, preserving the production guard. Frontend tests prove manual submission with and without screenshot evidence.
- Focused backend: PASS, 29 tests across test_ai_policy.py, test_address_routes.py, test_payment_extraction.py and test_address_adapter.py. Focused frontend: PASS, 24 tests across BuyerAiPolicy, BuyerPortal, AddressAssistance and PaymentAssistance. npm run typecheck: PASS.
- Final npm run check: PASS all eight stages; backend 310 passed / 67 skipped; frontend 133 passed across 29 files. Evidence: .cache/checks/check-hFDsOD/result.json and adjacent logs. PostgreSQL integration cases were skipped; this is offline policy/feature verification, not durable self-test completion.
- Live Gemini, real Clerk/Neon browser journeys, hosted deployment and provider privacy acceptance: NOT RUN, outside this ticket. No overall local synthetic self-test success claim.
- Code review: independent Standards and Spec reviews each report zero implementation findings. Spec requested the evidence/status update recorded here. Next action: continue with the next unblocked self-test ticket; this ticket is complete.
