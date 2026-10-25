# 21: Record browser recovery and seller utilities

**What to build:** Exercise link access changes, recoverable failures, mobile interaction and order handoff utilities in the real local browser.

**Blocked by:** 11: Reissue a link for the same order; 12: Keep replacement links isolated; 14: Recover from screenshot storage failures; 16: Verify conflict and correction recovery; 20: Record the real-session manual browser journey.

**Status:** completed — browser recovery, failure isolation and seller utilities recorded; final root gate passed

## Acceptance criteria

- [x] Record revoke/reissue/replacement behavior and buyer retry/offline/visibility recovery without stale status/private data; cover mobile layout, keyboard use and readable errors.
- [x] Exercise storage failure recovery and seller review/correction/exception paths through the UI without claiming new domain behavior.
- [x] Paste actual copied link/summary into another application and import the actual CSV; check Bangla, quoting, formula-like text and correct balances.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Existing buyer/seller UI, access actions, polling/retry behavior, evidence errors, clipboard and CSV controls.

## Verification target

Record dated browser/app observations on the same candidate and real provider setup as ticket 20. Record defects with reproducers and send nontrivial changes to the owning ticket.

Coverage: Browser evidence for AC10 disabled/manual, AC11, AC19–AC21, AC24–AC38, AC45–AC48 plus link-access cases. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Broad UI redesign, courier integrations and hosted/native-browser permission guarantees beyond observed behavior.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

### 2026-10-25 browser recovery and seller utilities verification — PASS

Final unfiltered `npm run check`: **PASS**, `.cache/checks/check-emhSRb/result.json`, finished `2026-10-25T12:23:36.999Z`.
- Tooling tests: PASS (0.6s)
- Backend lint: PASS (0.1s)
- Backend types: PASS (0.6s, 96 source files)
- Backend tests: PASS (7.7s, 506 collected: 394 passed, 112 offline-skipped)
- Frontend lint: PASS (0.3s)
- Frontend tests: PASS (8.0s, 31 test files, 150 passed)
- Frontend production build: PASS (1.3s)
- HTTP smoke: PASS (2.4s)

Browser verification suite: Playwright on Microsoft Edge (Chromium) against live frontend (`http://localhost:5173`) and live backend (`http://127.0.0.1:8000`). All **58/58 automated browser checks passed**; detailed report saved at `.cache/ticket21-evidence/browser-recovery-utilities-results.json`.

| Area | Observable browser result & dated evidence |
| --- | --- |
| AC45 Mobile layout & keyboard navigation | Viewport set to 375x667. Zero horizontal overflow (`scrollWidth: 375 <= 375`). Clear separation between contact number and payment sender inputs. Full keyboard accessibility: Tab navigation through Name, Contact, Address, Sender, TrxID, Advance, and Enter key submission. Inline readable Bangladeshi phone format validation error displayed without popups or raw stack traces. Screenshot: `.cache/ticket21-evidence/mobile-buyer-375.png`. |
| AC45, AC46 Polling lifecycle, offline handling & status preservation | Native offline simulation via `context.setOffline(true)` displays English/Bangla warning notice (`"You are offline. Showing the last saved status. / ইন্টারনেট সংযোগ নেই।"`) while preserving existing order details without data wipe. Reconnecting immediately clears the warning notice. Polling automatically pauses when tab is hidden (`visibilityState: hidden`), and resumes immediately when visible. Terminal status preservation verified: once confirmed, client ignores subsequent late responses with `pending` or `awaiting_buyer` lifecycle, preventing state regression. Screenshot: `.cache/ticket21-evidence/buyer-offline-recovery.png`. |
| AC10, AC11, AC12, AC30, AC34–AC36, AC48 Link access changes | **Revoked link:** Returns HTTP 410 `BUYER_LINK_REVOKED`; UI renders `"Unable to Load Order / অর্ডার দেখা যাচ্ছে না"` and completely wipes order card, terms, and submission form. No stale or private data leaks (screenshot `.cache/ticket21-evidence/buyer-link-revoked.png`).<br>**Reissued link:** Old token returns 404/superseded; fresh reissued link renders order with exact preserved commercial terms (BDT 1,200.00 / 200.00 / 1,000.00), submission status, and deadline (screenshot `.cache/ticket21-evidence/buyer-link-reissued.png`).<br>**Replacement predecessor isolation:** Predecessor link renders its own terminal status (`cancelled`), completely excluding successor order ID, successor token, predecessor ID, and replacement reason; submission and upload inputs are omitted (screenshot `.cache/ticket21-evidence/buyer-link-replaced-predecessor.png`). |
| AC11, AC14 Storage failure recovery & user retry | **Upload failure:** Injected 503 `STORAGE_UNAVAILABLE` on `/api/public/orders/{token}/evidence` displays clear readable error (`"Storage service is temporarily unavailable. Click Retry to re-upload without selecting the file again."`) while retaining the selected file reference in component state. Clicking inline "Retry" button successfully re-triggers upload and attaches evidence without reopening file picker (screenshot `.cache/ticket21-evidence/evidence-upload-retry.png`).<br>**Viewer failure:** Injected 503 on `/api/seller/evidence/{id}` in `EvidenceViewer` renders inline "Retry" button without leaking server filesystem paths. Clicking "Retry" successfully re-queries and renders the image upon storage recovery (screenshot `.cache/ticket21-evidence/seller-evidence-viewer-retry.png`). |
| AC19–AC21, AC24–AC30 Seller review, corrections & exceptions | **Link access controls:** `BuyerLinkAccess` successfully exercises revoke action, displaying `"Buyer link revoked. Seller access remains available."` and updating button to `"Reissue buyer link"`.<br>**Payment exception decision:** `PaymentException` calculates live remaining COD (`BDT 10,500.00`), displays exception badge (`AMOUNT_MISMATCH`), accepts audited reason, and confirms order. Over-total advance (`PAYMENT_EXCEEDS_TOTAL`) disables submit button with explicit warning (screenshot `.cache/ticket21-evidence/seller-payment-exception.png`). |
| AC47 Clipboard copy & external paste | `OrderExport` copies delivery summary to clipboard; simulated external application buffer paste verified exact field formatting: Order ID (`e0e926f5-ac4c-402d-91a8-1e0854d72270`), Product, Lifecycle (`confirmed`), Buyer, Contact, Address, Fixed total BDT, Accepted advance BDT, Actual COD BDT, and mandatory disclaimer: `"Manual delivery aid only; no courier booking, update or delivery-price calculation."` (saved `.cache/ticket21-evidence/pasted-delivery-summary.txt`). |
| AC47 CSV download, quoting, Bangla & formula neutralization | `OrderExport` "Download filtered CSV" triggered and parsed according to RFC 4180 (saved `.cache/ticket21-evidence/order-summaries-downloaded.csv`).<br>1. **Bangla preservation:** Bangla digits (`০১৮০০০০০০০৯`) and UTF-8 characters (`বাংলা নীল ডায়েরি`, `ফারহান করিম`, `ঢাকা ১২০৫`) preserved without replacement character corruption (`\uFFFD`).<br>2. **Quoting:** All cells enclosed in quotes (`csv.QUOTE_ALL`) with embedded commas, quotes, and newlines preserved.<br>3. **Formula neutralization:** Cells starting with `=`, `+`, `-`, `@`, BOM, or control characters are prepended with single-quote `'` (e.g. `'=HYPERLINK(...)`, `'+88019...`, `'@SUM(...)`), preventing spreadsheet formula execution.<br>4. **Balance arithmetic:** Verified across all rows: Total BDT = Required Advance + Expected COD, Total BDT = Accepted Advance + Actual COD, and Actual COD >= 0. |

All Ticket 21 acceptance criteria are verified and complete. Ticket 22 owns final cross-ticket acceptance reconciliation.

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
