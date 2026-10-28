# Codebase cleanup and organization

Status: ready-for-agent

## Problem Statement

Agent-assisted implementation has accumulated temporary previews, probes, logs,
verification artifacts, scattered tests, and potentially obsolete code alongside
maintained product code and work records. This makes navigation difficult and
makes it unclear which files are authoritative, which tests protect behavior,
and which coding conventions are actually enforced. Some documented conventions
also conflict with one another or describe an older application state.

The owner wants a maintainable, organized repository without losing useful tests,
implementation history, working features, or safety guarantees. In particular,
`.scratch/` should contain issue, specification, and ticket records for past and
current work, rather than disposable execution artifacts or loose code.

## Solution

Audit the whole repository, classify candidates using evidence, and perform the
cleanup in bounded groups. Remove proven disposable or dead files, relocate useful
tests and tools into maintained locations, preserve useful verification evidence,
and organize code by existing feature and responsibility boundaries. Repair the
producers of clutter and reconcile conventions so the repository stays organized.

The agent owns individual deletion and relocation decisions within these rules.
Uncertainty is a reason to retain and investigate, not to guess or repeatedly ask
the owner to classify files. Reachable feature retirement is a separate decision.

## User Stories

1. As the repository owner, I want a whole-repository inventory, so that cleanup addresses the actual sources of disorder.
2. As a maintainer, I want each cleanup candidate classified as keep, move, remove, or investigate with evidence, so that decisions are reviewable.
3. As the owner, I want the agent to decide individual file deletions, so that I do not have to inspect every implementation artifact.
4. As a maintainer, I want uncertain files retained and relocated appropriately, so that useful work is not lost through assumptions.
5. As an agent, I want scratch storage reserved for work records, so that issues and specifications are easy to find.
6. As a maintainer, I want completed tickets and their decisions preserved, so that historical rationale remains available.
7. As an agent, I want ticket indexes, acceptance notes, and contract annexes kept with their specifications, so that work records remain understandable.
8. As a maintainer, I want reusable probes converted into maintained tests where practical, so that their unique coverage runs routinely.
9. As a maintainer, I want operational scripts in the maintained tooling area, so that their purpose and execution are discoverable.
10. As a maintainer, I want useful historical verification evidence organized separately from scratch records, so that evidence remains available without cluttering the tracker.
11. As a developer, I want disposable logs, screenshots, temporary environments, and reports directed into ignored cache storage, so that routine work does not dirty the repository.
12. As a maintainer, I want artifact producers updated, so that cleanup does not disappear on the next run.
13. As an agent, I want active links and command references repaired after moves, so that instructions still work.
14. As an owner, I want historical verification claims kept accurate, so that relocation is not presented as a fresh successful run.
15. As a maintainer, I want proven dead scaffolding removed, so that irrelevant examples do not compete with product code.
16. As an application user, I want reachable features preserved, so that repository cleanup does not silently remove functionality.
17. As an API consumer, I want contracts and error behavior preserved, so that organization changes do not break integrations.
18. As a developer, I want feature-specific UI, hooks, types, and tests colocated, so that related behavior can be understood together.
19. As a developer, I want backend modules separated by responsibility, so that dependencies and ownership remain clear.
20. As a maintainer, I want oversized files reviewed for cohesion, so that decomposition improves comprehension rather than merely lowering line counts.
21. As an agent, I want one consistent source-file size policy, so that conflicting documents do not produce inconsistent changes.
22. As a test maintainer, I want narrow documented exceptions for cohesive scenarios and fixtures, so that file limits do not force harmful fragmentation.
23. As a maintainer, I want tests organized around protected behavior, so that success, failure, boundary, and concurrency cases remain discoverable.
24. As an owner, I want meaningful assertions preserved, so that a smaller test suite does not hide reduced confidence.
25. As a developer, I want test discovery and shared fixtures preserved after moves, so that tests do not silently stop running.
26. As a maintainer, I want redundant tests removed only when equivalent meaningful coverage remains, so that consolidation is safe.
27. As an owner, I want authentication and shop isolation preserved, so that internal refactoring cannot expose private records.
28. As a seller, I want payment matching, confirmation, corrections, and reuse protection preserved, so that cleanup cannot change business outcomes.
29. As a buyer-link holder, I want existing access limits preserved, so that organization changes do not grant seller authority or expose private details.
30. As a seller, I want courier draft review and uncertain booking outcome safeguards preserved, so that cleanup cannot cause duplicate or premature bookings.
31. As a Bengali or English user, I want language behavior and entered business data preserved, so that refactoring does not change presentation contracts or repeat mutations.
32. As a developer, I want offline tests to remain usable without live credentials, so that cleanup does not introduce external dependencies into normal development.
33. As a maintainer, I want documentation checked against owning code, so that outdated scaffold descriptions do not guide future work.
34. As an agent, I want practical automated convention checks where appropriate, so that the same disorder is less likely to recur.
35. As an owner, I want unrelated checkout changes protected, so that cleanup does not overwrite concurrent work.
36. As a reviewer, I want focused verification after each bounded group, so that failures can be attributed to a small change.
37. As an owner, I want a final full verification report with skipped and unrun gates, so that local success is not confused with production readiness.
38. As a future agent, I want resumable cleanup decisions and remaining exceptions recorded, so that unfinished work can continue without repeating the audit.

## Implementation Decisions

- The approved design covers application code, tests, tooling, documentation,
  tracked generated artifacts, and relevant untracked clutter. Inspect current
  checkout changes first; never treat untracked files as disposable merely because
  they are untracked. Do not read or expose real credential files.
- Establish the inventory before inspecting leaf components. Trace imports,
  runtime entry points, routes, commands, test discovery, contracts, fixtures,
  dynamic usage, and artifact producers before classifying removal candidates.
  Lack of a static import alone does not prove a file is unused.
- Maintain an evidence-backed disposition record: candidate, purpose, references,
  decision, destination where relevant, protected behavior, and verification.
  Counts and age alone are not deletion evidence.
- Reserve scratch storage for Markdown issue/specification/ticket records and
  associated indexes, acceptance notes, and contract annexes. Preserve completed
  work as well as active work. Do not create a second tracker or mass-archive
  completed tickets simply to reduce file counts.
- Promote reusable automated checks into the existing backend, frontend, or
  tooling test locations according to ownership. Put maintained operational
  tools in the existing scripts area. Preserve runnable instructions and imports.
- Place useful historical development verification evidence in the documentation
  verification area. Direct disposable execution output and temporary run data
  into ignored cache storage. Do not blindly preserve private data in a newly
  tracked evidence directory; inspect artifact purpose and sensitivity first.
- A verification screenshot is distinct from removed buyer payment screenshot
  functionality. Preserve the existing screenshot-removal decision; cleanup must
  not restore retired collection, extraction, or private viewing features.
- Delete disposable output and proven dead code. Delete tests only when their
  behavior has been retired or equivalent meaningful coverage remains. Preserve
  unique boundary, failure, security, replay, and concurrency coverage. Retain
  uncertain candidates and record what evidence remains missing.
- Preserve active work-record links when files move. Historical results remain
  historical: retain truthful outcomes and context without implying old browser
  probes were rerun against current behavior. Update operational output paths and
  instructions so future runs do not recreate scratch clutter.
- Keep existing frontend feature boundaries and backend responsibility boundaries.
  Avoid broad horizontal reorganization, generic abstraction layers, or modules
  introduced solely to satisfy file counts. No new application interfaces or
  schema changes are planned; preserve API payloads, stable error codes, public
  projections, persistence contracts, and migration order/history.
- Standardize 250 physical lines as a review trigger and 300 as the source-file
  maximum. Apply the same review discipline to tests, allowing narrow documented
  exceptions for cohesive scenarios or fixtures. Record the reason and scope of
  each exception; do not hide violations with compressed formatting or blanket
  exclusions. Reconcile the conflicting documentation before enforcing this rule.
- Preserve strict TypeScript and typed Python/Pydantic contracts and existing lint
  conventions. Verify apparent violations against actual tooling rather than
  assuming text matches demonstrate violations. Review suppression comments and
  their underlying behavior before removing them.
- Reconcile architecture and agent documentation against the owning code. Keep
  small operational rules concise; keep cleanup history in its work records.
  This housekeeping effort does not require a new domain glossary entry or ADR.
- Preserve seller authority, shop isolation, buyer-link access boundaries,
  seller-supplied payment evidence semantics, independent application secrets,
  payment single-use protection, courier review and reconciliation safeguards,
  Bengali/English presentation boundaries, and English CSV contracts.
- Implement in order: evidence inventory; scratch/tool/evidence cleanup; dead-code
  audit; production-code organization; test organization; convention prevention
  and final verification. Adjust interleaving where a moved probe needs immediate
  test integration. Within every group, verify one bounded feature change before
  modifying the next feature.
- Preserve offline standby behavior and existing optional integration gates.
  Do not require live credentials to perform ordinary development verification.

## Testing Decisions

- Use the already approved verification seams: existing focused backend, frontend,
  and tooling checks during implementation, with the root full check as the final
  pre-handoff gate. No new application seam is needed. These expectations were
  agreed during the cleanup interview; this specification adds no new interview.
- A good test asserts observable behavior at the highest existing practical seam:
  an HTTP contract, rendered user interaction, service boundary for domain behavior,
  or command/filesystem behavior for tooling. Avoid snapshots of internal structure,
  implementation-mirroring assertions, and file-count targets masquerading as tests.
- Backend prior art includes existing contract, authentication, buyer-boundary,
  payment-reconciliation, correction, courier-replay, and PostgreSQL integration
  suites. Preserve their isolation and transactional coverage when reorganizing.
- Frontend prior art includes feature-colocated rendered interaction and localization
  tests. Preserve focus, retained input, error presentation, and no-repeat mutation
  assertions for affected flows. Do not replace them with helper-only unit tests.
- Tooling prior art includes existing process, context, and check-runner tests.
  Extend the owning suite when cleanup changes command behavior or artifact output.
- Before moving tests, record discovery and relevant protected cases. After moves,
  verify collection, fixture resolution, and imports. Explain intentional collection
  changes; raw test-count equality does not establish equivalent coverage.
- For moved tools, verify entry points and output destinations without running
  destructive cleanup, database mutations, or live provider actions. Use existing
  safe test or dry-run boundaries where available; explicitly report unverified
  operational behavior where no safe seam exists.
- Acceptance A1: scratch contains only allowed work records, including useful
  historical notes and annexes; temporary code and execution output are gone.
- Acceptance A2: retained tests/tools are discoverable and runnable from maintained
  locations, and affected active links and instructions resolve.
- Acceptance A3: each removal has evidence and each test consolidation identifies
  retained meaningful behavior; no unique safeguards disappear silently.
- Acceptance A4: affected producers write disposable output into ignored cache
  storage, so ordinary verification does not recreate scratch clutter.
- Acceptance A5: sources satisfy the agreed size rule, tests satisfy the review
  discipline or have narrow recorded exceptions, and documentation agrees.
- Acceptance A6: affected user-facing behavior, API contracts, data authority,
  localization, offline operation, and meaningful failure cases remain intact.
- Acceptance A7: focused checks pass per group and the final root check passes;
  record actual failures, skips, environment blocks, and the final result artifact.
- Acceptance A8: the disposition record and final report identify retained
  uncertainties, documented exceptions, and all unrun acceptance gates.
- Browser, physical-device, screen-reader, hosted, PostgreSQL, and live-provider
  acceptance are distinct from mock tests and HTTP smoke. Preserve existing gate
  requirements and report what actually ran. Do not claim an unrun gate passed.

## Out of Scope

- Silent retirement of reachable product features or changes to business rules.
- A new architecture, stack migration, visual redesign, or new product capability.
- Changing database schemas or deleting migration history as housekeeping.
- Running operational data purges, deleting remote records, changing credentials,
  deploying, or enabling production/provider booking.
- Bulk deletion based on file age, agent authorship, extension, location, or length.
- Arbitrarily reducing test count, weakening assertions, or hiding failing tests.
- Rewriting all historical documents or erasing completed issue/specification history.
- Broad formatter/tool replacement unrelated to the agreed repository conventions.
- Claiming production, browser, or live-provider readiness from local checks.

## Further Notes

- The owner confirmed the final shared design on 2026-10-28 and delegated
  individual deletion choices to the agent. This spec publishes that agreement;
  application cleanup has not yet been implemented.
- The initial read-only inventory used base commit
  `8c86f6b07bd758fbe77beb18b4f3121cd34c1afe` and found 131 tracked scratch files
  mixing work records with artifacts, plus 17 code/test files over 300 physical
  lines. These are historical audit leads, not proof of obsolescence or guaranteed
  counts at implementation time. Recheck the checkout before acting.
- No tests were run to publish this documentation-only specification. The full
  verification gate is required for subsequent code or tooling implementation.
- This is the existing local tracker specification, updated in place. Separate
  implementation tickets have not been created by this request.
