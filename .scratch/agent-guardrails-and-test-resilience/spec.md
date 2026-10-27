# Resilient Test Contracts and Agent Execution Guardrails

Status: ready-for-agent

Date: 2026-10-27

## Problem Statement

During autonomous development sessions—particularly large UI/UX or architectural refactoring passes—coding agents encounter severe friction, inflated token consumption, and cascading test regressions. A recent retrospective of development sessions revealed four critical flaws across high and mid severity categories:

1. **Unbounded Exploration and Monolithic Batching (High Severity):** When tasked with broad visual or architectural directives, agents frequently attempt to explore dozens of components upfront without defining a focused plan or boundaries. They then execute large, multi-file batch modifications across disparate functional areas without executing incremental tests between edits. This inflates context sizes to hundreds of steps, degrades model reasoning, and delays defect discovery until after numerous files have been touched.
2. **Brittle Implementation-Detail Test Assertions (High Severity):** Several frontend component test suites assert brittle implementation details, such as concrete inline CSS style declarations (e.g., verifying that a dropdown has a literal style width of 120 pixels) or rigid internal DOM wrappers. When agents enhance layouts, introduce CSS classes, or adjust visual isolation, these tests fail despite the underlying user interactions remaining fully functional. In response, agents often resort to full-file overwrites that inadvertently clobber other essential attributes or trigger long regression debugging loops.
3. **Background Task Polling and Premature Handoffs (Mid Severity):** When long-running verification or test processes run asynchronously in the background, agents frequently poll task status repeatedly and emit premature progress messages to the user while tasks are still active. This breaks the reactive, event-driven harness, wastes tool calls, and fragments final reporting across multiple messages.
4. **Inefficient Navigation and Redundant Reads (Mid Severity):** Agents frequently perform unconstrained full-file reads or read the same large files multiple times in immediate succession, rather than using bounded line-range queries or establishing a target inventory before inspecting leaf components.

## Solution

Establish robust repository agent guardrails, resilient behavioral testing contracts, and disciplined navigation practices:

1. **Refactor Brittle Tests to Behavior and Accessibility Semantics:** Modernize component test assertions to verify accessible roles, labels, interactive states, and user-observable DOM elements rather than checking inline CSS style strings or private wrapper elements. Functional unit tests must remain green during purely visual and responsive layout refactoring.
2. **Codify Bounded Slicing and Incremental Verification in Agent Guardrails:** Update repository agent instructions to mandate that broad refactoring tasks be decomposed into bounded feature clusters. Require running focused test commands immediately after modifying each cluster before moving to the next.
3. **Enforce Zero-Polling and Reactive Task Discipline:** Explicitly specify in agent execution rules that status polling on running background tasks is forbidden, and that agents must never emit interim progress messages while background verification tasks are executing. Agents must yield turns and wait for automatic system completion notifications.
4. **Standardize Navigation and Bounded Context Ingestion:** Instruct agents to prioritize bounded line-range queries when inspecting large files and to avoid redundant reads of identical files within the same turn.
5. **Preserve the Root Verification Gate as Canonical Seam:** Maintain the root workspace check command as the single, authoritative verification seam across tooling, backend, frontend, build, and smoke tests.

## User Stories

1. As a repository maintainer, I want coding agents to decompose broad tasks into bounded feature clusters, so that changes remain incremental and easy to review.
2. As a repository maintainer, I want agents to run focused tests after modifying each cluster, so that regressions are detected at the exact point of introduction.
3. As a repository maintainer, I want git pre-commit hooks to run the complete verification gate, so that untested or failing code is blocked from being committed.
4. As a developer, I want unit tests to assert user-visible behavior and accessibility roles, so that CSS and layout improvements do not cause false test failures.
5. As a developer, I want payment account form tests to verify input presence, select option values, and submit triggers without asserting specific inline style widths, so that responsive styling updates do not break test contracts.
6. As a developer, I want parcel validation tests to query fields by label and role rather than structural DOM hierarchy, so that visual container isolation does not break form validation assertions.
7. As a developer, I want tests to verify validation error text and submission payload correctness, so that behavioral regressions remain strictly caught.
8. As a coding agent, I want clear work loop instructions requiring small, testable increments, so that I do not attempt to refactor the entire frontend in a single batch.
9. As a coding agent, I want focused test commands mapped to specific feature domains, so that I can rapidly iterate and verify changes without running full repository checks on every edit.
10. As a coding agent, I want an explicit rule against polling background task status, so that I avoid wasting tool calls on redundant status checks.
11. As a coding agent, I want an explicit instruction not to send interim progress messages while background tasks run, so that my final response delivers a complete, consolidated summary upon task completion.
12. As a coding agent, I want clear guidance to use bounded line-range reads when inspecting large files, so that I avoid exceeding per-read token limits.
13. As a coding agent, I want surgical file editing prioritized over full-file overwrites, so that unrelated comments, imports, and test hooks are preserved.
14. As a coding agent, I want a rule against reading the same file multiple times in identical turns, so that I conserve context window capacity.
15. As a coding agent, I want clear entry route pointers for visual refactors, so that I do not have to perform brute-force directory-wide exploration.
16. As a reviewer agent, I want code changes to be accompanied by passing focused tests at each step, so that I have immediate confidence in code correctness.
17. As a reviewer agent, I want styling updates isolated from functional regressions, so that visual design reviews remain distinct from behavioral reviews.
18. As a reviewer agent, I want clear separation between mechanical rules and human judgment calls, so that linting and automated checks handle deterministic enforcement.
19. As a seller using the merchant workspace, I want UI sections to have clear visual boundaries, without any breakage to account creation or order management.
20. As a seller using the merchant workspace, I want payment account dropdowns to remain responsive on mobile and desktop, without broken validation logic.
21. As a seller using the merchant workspace, I want parcel dimension and weight fields to validate correctly when creating orders, regardless of modal layout styling.
22. As a buyer using the public order portal, I want form fields to display clear validation errors upon invalid submission, regardless of responsive layout styling.
23. As a buyer using the public order portal, I want location selection dropdowns to remain usable across screen sizes, without interfering with payment claim entry.
24. As an autonomous agent, I want the harness to automatically wake me when background verification completes, so that I never need to sleep or poll.
25. As an autonomous agent, I want unambiguous completion criteria for each step, so that I do not stop prematurely before verification has passed.
26. As a developer, I want frontend test execution to remain fast and offline-capable, so that local iteration loops stay under ten seconds.
27. As a developer, I want tooling tests to verify context bounding and security restrictions, so that private files and secrets are never exposed to agent contexts.
28. As a developer, I want test suites to run deterministically across all operating systems, so that platform differences do not introduce flaky test outcomes.
29. As a repository maintainer, I want agent steering documentation to stay strictly under the repository size limit, so that agent context windows are not dominated by process instructions.
30. As a repository maintainer, I want the root check gate to remain uncompromising and reject partial filter flags, so that CI verification cannot be silently bypassed.
31. As a coding agent, I want failure logs from background checks to provide compact bounded tails, so that I can diagnose test failures quickly without reading massive log files.
32. As a coding agent, I want failed edits to trigger immediate hypothesis re-evaluation rather than blind full-file overwrites, so that existing code contracts remain intact.
33. As a developer, I want form input labels and aria attributes kept intact during design passes, so that accessibility tools and unit tests continue to function.
34. As a developer, I want pre-commit verification to run the complete check suite, so that broken types, failing tests, and lint issues are prevented from reaching version control.
35. As a repository maintainer, I want every identified flaw from past sessions addressed with actionable, permanent guardrails, so that future agent runs are significantly more reliable and token-efficient.

## Implementation Decisions

- **Test Assertion Modernization:**
  - Update component test assertions in the payment account setup feature to verify select elements by accessible role and current value rather than inspecting internal inline style width properties.
  - Update parcel validation tests in the order creation modal feature to verify input elements, validation warnings, and submission behavior via accessible labels, roles, and test identifiers rather than concrete DOM tree nesting.
  - Preserve all existing behavioral test cases covering validation errors, successful submissions, and event callbacks.
  - Ensure all frontend unit tests continue to pass in strict isolation with mocked timer and animation frames.

- **Agent Steering and Work Loop Updates:**
  - Update the repository's agent steering instructions to enforce cluster-based decomposition: broad UI or cross-cutting tasks must be planned and executed in distinct feature clusters, with focused tests executed after each cluster before advancing.
  - Add explicit execution guardrails prohibiting background task status polling and banning interim progress messages to the user while background verification commands are running.
  - Clarify context reading standards: mandate bounded line-range reads for large files and prohibit consecutive redundant reads of identical files within the same turn.
  - Keep agent instructions concise, actionable, and strictly below the repository line-count invariant.

- **Preservation of System Architecture and Seams:**
  - Leave backend FastAPI endpoints, Pydantic schemas, and database models untouched.
  - Leave workspace runner scripts and npm script definitions intact.
  - Retain the git pre-commit hook enforcing the root verification check before commits.

## Testing Decisions

- **What Makes a Good Test:**
  - Tests must verify observable user behavior and accessibility contracts: element visibility, accessible role queries, user interactions, and error feedback.
  - Tests must never assert implementation details such as inline CSS properties, wrapper div hierarchies, or private component state.
- **Modules Tested:**
  - Frontend seller feature test suites (payment account setup and order creation parcel validation).
  - Workspace tooling test suite (verifying context query boundaries and gate execution).
- **Test Seams:**
  - **Single Highest Seam (System Gate):** Root workspace verification check, running tooling tests, backend lint and typecheck, backend unit tests, frontend lint and typecheck, frontend tests, production build, and HTTP smoke tests.
  - **Focused Seam (Frontend Feature Behavior):** Focused frontend test runner targeting modified feature test files.
  - **Tooling Seam:** Workspace tooling test runner validating subprocess and context boundaries.

## Out of Scope

- Introducing third-party styling frameworks or modifying build configurations.
- Altering backend domain logic, database migrations, or external API clients.
- Modifying the core architecture of the workspace verification runner.
- Creating remote cloud CI workflows or external telemetry.

## Further Notes

- The primary pre-commit hook already executes the full workspace check command. By modernizing test assertions to focus on behavior rather than styles, UI and styling enhancements can proceed without false test failures.
- All modifications to agent instructions must adhere to the concise style guidelines in the writing-for-agents skill.
