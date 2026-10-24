# Manual delivery summaries

In the seller workspace, choose a lifecycle status and select **Download filtered
CSV**. The export includes all matching orders, up to 500, rather than only the
loaded list page. If the result exceeds the bound, narrow the status filter;
exports never silently omit rows. Open **Inspect** and select **Copy delivery
summary** for a fresh summary of one order. Empty results, unavailable service,
clipboard denial and rate limiting are shown beside the controls. Ten summary or
CSV requests per shop per minute are permitted.

Both summaries show the fixed agreed total, required advance, accepted advance,
lifecycle, expected COD and actual COD. Blank accepted/actual CSV fields mean no
accepted allocation, rather than zero. A cancelled order can retain its accepted
allocation and actual balance; its lifecycle must be reviewed before dispatch.
Confirmation expresses seller acceptance, not independent provider verification.

Buyer names, contact numbers and raw delivery addresses come from the current
buyer revision. CSV quotes delimiters, quotes and newlines, and prefixes
formula-like text with an apostrophe. Import contact numbers as text to retain
leading zeroes. Exports contain personal delivery details: handle saved copies
according to the shop's retention policy. They omit payment claims, sender
numbers, evidence URLs and buyer portal tokens.

These are manual delivery aids only. They do not book couriers, update courier
records or calculate delivery prices.

Before a permissioned pilot, follow the existing
[baseline measurement procedure](pilot-baseline-measurement.md) and
[whole-workflow timing guidance](../.scratch/phase-1-order-confirmation/acceptance.md#pilot-evidence).
Compare seller setup, import and review effort and buyer completion with the
same seller's baseline, including bulk effort allocated across orders. Hosted
authentication, retention and the other launch gates still apply.
