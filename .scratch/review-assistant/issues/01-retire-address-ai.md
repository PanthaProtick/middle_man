# 01: Retire address AI and erase historical AI copies

**What to build:** Buyers enter their delivery address without address AI controls,
consent prompts, or extraction requests. Historical AI copies disappear while
buyer-confirmed delivery details and order/payment history remain usable.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Implementation difficulty:** 4/5 — High.

**Why:** The visible control is small, but retirement spans cached public responses,
forward migrations, runtime schema readiness, raw/structured retention, maintenance
tools, and historical test fixtures. Incomplete removal can break unrelated cleanup
or erase confirmed addresses instead of AI copies.

**Agent fit:** Strong persistence and compatibility reasoning; comfortable tracing
all consumers before deleting a store. Not a UI-only cleanup assignment.

**Parent:** [Approved spec](../spec.md). Follow the [shared contract](../ticket-index.md).

- [ ] Remove buyer address AI UI, consent flow, extraction client behavior, public
  extraction route, extraction-only provider/models, and obsolete availability
  signal. Old clients cannot still invoke address parsing; configured credentials
  do not restore it.
- [ ] Preserve manual written-address entry and buyer-confirmed structured address
  fields. This slice does not yet make Pathao selections mandatory.
- [ ] Retire address-specific configuration and dependencies only; preserve shared
  Gemini settings needed by later review assistance.
- [ ] Add a forward migration that erases all historical extraction requests,
  responses, generated suggestions, and extraction replay results. Trace where
  each copy lives rather than assuming deletion of raw text is sufficient.
- [ ] Preserve submitted address revisions, payment claims, receipts, allocations,
  lifecycle, and duplicate-payment protection. Do not rewrite historical migrations.
- [ ] Update schema readiness, raw/structured retention, maintenance consumers,
  public response/replay projections, and seller retention presentation so none
  requires the retired extraction store or advertises obsolete AI counts.
- [ ] Seed pre-migration AI records and confirmed address/payment data; prove the
  former are gone and the latter survive. Remaining cleanup/retention operations
  work after migration; repeated supported cleanup is safe.
- [ ] HTTP and rendered tests prove address AI is absent, manual submissions and
  retries still work, and retired extraction access makes zero provider calls.
- [ ] Keep current maintained contracts truthful about retirement; preserve older
  records as history with explicit supersession where necessary.
- [ ] Run focused retirement/migration/retention/public-order tests and final root
  `npm run check`; record results and distinguish local from hosted acceptance.

## Notes

Do not replace extraction with a hidden provider call or move generated suggestions
into submitted-address storage. Private backups and provider-held historical copies
are outside what an application migration can prove deleted.
