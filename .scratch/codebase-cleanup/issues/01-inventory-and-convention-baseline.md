# 01: Establish cleanup inventory and convention baseline

**Status:** ready-for-agent

**What to build:** A reviewable cleanup map and consistent convention baseline that let a maintainer distinguish disposable artifacts from maintained behavior and execute each subsequent slice within one fresh context window.

**Blocked by:** None (can start immediately).

- [ ] Recheck checkout status and base revision; protect unrelated tracked and untracked work and avoid credential files.
- [ ] Inventory application code, tests, tooling, documentation, generated artifacts, and relevant untracked clutter before inspecting leaf components.
- [ ] Record each candidate's purpose, references or entry points, keep/move/remove/investigate decision, intended owner or destination, protected behavior, and required checks. Static non-reference, age, authorship, and size alone are insufficient deletion evidence.
- [ ] Record existing test discovery and meaningful coverage, distinguishing offline checks, optional PostgreSQL checks, and browser/live-provider evidence.
- [ ] Reconcile documentation around 250 physical lines as a review trigger and 300 as the source maximum; apply the same review discipline to tests with narrow documented cohesive-scenario/fixture exceptions.
- [ ] Bound each later ticket to concrete responsibilities and acceptance targets in its work record. If a slice cannot fit one fresh context window, propose a split before starting it; do not silently expand its scope.
- [ ] Preserve existing architecture and domain decisions, API contracts, migration history, meaningful assertions, and product behavior. No feature retirement or remote data cleanup is authorized.
- [ ] Verify changed documentation references; if code or tooling changes, run appropriate focused checks and final root `npm run check`. Record actual results and unrun gates.
- [ ] Record the candidate map and next action without claiming implementation cleanup is complete.

