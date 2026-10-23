# F-Commerce Order Confirmation Portal

> Historical idea and initial proposals. The Phase 1 interview decisions are
> consolidated in the approved [phase-1-design.md](phase-1-design.md). The
> [implementation spec](../.scratch/phase-1-order-confirmation/spec.md) expands those
> decisions. These documents take precedence where the proposals below conflict.

**Phase 1 Project Idea: AI-assisted advance verification and order confirmation for Facebook and Instagram sellers in Bangladesh**

| | |
|---|---|
| **Document type** | Project idea and Phase 1 specification |
| **Product type** | Mobile-first web application (no app install for buyers); AI via Gemini API calls from the backend |
| **Phase 1 scope** | Order link, buyer address and payment proof submission, AI extraction, SMS-based verification, order confirmation and buyer status page |
| **Deferred** | Pathao / Steadfast courier booking, risk scoring, messenger bots (see Section 11) |
| **Status** | Idea and flow agreed; validation with real sellers still pending |

---

## 1. Summary

Many Bangladeshi home-based sellers close sales inside Facebook Messenger or WhatsApp. After a buyer agrees to purchase, the seller still has to collect a small delivery advance by bKash or Nagad, check that the payment is real, and record a clean delivery address. Today this is done by hand: reading payment screenshots, cross-checking transaction IDs against incoming SMS messages, and copying messy addresses out of chat.

This project turns that manual step into one shareable link. The seller drops the link into the chat; the buyer fills in their details and uploads proof of the advance payment on a mobile web page; AI reads the screenshot and structures the address; the seller verifies the payment against their SMS records; and the order becomes Confirmed. The conversation stays human, and only the repetitive, error-prone finalisation is automated.

> **Design principle:** the AI extracts and structures information, but it never decides that a payment is real. Verification rests on deterministic checks (duplicate TrxID, amount match) and on matching the TrxID against the seller's own SMS records. A wrong AI reading therefore fails safely (no match) instead of silently approving a fake payment.

---

## 2. Problem Statement

The following pain points were identified in the original market brief and are to be confirmed through seller interviews:

| Pain point | What happens today | Consequence |
|---|---|---|
| Fake or rejected COD orders | Buyers agree in chat but refuse the parcel at the door. Sellers ask for a small advance (typically BDT 60 to 150) to reduce this. | Lost delivery fees, wasted stock handling, lost time |
| Manual payment verification | Seller reads each screenshot and compares the TrxID against incoming SMS messages by eye. Edited or reused screenshots are possible. | Hours of repetitive checking; fraud risk |
| Messy address collection | Buyers type addresses in mixed Bangla and English (Banglish), often incomplete or ambiguous. | Delivery failures and back-and-forth messages |
| No order record | Order details live inside chat threads. | Hard to track what is confirmed, pending or disputed |

> **Note:** figures in the original brief (for example advance amounts and willingness to pay) are unverified assumptions and should be tested in interviews.

---

## 3. Target Users

**Primary user: the seller.** A solo or small-team Facebook or Instagram seller (clothing, cosmetics, food, accessories and similar) who sells through page comments and Messenger, collects advances by bKash or Nagad, and ships by courier or own delivery. Interviews can be reached online by messaging active page owners.

**Secondary user: the buyer.** A mobile-only shopper who trusts chat-based buying, may be on a slow connection, and will not install an app or create an account. The buyer experience must work in a single mobile browser session from a link.

The product is sold to the seller (a small-business tool), while the buyer-facing page must feel as simple as a consumer experience.

---

## 4. Phase 1 Scope

| In scope (Phase 1) | Out of scope (later phases) |
|---|---|
| Seller sign-up and payment account setup (bKash / Nagad numbers) | Pathao / Steadfast courier booking and COD staging |
| Order link creation (product, price, advance, payment number) | Risk scoring and buyer reputation across sellers |
| Buyer page: address, advance proof upload, status view | Messenger / WhatsApp bots and automatic chat replies |
| Gemini address structuring with buyer confirmation | Image forensics for edited screenshots |
| Gemini screenshot extraction with buyer confirmation | Native Android SMS forwarder |
| Duplicate TrxID and amount checks | Buyer SMS or push notifications |
| Seller SMS paste and automatic TrxID matching | Holding or processing money (the app never touches funds) |
| Seller dashboard, order statuses, copy and CSV export | Multi-user seller teams, analytics dashboards |

---

## 5. Phase 1 User Flow

The numbered steps below are the agreed flow. Step 1 happens outside the application, in the seller's existing chat.

| Step | Actor | Action and system behaviour |
|---|---|---|
| 0 | Seller | Signs up (phone or email), enters shop or page name and adds one or more bKash / Nagad receiving numbers. One-time setup. |
| 1 | Seller and buyer | Negotiate and agree on the item in Messenger or WhatsApp. The human trust loop is unchanged. |
| 2 | Seller | Creates an order: product name, price, required advance, and which payment number to use. The system generates a unique link and sets the order to Awaiting buyer. The seller pastes the link into the chat. |
| 3 | Buyer | Opens the link on mobile (no install, no account). Sees shop name, product, price, advance due, remaining COD balance (for example 1,500 minus 120 = 1,380 BDT) and the seller's payment number with a copy button. |
| 3a | Buyer | Enters name, phone and delivery address as free text. Gemini structures the address into district, thana, area and street line; the buyer reviews and confirms or edits the result. |
| 3b | Buyer | Sends the advance from their own bKash / Nagad app, then uploads the payment confirmation screenshot. |
| 4 | System | Gemini extracts provider, TrxID, amount, sender number and timestamp. The buyer sees the values and can correct them. Automatic checks run (Section 7). Order becomes Proof submitted. |
| 5 | Seller | Sees the order in the dashboard and pastes incoming bKash / Nagad SMS text. The system parses the SMS and matches TrxID and amount against pending orders. Match: Verified. Mismatch or no match: Flagged. The seller can also manually reject. |
| 6 | System | Verified orders become Confirmed. The seller sees a clean summary (name, phone, structured address, COD balance) with copy and CSV export. The buyer's link shows the confirmation. |

### 5.1 Order status lifecycle

| Status | Meaning | Next states |
|---|---|---|
| Awaiting buyer | Link created; buyer has not submitted proof | Proof submitted, Expired |
| Proof submitted | Buyer submitted address and screenshot; waiting for seller verification | Verified, Flagged, Rejected |
| Flagged | Automatic or SMS check failed; seller must decide | Verified, Rejected |
| Verified / Confirmed | TrxID and amount matched (or seller approved manually) | End state in Phase 1 |
| Rejected | Payment could not be verified | Proof submitted (resubmission, limited attempts) |
| Expired | Link passed its expiry time without proof | End state (seller can create a new link) |

> Verified and Confirmed are treated as one state in the first build; they are listed together because the buyer sees one confirmation. Flagged is an internal label.

### 5.2 Buyer status page

The same link the buyer received in chat becomes their status page. After submission, reopening the link shows the current state instead of the form:

| Order status | What the buyer sees |
|---|---|
| Awaiting buyer | The order form (product, advance due, payment number, upload) |
| Proof submitted | "Pending: the seller is verifying your payment", with a summary of what was submitted and a simple timeline (Submitted, Verifying, Confirmed) |
| Flagged | Shown as Pending. The buyer is never told they were flagged, so an honest typo does not feel like an accusation |
| Verified / Confirmed | "Order confirmed" with order summary and the COD balance to pay on delivery |
| Rejected | "Payment could not be verified. Contact the seller or upload a corrected screenshot" with a limited resubmission option |
| Expired | "This link has expired. Please contact the seller." |

- The link carries a long random token (not a sequential ID) so other orders cannot be guessed.
- The page masks personal data (for example partial phone number, address summary) in case the link is shared.
- Edits are locked after submission; corrections happen through reject and resubmit.
- Resubmission is allowed only after Rejected and capped at 2 to 3 attempts.
- The page refreshes its status every 20 to 30 seconds while open, plus a manual refresh button.
- Unpaid links expire after a seller-adjustable period (default 24 to 48 hours).
- A "Message the seller" link points back to the chat if the seller provides one.

---

## 6. AI Components (Gemini API)

AI is used through API calls from the backend only. No model is trained or hosted. The API key never reaches the browser. Exact model names, pricing and free-tier limits must be checked in Google's current documentation before building, as they change frequently.

### 6.1 Address structuring

**Purpose:** convert a free-text Banglish or Bangla address into clean fields the seller can use, and prepare the data for courier integration in Phase 2.

| Aspect | Design |
|---|---|
| Input | Raw address text, optional district chosen by the buyer, and a candidate list of thanas and areas for that district where available |
| Output (JSON schema) | district, thana, area, street_line, landmark, confidence (0 to 1), needs_clarification (boolean), clarification_question |
| Mode | Structured output / JSON mode so no free-text parsing is needed |
| Validation | Returned names are matched against a local list of districts and thanas; unmatched values are treated as unconfirmed |
| Buyer confirmation | Parsed result is shown ("We will deliver to: Mirpur 10, Dhaka. Correct?"); the buyer can edit any field |
| Fallback | On low confidence or API failure, show manual dropdowns or a plain free-text address and flag the order for seller review |

### 6.2 Payment screenshot extraction

**Purpose:** save the buyer from typing a long TrxID and pre-fill the values used for verification.

| Aspect | Design |
|---|---|
| Input | Uploaded screenshot (validated type and size, metadata stripped) |
| Output (JSON schema) | is_payment_screenshot, provider (bkash / nagad / other / unknown), trx_id, amount, sender_number, receiver_number, timestamp, confidence, unreadable_fields |
| Rule for missing data | The prompt requires null for any field that is not clearly visible; the model must not guess |
| Buyer confirmation | Extracted values are displayed and editable; the buyer's confirmed values are stored next to the raw model output |
| Trust level | Convenience only. The extracted TrxID is never trusted until it matches the seller's SMS record |
| Fallback | If extraction fails, the buyer types the TrxID and amount manually |

### 6.3 SMS parsing

bKash and Nagad SMS messages follow fairly consistent templates, so the first implementation should use deterministic parsing (patterns) to extract provider, TrxID, amount, sender and time. Gemini can serve as a fallback for messages that do not match any known pattern. Because SMS formats can change, parsing failures must be visible to the seller instead of silently ignored.

### 6.4 Quality measurement

Every extraction stores raw model output, the buyer's confirmed values and any seller correction. This produces real accuracy numbers per field (address match rate, TrxID accuracy, amount accuracy) without any model training.

---

## 7. Verification and Fraud Controls

| Check | Type | Purpose |
|---|---|---|
| TrxID not previously used (any order) | Database uniqueness | Blocks reused screenshots across orders |
| Amount equals required advance | Rule | Catches underpayment and wrong amounts |
| Provider matches seller's accepted accounts | Rule | Catches payment to a different number or service |
| Timestamp is recent and after order creation | Rule | Catches old screenshots |
| TrxID and amount found in seller SMS records | Matching | The real proof of payment; main defence against edited screenshots |
| Seller manual approve / reject | Human | Final authority for flagged cases |
| Upload limits and attempt cap | Rate limit | Prevents abuse and brute-force resubmission |

Image forensics for edited screenshots and cross-seller buyer reputation are deliberately excluded from Phase 1. Duplicate detection and SMS matching are expected to cover most fraud at this scale; this should be reviewed with real data.

---

## 8. Data Model (Proposed)

| Entity | Key fields |
|---|---|
| Seller | id, name, shop_name, login identifier, created_at |
| PaymentAccount | id, seller_id, provider (bkash / nagad), number, label, is_active |
| Order | id, public_token, seller_id, payment_account_id, product_name, price, advance_amount, cod_balance (price minus advance), status, expires_at, buyer_name, buyer_phone, address_raw, address_structured (district, thana, area, street_line), created_at, confirmed_at |
| PaymentProof | id, order_id, attempt_no, image_reference, ai_raw_output, confirmed_values (provider, trx_id, amount, sender, timestamp), check_results, created_at |
| SmsRecord | id, seller_id, raw_text, provider, trx_id, amount, sender, timestamp, matched_order_id, parse_status |
| ExtractionLog | id, type (address / screenshot / sms), input_reference, model_output, final_values, corrected_by (buyer / seller / none), created_at |

> **Constraints to enforce in the database:** unique TrxID per provider; unique public_token; order status limited to the defined set; cod_balance computed from price and advance.

---

## 9. Architecture and Suggested Stack

A conventional web application with two external API dependencies (Gemini and, later, the couriers).

| Layer | Suggestion | Notes |
|---|---|---|
| Frontend | Next.js or similar, mobile-first, Bangla and English UI | Buyer page must be light and work on slow connections |
| Backend | Next.js API routes, Django or similar | Holds the Gemini key; handles uploads and checks |
| Database | PostgreSQL | Relational constraints matter for TrxID uniqueness |
| File storage | Object storage for screenshots | Private bucket, time-limited access, retention policy |
| AI | Gemini API (vision and structured output) | Server-side only; timeouts, retries and manual fallbacks |
| Hosting | Any managed platform with HTTPS | Choose a region with acceptable latency for Bangladesh |

### 9.1 Security and privacy

- HTTPS everywhere; seller authentication with session protection; rate limiting on all public endpoints.
- Unguessable order tokens; masked personal data on the buyer page; no buyer account required.
- Uploaded images validated by type and size, with metadata stripped; private storage with a defined retention period.
- Gemini API key kept on the server; every AI call wrapped with timeout, retry and fallback so an outage never blocks a sale.
- Names, phone numbers, addresses and payment screenshots are sent to Google for processing. A privacy notice is required, and the API terms in use must be checked for data retention and training use.
- Audit log of status changes and seller decisions.

---

## 10. Success Metrics

| Metric | What it shows | Initial target (to be set after baseline) |
|---|---|---|
| Seller time to verify one order | Time saved against the manual routine | Measure baseline in interviews first |
| Buyer completion rate | Share of opened links that reach Proof submitted | Track from first pilot |
| Auto-match rate | Share of orders matched to an SMS without manual work | Track from first pilot |
| TrxID and amount extraction accuracy | Quality of Gemini on real screenshots | Aim for high accuracy (for example 95 percent or more) before relying on pre-fill |
| Address confirmed without edits | Quality of address structuring | Aim for 90 percent or more on the test set |
| Rejected-COD rate of pilot sellers | Business impact against their own baseline | Compare before and after |

> Targets above are proposals, not measured results.

---

## 11. Roadmap Beyond Phase 1

| Phase | Focus | Notes from research |
|---|---|---|
| Phase 2 | Courier staging: create parcels in Pathao and Steadfast with the remaining COD balance | Pathao uses numeric city, zone and area IDs and a pre-created pickup store, so structured addresses must be mapped to its location lists. Steadfast takes a single address string plus name, phone and COD amount. Details come from third-party SDK documentation and must be confirmed in the official docs. |
| Phase 3 | Rule-based risk flags | Simple database rules (for example repeated rejections by the same phone number); no model training. Check whether Pathao exposes a buyer success-rate lookup. |
| Later | Messenger / WhatsApp assistance, Android SMS forwarder, buyer notifications | Depends on platform approval and feasibility checks |

---

## 12. Risks and Mitigations

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Sellers find pasting SMS too much effort | Medium / High | Allow bulk paste; test in interviews; consider a later Android forwarder; offer manual approval as a fallback |
| Gemini misreads Banglish addresses or screenshots | Medium / Medium | Buyer confirmation step, validation against known lists, manual fallbacks, offline test set before launch |
| Buyers abandon the form | Medium / High | Minimal fields, Bangla UI, big copy buttons, no account, mobile testing on low-end phones |
| bKash / Nagad change SMS or screenshot formats | Low to medium / Medium | Deterministic parsing with visible failures; Gemini fallback; monitor parse failure rate |
| Sellers churn (many small shops are short-lived) | Medium / Medium | Keep onboarding under a few minutes; focus on clear time savings |
| Privacy or data-handling concerns | Medium / High | Privacy notice, retention limits, masked data, check AI provider terms |
| Unverified market assumptions | High / High | Validate through interviews and a small pilot before scaling |

---

## 13. Validation Plan

- **Seller interviews (3 to 5):** use the F-commerce interview script from the market brief, and add: "What percentage of your parcels are returned or rejected, and what does each one cost you?" Test willingness to paste SMS text.
- **AI test set:** collect 30 to 50 real Banglish addresses and 20 to 30 real bKash / Nagad screenshots (with permission, personal data protected) and run them through Gemini in a script. Proceed with the AI-first design if address matching and TrxID extraction reach acceptable accuracy; otherwise lean on dropdowns and manual entry.
- **Pilot:** 3 to 5 sellers for about two weeks, measuring the metrics in Section 10.
- **Decision point:** proceed to Phase 2 only if sellers use the link repeatedly and report real time savings.

---

## 14. Open Assumptions to Verify

- Typical advance amounts and the share of sellers who already collect advances.
- Whether sellers are willing to paste SMS text daily, and how many receive advances on personal versus merchant accounts.
- Sellers' willingness to pay and the right pricing model (subscription or per-order credits); not defined in Phase 1.
- Accuracy of Gemini on Banglish addresses and on current bKash / Nagad screenshot layouts.
- Current official Pathao and Steadfast API requirements (for Phase 2).
- Data-protection and consumer-privacy obligations that apply to storing buyer data and payment screenshots in Bangladesh.
