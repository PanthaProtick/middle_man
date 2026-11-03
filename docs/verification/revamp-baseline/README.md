# Revamp package 01 evidence archive

Date: 2026-11-02 (Asia/Dhaka). Application source:
`0d2f05857eea9940df13a351e80a80917f512ca6`.
The commit introducing this archive is the baseline evidence commit.

[Baseline](../../../.issues/project-revamp/baseline.md) ·
[Journey map](../../../.issues/project-revamp/baseline-journeys.md) ·
[Action trace](../../../.issues/project-revamp/baseline-action-trace.md) ·
[Walkthrough outcomes](../../../.issues/project-revamp/baseline-walkthroughs.md).

## Contents and evidence limits

162 unique PNG/AX-text pairs: 76 initial captures and 86 completion captures.
`initial-manifest.json` records original URLs, dimensions, language, headings and
alerts. `completion-manifest.json` records latest metrics per completion name.
Native AX exports can be incremental deltas against the preceding browser state;
they are not all standalone full trees. PNGs preserve each captured visual state.
Trailing export whitespace was normalized for the archive; no content was rewritten.
`measurements.json` preserves initial seller control/position measurements.
`initial-source-hashes.json` and `completion-source-hashes.json` identify the
application and fixture sources at each round; fixture sources evolved between rounds,
while application code stayed at the source commit above.

These are real browser renderings of current components with synthetic records.
They are not a pilot study, live authentication, backend mutation, payment/provider
verification, durable integration or accessibility certification. No customer data,
credentials or project environment files were loaded. Existing production CSS can
request its public Google Fonts assets; forced fallback captures are separately named.

`completion-specimen-*` and conditional payment/correction/link/outcome captures
mount isolated production components. Their fixture heading and outer layout are
not production UI. Integrated seller/buyer/guided/session captures use real app
components and CSS. The Clerk double is resolved only by the isolated Vite server;
the application build and production authentication are unchanged.

## Reproduce

From the repo root with locked frontend dependencies already installed:

```powershell
node .issues/project-revamp/baseline-fixture/server.mjs
```

Seller base URL:
`http://127.0.0.1:5186/.issues/project-revamp/baseline-fixture/index.html`.
Buyer base URL: `http://127.0.0.1:5186/orders/synthetic`.
Append `?case=<case>&lang=en` or `lang=bn`. Use390×844 and1440×1000 CSS
viewports. Fresh navigation resets the fixture and locale. Wait for the target
heading/form rather than treating the initial loading state as settled evidence.
Stop with Ctrl+C; task-owned renderer was stopped after capture.

| Case / query | Interaction recipe |
| --- | --- |
| `seller`, `empty`, `error`, `loading`, `setup`, `signedout`, `noaccounts` | Inspect initial state. Use normal section/Create/Record/Inspect navigation for secondary surfaces. Loading deliberately stays pending. |
| `specimen-correction` | Inspect fields, expand revision history. Enter a reason then save. Add `fault=stale` to inspect409 refresh recovery. |
| `specimen-payment` | Select baseline receipt. Compare450 claimed/500 recorded and COD2000; open Ask AI; Escape returns focus. Enter decision reason and accept for local seller-accepted state/history. |
| `specimen-payment&fault=stale` | Select receipt, enter reason, submit; stale decision becomes blocked until refreshed. `fault=blocked` supplies a preview blocker. |
| `specimen-payment&fault=advice-error` | Ask AI returns unavailable/retry. Generate with Gemini in healthy fixture returns local unconfigured fallback; no model request is made. |
| `specimen-evidence` | Inspect receipt/claim comparison, correction fields, observation/reason requirements, history headings. |
| `specimen-outcomes` | Open replace/cancel/reject; inspect reasons and replacement terms; dismiss is local. Captured cancellation uses a synthetic successful callback. |
| `specimen-link` | Revoke shows revoked status; reissue restores active controls with a fresh synthetic URL. |
| `session-expired`, `session-denied`, `session-clock` | Real session wrapper plus fixture hooks/401 reason headers; inspect retry/diagnostic or timed reconnect. `denied` separately returns403 to workspace reads. |
| `paging` | Initial two rows, Load More Orders appends third; nonblank search returns no-match. This is a limited renderer fixture, not server search/paging implementation. |
| `long` | Two rows with200-codepoint unbroken bilingual product names; inspect wrapping and internal list height. |
| `seller&fault=unknown` | Open Seller assistant. Create an order: productSynthetic shirt,total2500,advance500,accountSynthetic receiving account. Confirm → unknown, Check submission → not-found, Retry confirmed submission → saved result. Repeat with Record a payment, TrxIDSYNTHETIC01,amount500. |
| `buyer-locations` (buyer URL) | Choose city1,zone2,area3; clear city to verify descendants clear. Enter synthetic name/contact01900000000/address/sender/TrxIDSYNTHETIC01; choose unsupported for manual fallback; submit reaches Pending Seller Review. |
| `buyer`, `buyer-pending`, `buyer-confirmed`, `buyer-expired`, `buyer-error`, `buyer-revoked` | Initial buyer form/terminal/error states. Revoked and replaced tokens intentionally share the unavailable-link presentation. |
| `courier-unknown` | Inspect confirmed third order → Delivery; internally scroll to reconciliation. No courier mutation is supported by the fixture. |
| `seller&fallback=1` | Forces system sans font at320px for Bengali fallback inspection. This is not network outage simulation. |

The browser is the recorder, not a second application implementation. The fixture
intentionally omits many server mutations and rejects unhandled calls with501 or405.
`fault=unknown` fails the first keyed allowed write and succeeds on the next;
`fault=reset` supplies a storage-epoch recovery error. No fixture behavior is proof
of the real server's idempotency, transaction locking or shop isolation.

## Verification

Completion strict fixture TypeScript, server/inventory syntax, archive integrity
(162 pairs), 68 relative Markdown links and staged `git diff --check`: PASS.
Root `npm run check`: **PASS**, local result
`.cache/checks/check-TR7lAq/result.json` (2026-11-02 08:35:13 UTC).
Used `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.cache/revamp-baseline/pytest-completion-20261102`
to avoid Windows shared-temp permissions. All verification stages passed.
The full command was run after staging the intended files so tracked-file
conventions included the new documentation. Initial root results remain in baseline.md.

Pilot users, live Clerk/providers, PostgreSQL concurrency, physical devices,
assistive technology, actual200% zoom and OS reduced-motion were not run.
Observed keyboard/reflow/fallback checks and source-only scroll/motion coverage are
itemized in the walkthrough. Those limits remain acceptance inputs for later packages.
