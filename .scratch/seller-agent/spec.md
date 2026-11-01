# Seller agent design interview

Status: ready-for-agent; design and seven-ticket breakdown approved.

## Confirmed decisions

Accepted on 2026-11-01 in interview round 1:

- Collect missing information, present an editable summary, and require an
  explicit Create order or Record payment button before saving. Corrections
  update the pending summary. Successful actions return a linked result card.
- Understand Bengali, English, Banglish, and mixed messages. Respond in the
  conversation's language independently of app locale, with an explicit language
  switch. Preserve entered names, addresses, identifiers, and amounts.
- Initial scope is four workflows: create orders, record payments, find orders
  needing attention, and find orders awaiting delivery staging. Other mutations
  require separately defined behavior and authority.
- Retain conversation context only during the current signed-in app tab's
  lifetime, with a New conversation action. Persistent chat history is excluded.

Accepted on 2026-11-01 in interview round 2:

- Order creation preserves the existing awaiting-buyer flow and returns the buyer
  link, Copy link, and Open order actions; seller-entered buyer details are excluded.
- Payment entry means a seller transaction record using existing reconciliation,
  which may confirm an eligible order. Preview explains this; results report it.
  Derive provider from the selected account; clarify ambiguous account selection.
- Attention includes outstanding backlog, with Bangladesh's current date as
  context, rather than restricting results to orders created today. Candidate
  categories: unresolved reviews, delivery preparation, failed courier submissions,
  and uncertain bookings; exact predicates remain to be settled.
- Awaiting delivery preparation means confirmed orders awaiting preparation,
  excluding booked, submitting, and unknown-outcome bookings. Failed submissions
  and uncertain bookings are separate attention categories.
- Collect sensitive payment details through structured in-window fields. Keep raw
  messages containing sensitive details away from the external model; automatic
  redaction alone is insufficient. Permitted conversation content may use the model.
- Launcher appears throughout signed-in seller workspace, excluding public/buyer
  pages. General chat and order review share one visible assistant window, with
  explicit context switching and preservation of unfinished creation drafts.

Accepted on 2026-11-01 in interview round 3:

- Interpret workflows and collect fields locally; never forward arbitrary raw chat
  text or product names to Gemini. External requests contain only allowlisted
  structured facts. Unrecognized input gets local clarification/workflow choices.
- Server-enforced submission identities prevent duplicate writes from double clicks,
  retries, and lost responses. Resolve uncertain outcomes before another submission;
  editing a summary invalidates its old confirmation.
- Attention includes pending buyer submissions (including uncoded cases), delivery
  preparation, failed courier submissions, and unknown-outcome bookings. Exclude
  awaiting-buyer, completed bookings, cancelled/rejected/expired orders. Active
  submissions show progress rather than immediate action. Deduplicate orders;
  priority is unknown bookings, failed submissions, pending review, preparation,
  with oldest outstanding work first within each category.
- Dashboard actions replace conflicting filters with the represented shared backend
  query and label the change. Results have a paginated preview, total, retrieval
  time, and open/copy-reference actions. Applying a filter retrieves current data.
- Closing preserves conversation and one creation draft. New conversation, reload,
  sign-out, and shop changes clear context. Confirm explicit draft discard; switching
  workflows offers resume/discard, and contextual review preserves the draft.
- Gemini remains optional, live generation off by default, private synthetic-data
  development only. Guided workflows function without it.
- Q16 exception: suspend application request quotas and rate limits for this
  development version, including the shared Gemini ceiling. Do not implement
  limiting. Automated verification makes zero live Gemini calls; the user will
  perform manual live tests. Existing code is not changed by this design record.
- Compact desktop window; full-width mobile sheet; structured result cards, editable
  summaries, status badges, restrained motion, accessible keyboard/focus/screen-reader
  behavior. Success derives only from confirmed application results.

## Requested presentation

- A floating launcher opens a compact chat window, inspired by Pathao's chatbot.
- Polished bilingual responses and actionable order results, including dashboard
  filter buttons and searchable order references.

Accepted on 2026-11-01 in interview round 4:

- Ask for all missing required fields together, retain valid answers, and keep
  optional fields optional. Never invent advance amounts or guess between accounts.
  Clarify ambiguous amounts; accept clear Bengali digits/currency notation and show
  interpreted amounts in the summary.
- Complete one creation action at a time. For multi-action requests ask which to
  start; finish/discard before another creation. Searches preserve the draft.
- Revalidate authorization, accounts, and relevant state on confirmation. Preserve
  fields on conflicts; never silently replace accounts or overwrite conflicting
  payment evidence. Changed summaries require fresh confirmation.
- Provider failures fall back to local guided workflows without automatic Gemini
  retries. Save failures preserve drafts and distinguish failed, still processing,
  and outcome unknown.
- Use fake providers for automated verification; final root check is required for
  implementation. Browser/mobile and manual live Gemini are separate gates.

## Workflow contracts

Order preparation collects product name, positive agreed total, positive required
advance no greater than total, and active receiving account. Parcel weight and
quantity remain optional under existing validation. It creates an awaiting-buyer
order, not a completed buyer submission or courier booking.

Payment preparation collects receiving account, transaction ID, and positive amount.
Provider derives from the account. Sender number and occurrence time remain optional
under existing validation. Confirmation explains reconciliation effects; result
cards report the actual record and reconciliation outcome without claiming provider
verification. Sensitive fields remain local to the application/server boundary.

The pending draft is application state, not model memory. The server determines
valid fields, available actions, query membership, and save outcomes. An external
model response cannot supply executable links or authorize a mutation.

Attention and preparation queries cover authorized, accessible shop orders
across the full dataset, not just the loaded dashboard page. Terminal booking
success and current attempt state take precedence over historical failures. Exact
query implementation must reuse existing lifecycle/attempt contracts rather than
negating delivery_staged. Category ordering uses outstanding-state timestamps with
a stable order-reference tie-breaker; chat and dashboard use identical semantics.

## Acceptance cases

- Complete order input yields an editable summary; incomplete input requests only
  missing/invalid required fields. No write occurs until explicit confirmation.
- Successful creation returns the actual buyer link, copy action, and seller view.
- Payment inputs preserve exact transaction identifiers; ambiguous accounts/amounts
  require clarification. Optional fields do not become mandatory through chat.
- Payment results show actual reconciliation, including eligible confirmation,
  duplicate/conflicting evidence, or unmatched records under existing contracts.
- Double clicks, retries, and lost responses cannot duplicate the confirmed action.
  Unknown outcomes are resolved by submission identity before retrying the write.
- Unauthorized/cross-shop actions and queries fail server-side. Shop changes clear
  conversation/drafts; stale account/record states produce recoverable conflicts.
- External provider requests contain only allowlisted structured facts, including
  when users paste identifiers, phone numbers, addresses, SMS, or instructions.
  Raw chat/product names never enter provider payloads or persisted chat logs.
- Attention includes older backlog, uncoded pending reviews, preparation, current
  failures and unknown outcomes without duplicate orders. Booked, submitting, and
  terminal lifecycle cases follow the accepted exclusions.
- Chat totals and dashboard membership agree under the same query. Filter buttons
  replace conflicting filters transparently and retrieve current data.
- Bengali, English, Banglish, mixed language, Bengali digits, and explicit language
  switches preserve entered data and function independently of app locale.
- Close/reopen and contextual review preserve the one draft. Explicit reset/discard
  asks before losing it; reload/sign-out/shop switch clear temporary context.
- Provider-disabled/failure behavior supports guided workflows with no live-call
  dependency, no automatic provider retry, and no application request limiting.
- Desktop/mobile behavior supports keyboard focus, screen readers, reduced motion,
  non-overlapping controls, and truthful status/result cards.

## Publication

The user requested ticket creation from the consolidated design and approved the
seven-ticket breakdown on 2026-11-01. See the [ticket index](ticket-index.md).
No implementation is claimed; individual blocking edges control the work frontier.

## Evidence and next action

Read-only investigation at base `d66ce9f9bc53f620320b670408734fe6a78c7a24`:
`backend/app/models/order.py`, `backend/app/models/transaction.py`,
`backend/app/services/delivery_staging.py`,
`docs/contracts/orders-search-and-export.md`, `GLOSSARY.md`, and
`docs/adr/0007-review-assistant-data-and-authority-boundary.md`.

Existing order creation returns an awaiting-buyer order and buyer link. Manual
seller transaction entry uses existing reconciliation. Dashboard filters currently
lack shared attention/preparation predicates. A false delivery_staged value alone
does not identify work awaiting preparation.

Next implementation action: ticket 01, when requested. Resume by inspecting the
current diff and owning contracts; no executable behavior has changed.

Verification: documentation record only; no application code changed or application
tests run. `npm run conventions` passed on 2026-11-01 (941 tracked files; 29 at
the 250-line review trigger). New design/ADR records remain untracked, so that
tracked-file check does not establish full validation of those records. Root
`npm run check`, browser/mobile acceptance, and live Gemini testing have not run.
