# Middleman: full project revamp plan

Status: proposed; planning deliverable, not implementation approval
Created: 2026-11-02
Source baseline: `0d2f058` plus the existing working tree
Priority: equal emphasis on UX, visual identity, and technical cleanup

## 1. Purpose and scope

Revamp the entire current product around the work after a social-commerce sale:
create an order, share its link, collect buyer details, reconcile an advance,
review exceptions, and prepare delivery. Serve Bangladesh sellers operating one
shop desk and buyers arriving from chat, on phones as well as desktop browsers.

This is a coordinated product redesign with targeted engineering improvements,
not a framework rewrite. Cover seller access/setup, workspace navigation, orders,
payments/SMS, receiving accounts, Pathao, retention, assistant, buyer portal,
localization, accessibility, request lifecycles, tests, and maintained guidance.
The current root is an application entry, not evidence of a marketing site.

Deliver the work in bounded clusters using the [implementation roadmap](implementation-roadmap.md).
The [surface and contract inventory](surface-and-contract-inventory.md) records
the current owners and evidence limits. These files are in `.issues` because the
user explicitly requested that location; the repository normally uses `.scratch`.
Do not duplicate or migrate existing historical tickets as part of this effort.

## 2. Diagnosis and assumptions to challenge

| Evidence in the current project | Implication for the revamp |
| --- | --- |
| `App.tsx` renders a masthead and workflow guide above the seller workspace. | Evaluate moving repeat guidance into first-run help so repeat operators reach work sooner. |
| `index.css` loads base styles before a broad final `theme.css`; older dark surfaces remain in base files. | Consolidate ownership rather than adding another visual override layer. |
| Feature components mix local CSS, inline styles, and global classes. | Migrate shared visual rules incrementally while preserving domain ownership. |
| Seller sections are Orders, Payments, Accounts, and Retention; Accounts also contains Pathao. | Test a clearer division between daily work and setup/maintenance. |
| Order details, assistant panels, and courier review share layered UI. | Design focus, scroll, dismissal, and small-screen behavior together. |
| Server contracts already support attention and preparation work queries. | Expose existing work semantics; do not invent a client-side queue algorithm. |
| Guided mutations distinguish processing, unknown outcome, recovery, and retry. | Simplifying the UI must preserve these distinct states. |

These are source-grounded findings and design hypotheses, not measured usability
failures. Historical screenshots show prior layouts; they do not establish the
current appearance of every screen. Baseline capture and task observation come first.

Challenge three tempting shortcuts: a palette swap will not fix workflow hierarchy;
one generic form/queue abstraction will obscure different business rules; and a
clean mock/browser fixture does not prove hosted sessions, durable concurrency,
payment-provider verification, or successful courier booking.

## 3. Target experience and information architecture

Use Operate behavior for the workspace, buyer submission, setup, and settings;
use Read behavior for explanations, policy, and help. Persist modes in the future
surface briefs rather than declaring one mode for the whole brand.

Recommended seller structure, subject to the first design checkpoint:

- **Orders:** the default daily work surface, with All, Needs attention, and
  Prepare delivery views backed by existing list/work-query contracts.
- **Payments:** received-payment evidence, SMS import, manual recording,
  comparison, conflicts, and correction outcomes.
- **Settings:** receiving accounts, courier connection/defaults, and data retention
  as clearly named subsections. Preserve direct access and unseen-account semantics.
- **Assistant:** optional contextual help and guided actions; the manual workflow
  remains available without opening it.

Do not add a separate top-level delivery application before task evidence supports
it. The preparation queue excludes orders with any submission attempt; failed and
unknown attempts belong to attention/recovery, not a recycled preparation queue.
Changing navigation must not relabel unseen entries as pending work.

Seller desktop sequence: compact identity/session header → section navigation →
page title and main action → clearly scoped metrics → query controls → work list.
Retain user query context when opening details and after mutations. Make
instructional help available without making it a permanent hero above every task.

Phone sequence: compact header → current section and action → compact metrics →
search/filter summary → readable order/payment rows → focused detail surface.
Prototype page scrolling versus a bounded ledger before changing the existing
scroll-retention contract; neither sticky controls nor nested scrolling is free.

Buyer sequence: identify the order and seller context → understand total, advance,
and remaining COD → provide contact/delivery details → enter payment claim →
submit → see the actual server status and next step. Start with one grouped form;
introduce a stepper only if observed completion problems justify extra navigation.

## 4. Visual identity work

The existing light shop-desk identity is the baseline, not the automatically
selected final design. Keep Middleman, bilingual clarity, and factual language.
Develop a replacement visual direction with a recognizable typographic hierarchy,
precise financial layouts, quieter surfaces, and deliberate status treatments.

Explore distinct compositions around a high-density operations list, a focused
review workspace, and a mobile task sequence. Judge them with real product data,
not empty dashboard tiles or decorative graphs. Use the skill's direction/concept
workflow when choosing the replacement world; do not turn this plan into an
unapproved palette, font, or layout contract.

Required design outputs before broad migration:

- One chosen direction demonstrated on a seller queue, order payment review,
  buyer confirmation, and settings, in English and Bengali.
- Updated `DESIGN.md`, semantic tokens, and surface briefs after the design decision;
  document typography, spacing, density, borders, status, focus, and responsive rules.
- Component specimens with normal, focus, loading, disabled, error, and overflow states.
- A migration map from old selectors/tokens to the new owners, with removal criteria.

Typography must carry Bengali conjuncts and long labels; use tabular amounts and
legible identifiers without forcing all financial content into tiny monospace.
Test blocked remote fonts and fallback metrics. Keep the supported light theme
unless a separate product decision adds dark mode. No visual claim of security,
official payment accounts, or independent verification is licensed by this revamp.

## 5. Engineering direction and trade-offs

- Keep React/strict TypeScript/Vite and FastAPI/Pydantic. Backend changes must
  address a demonstrated contract, correctness, or performance need.
- Keep domain state in its owning hooks/services. Share presentation primitives
  only after repeated use demonstrates a stable interface; avoid a universal form engine.
- Consolidate CSS by foundation, semantic components, layout, and feature rules.
  Remove migrated overrides rather than increasing selector specificity.
- Audit request ownership and stale-response guards across token, shop, locale,
  selected order/receipt, filter, pagination, and unmount changes. Cancellation
  saves work; identity checks still protect results when cancellation arrives late.
- Preserve the existing confirmed-submission seam and server mutation authority.
  Route state must not unmount an unresolved submission or silently discard its identity.
- Consider section/query URL state only for refresh/back-navigation value.
  Keep personal/payment data, bearer links, credentials, and chat out of URLs,
  analytics, browser draft storage, and persisted query caches.
- Profile real long lists and refresh patterns before adopting virtualization,
  a query library, global store, or router. Each adds migration and accessibility costs.
- Audit standby/durable parity at changed seams. Never replace server work-query
  predicates, locking, ownership, version checks, or idempotency with UI assumptions.
- Inventory apparently unused demo/template code and stale documentation before
  deletion. Reachability and imports are evidence; an old filename alone is not.

Shared primitives may live under the existing `components/` boundary; seller,
buyer, locale, API, and test code remain with their feature. Review source/tests
at 250 lines and split by responsibility before 300. Avoid a mass folder rename
in the same changeset as behavior and visual migration.

## 6. Product and safety invariants

| Boundary | Must remain true |
| --- | --- |
| Payments | Buyer claim, recorded receipt, reconciliation, and seller acceptance remain distinct. Recording can automatically confirm an eligible order; disclose that before confirmation. |
| Money | Preserve integer minor units, exact parsing/validation, total/advance/remaining-COD meaning, and immutable receiving-account snapshots. |
| Guided actions | Explicit create/record confirmation; preserve the key and immutable payload during processing/unknown/retry. A failed lookup is not proof that a write failed. |
| Courier | Staged is not ready, and ready is not booked. Preserve reviewed submission, attempt history, unknown-outcome reconciliation, and post-submission restrictions. |
| Buyer access | Preserve expiry, revocation/reissue, revision handling, server-field errors, admission gates, and isolation when a different link is opened. |
| Locations | Preserve on-demand cascading choices, clearing invalid descendants, written-address fallback, compact local loading status, and no lookup-retry UI or retired catalogue crawler. |
| Assistant | Keep local guidance available, Gemini optional/advisory, minimized provider facts, freshness checks, and explicit confirmed mutations. Never derive action targets from model prose. |
| Privacy | Preserve shop authorization, write-only courier secrets, private/no-store contracts, retention tombstones, and temporary chat/draft lifetime. |
| Metrics | Bangladesh-today server counts, filtered/loaded results, queue totals, unseen entries, and delivery staging are different concepts. Unavailable counts are not zero. |

## 7. Cross-product acceptance matrix

Every migrated surface must cover first visit, empty data, no filtered matches,
initial loading, refresh with existing data, field validation, forbidden/session
loss, transport failure, successful mutation, stale response, and large content
where applicable. Unknown mutation outcomes require their own recovery UI.

- Validate 320, 390, 768, 1024, and 1440px widths; 200% zoom/reflow; both languages;
  long mixed-script names/addresses; unbroken IDs; zero and maximum-valid amounts;
  one record and several pages. No clipped actions or page-wide horizontal overflow.
- Minimum 44px primary targets and 16px form text; visible focus; semantic headings,
  labels and field errors; status announcements; keyboard dialogs/tabs; focus return;
  reduced motion; text alongside status colors. Verify contrast against actual token pairs.
- Phone software keyboard and safe areas must not cover submit/recovery actions.
  Test assistant/detail overlap, long dialog content, scroll restoration, and back behavior.
- Query changes reset scroll; refresh and mutations preserve relevant context.
  Pagination preserves scope, deduplicates as required, and never treats a page as a total.
- Exercise Bangladesh midnight, retained records, account deactivation, stale versions,
  ownership changes, duplicate clicks, slow old responses, and lost mutation responses.
- Keep offline/manual paths usable without live credentials or external font delivery.

## 8. Sequence, proof, and release

Follow roadmap waves A–E. Each work package names owners, dependencies, and proof.
Use focused frontend/backend commands while implementing one cluster; do not mix
the full application migration into a single review. Run root `npm run check`
as the final code/tooling gate after focused checks pass, recording its fresh result path.

Fresh rendered captures at shipping sizes are mandatory for each migrated cluster.
Keep disposable captures/logs under `.cache`; keep selected reusable acceptance
evidence under `docs/verification`. Record exact fixtures, commit, viewport, locale,
theme, and which real-service paths were or were not exercised.

Baseline task time, errors, navigation reversals, and comprehension for sellers
creating/sharing an order, resolving a payment, and recovering delivery; for buyers,
submitting and explaining the payment/status. Repeat the same tasks after migration.
Set numeric improvement targets after collecting the baseline. Proposed usability
gate: users finish core tasks without coaching and correctly distinguish payment
claims, seller acceptance, staging, and booking; investigate every critical error.

Release only reviewed clusters with compatible APIs and reversible UI changes.
Restore the previous UI on a regression; never roll back payment/courier facts or
erase attempt/idempotency history. A backend schema change needs its own forward
compatibility and recovery plan. Verify hosted authentication, PostgreSQL concurrency,
real-device behavior, and external-provider paths separately before claiming them.

## 9. Decisions and exclusions

At the first design checkpoint, settle the final visual world, Settings grouping,
default queue, detail topology, and mobile scroll model with representative tasks.
None of those choices blocks this plan or authorizes implementation now.

Exclude marketplace discovery, a new marketing funnel, multi-operator permissions,
native apps, new couriers/payment providers, autonomous AI decisions, buyer payment
screenshots/address AI, retired catalogue synchronization, and a stack rewrite.
Revisit only through an explicit scope decision, not as redesign side effects.

Planning validation: this document adds no application behavior. Validation results
and current evidence limits are recorded in the inventory companion.
