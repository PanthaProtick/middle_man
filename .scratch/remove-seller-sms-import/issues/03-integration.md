# Contracts and integrated acceptance
Status: resolved
Blocked by: 01, 02

## Decisions

Current API contracts, architecture, glossary, seller evidence ADR and SMS retirement guide now describe manual/guided entry and preserved historical retention. No schema migration or table deletion was needed. Both implementation tickets are resolved on the integration branch.

## Browser acceptance

PASS: isolated existing baseline fixture served current source on owned loopback port 5197, without project environment files, backend identity or live providers. Browser navigation tested Payments in English and Bengali, absence of import/history controls and instructions, manual modal account selection, synthetic manual recording success, reconciliation anchor navigation, and guided Record a payment accessibility. Visually inspected mobile 390x844 and desktop 1440x1000 layouts. Restored viewport after testing. Fixture responses are synthetic and do not prove persistence or live identity/provider behavior.

Two startup attempts were blocked by an occupied fixture port and Vite optimizer delay; the owned isolated server subsequently loaded and all above checks completed. No existing server was stopped.

## Answer and verification

Independent review found two standards gaps (historical search fixture and dated ADR history) and one spec gap (two remaining Bengali landing SMS claims). All were fixed in `629fc65` and verified by the reviewer. No other findings remained.

Final `npm run check`: PASS, `.cache/checks/check-GTFyHK/result.json`. Backend 703 passed / 175 skipped; frontend 124 files / 675 tests passed. Tooling, conventions, lint, types, build and HTTP smoke passed. Initial run `.cache/checks/check-AAMAdk/result.json` failed on Windows default pytest temporary-directory permissions; the unfiltered rerun used `PYTEST_ADDOPTS=--basetemp=../.cache/pytest-sms-removal-final-629fc65`.

Disposable PostgreSQL preservation/retention coverage: 18 passed, detailed in ticket 01; temporary clusters stopped. Fresh full migration chain and seeded historical data were exercised. No schema migration was required. No production migration, hosted deployment, physical device, real provider or hosted identity acceptance is claimed.

Integration branch: `codex/remove-seller-sms-import`. Implementation worktrees and owned synthetic browser server are removed/stopped at handoff; completed Markdown records remain.
