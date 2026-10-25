# 20: Record the real-session manual browser journey

**What to build:** Record an actual local manual workflow with two Clerk test identities, the dedicated Neon development database and generated evidence.

**Blocked by:** 05: Handle session loss and reject foreign-shop access; 13: Persist and privately retrieve screenshots; 15: Verify durable receipt-to-confirmation behavior.

**Status:** blocked — attempted setup; real-session journey not completed

2026-10-25 follow-up: startup option compatibility and sign-in UI fixes are recorded in Tickets 01 and 04. Real browser now opens Clerk sign-in. Database verification requires confirmation that the configured Neon target is the dedicated development database; automatic approval review rejected the network escalation pending that prerequisite. Earlier observations below are historical; no full journey completion is claimed.

## Acceptance criteria

- [ ] Record revision, local URLs, sanitized target identity and dated observations for setup, receiving account, fixed order, link, manual buyer form, optional image and confirmation.
- [ ] Demonstrate two-shop separation and real sessions, and verify order/image persistence after restart with AI disabled.
- [ ] Preserve privacy-safe observations and mark failures/unrun portions explicitly; intercepted HTTP, fake tokens and direct database probes do not substitute for this journey.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Existing setup/order/buyer/evidence/status UI and approved local browser acceptance checklist; no test-only public/auth overrides.

## Verification target

Use actual local browser operations and application requests against intended providers. This is an evidence ticket; route any substantial discovered implementation fix back to its owning ticket.

Coverage: Browser evidence for AC01–AC09, AC12, AC16, AC39, AC48. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Hosted browser acceptance, real order data and live Gemini.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.

### 2026-10-25 attempted local browser acceptance

Candidate: `b9ac24c0dc1e94106d6bcd0d5c39f57c4834d3dd`; checkout initially clean.
Evidence-only update; no application, configuration or schema changes.
Observations dated 2026-10-25 Asia/Dhaka (host log timezone is not acceptance time).

| Step | Result and actual observation |
| --- | --- |
| Baseline launch | `npm run dev:backend` started at `http://127.0.0.1:8000` but logged `durable_storage=False`. This launch does not qualify for the self-test. |
| Required durable launch | With process-local `SELF_TEST_MODE=true` and `PUBLIC_BUYER_ACCESS_POLICY=self_test_link_possession`, `npm run dev:backend` logged `durable_storage=True`, then failed startup: `Database connection failed: connect() got an unexpected keyword argument 'sslmode'`. No durable journey was possible. |
| Browser setup | `npm run dev:frontend` served `http://localhost:5173/`. Actual in-app browser navigation rendered the workspace, a disabled `Sign in` button, `Seller sign-in is unavailable. Configure Clerk to connect your shop.`, and `Session verification is unavailable. Please retry.` These are observed UI messages, not proof that a key is missing or invalid. Vite subsequently logged that Clerk loaded development keys. |
| Target and identities | Dedicated Neon target identity NOT VERIFIED; no hostname/database identifier or credentials inspected or recorded. Neither owner-controlled Clerk identity authenticated in this attempt. Do not infer that the configured target is safe for migration. |
| Receiving account, fixed order, link | NOT RUN: setup blocked. |
| Manual buyer form, distinct sender/contact, optional generated image | NOT RUN: no eligible durable order/link created. |
| Receipt arrival, confirmation, remaining COD | NOT RUN. |
| Two-shop isolation, sign-out/expiry/identity switch | NOT RUN with real sessions. Prior offline permission tests do not substitute. |
| Order/image persistence after restart | NOT RUN against the intended Neon target. |
| AI disabled | NOT VERIFIED end to end. The attempted self-test launch sets the mode that disables AI, but startup failure prevents browser proof or a zero-call observation. |

Reproducer and owning follow-ups:

- Ticket 01 storage configuration: trace `backend/app/core/config.py:effective_database_url` and `backend/app/core/database.py` engine construction. PG-field URL construction emits `sslmode`, while engine construction passes the URL to the asyncpg dialect without translating that parameter. The actual startup error establishes driver argument incompatibility; it does not establish database connectivity or schema readiness. Repair and regression coverage belong to Ticket 01, not this evidence ticket. Do not weaken TLS or use memory fallback.
- Ticket 04 sign-in: investigate the displayed unavailable state with the existing development-key setup after the durable backend is operational; the observation alone does not diagnose Clerk credentials. Do not introduce fake tokens or test-only auth overrides.
- After those fixes, confirm the sanitized dedicated development target and two owner-controlled test identities, then rerun this entire browser journey with generated evidence and AI disabled. Apply no migrations before target confirmation.

Coverage: AC01–AC09, AC12, AC16, AC39 and AC48 remain unverified by this journey. All acceptance checkboxes above remain open. No provider data was intentionally created or changed; no database probes, intercepted HTTP or synthetic auth were used as acceptance evidence. All three owned development command sessions were stopped after the attempt.

Verification: actual backend startup attempts and browser navigation as recorded above. No focused automated tests or typecheck run: no code/tooling changed. The repository pre-commit hook runs the full root gate for this record commit; its result is reported separately. Code review checks evidence accuracy and scope; a clean review cannot complete the blocked journey.
