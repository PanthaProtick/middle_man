# Package 01 expert walkthrough outcomes

Date: 2026-11-02; source `0d2f058`; [baseline](baseline.md).
Evidence: [archive and reproduction](../../docs/verification/revamp-baseline/README.md).

## Method and task observations

One expert operator used synthetic records in the current application and isolated
production components. No representative seller/buyer was recruited. No time,
success-rate, comprehension score or improvement claim is made. Outcomes below
are **expert hypotheses**, with pilot validation retained for later acceptance.

| Task | Observed outcome | Hypothesis / next design question |
| --- | --- | --- |
| Create/share | Guided order fields require account/product/total/advance. Deliberate creation with injected 503 locks editing and discard; Check submission returns not-found, Retry confirmed submission reaches Awaiting buyer with actual returned link. | Preserve explicit confirmation and unresolved-attempt ownership while reducing form/chat duplication. Clipboard/provider reachability is not proved by seeing a link. |
| Buyer claim | Selected simulated city → zone → area; clearing city disabled/cleared descendants. Entered contact, sender, transaction and written address; unsupported-location selection allowed submission; local successful response reached Pending Seller Review. | Keep manual destination fallback and contact/sender distinction; test whether buyers understand claim versus payment verification. |
| Find work | Pagination appended the third order; a new search produced a no-match result and filtered CSV label. Ordinary query UI remains distinct from server attention/preparation queries. | Test whether sellers find backlog work despite the long introduction and today-only metrics. |
| Review evidence | Selected receipt displayed claim450 versus receipt500, exceptions and COD2000. Advice opened with selected-preview meaning and separate decision warning. Explicit reason/acceptance reached seller-accepted allocation and accepted history. Injected409 disabled stale decision. | Keep preview, advisory guidance and seller acceptance separate; pilot seller must explain which fact is independently verified. |
| Record payment | Guided recording disclosed possible automatic reconciliation and lack of provider verification. Injected unknown locked fields; lookup then retry reached Payment recorded, unmatched receipt and Open payment action. | A recovered receipt must retain reconciliation outcome, not just a success toast. |
| Correct buyer/link | Correction fields/history rendered; stale save showed refresh recovery. Revoking removed revoke action and showed revoked status; reissue returned active link controls. Replacement and cancellation reason forms were inspected; cancellation callback removed nonterminal actions. | Context matters: isolated specimens prove controls, not integrated detail layout or a durable cancellation history. |
| Prepare delivery/recover | Earlier integrated confirmed-order captures show parcel proposal, review and unknown-attempt recovery, including Bengali. Initial duplicate-booking block and explicit attach-existing/confirmed-noncreation paths remained visible. | Preserve staging vs booking, unknown vs failed, and evidence requirements. No courier mutation/provider request was executed. |
| Recover access | Real `SellerSession` rendered against fixture-only Clerk hooks and401 reason headers: expired, origin rejection and not-yet-valid reconnect.403 workspace denial separately captured. | Generic workspace errors are not session recovery. Pilot must find retry/diagnostic without losing context. Actual Clerk persistence remains unproved. |

The scenarios are independent fixtures. They do not represent one persisted
end-to-end order across browser tabs, a real payment, or a courier booking.

## Keyboard, focus and scroll

- Creation opens with focus on `productName`; Escape removes the dialog and returns
  focus to Create Order Link. Shift+Tab from product reaches the English locale
  control inside the dialog. This is a sampled tab-order check, not an exhaustive trap audit.
- Phone row expansion exposes Inspect. Opening/escaping detail at the same390px
  viewport returns focus to Inspect. Moving from desktop to phone while the dialog
  is open can hide the original trigger and leave focus on body after dismissal;
  retain a responsive focus-return case for package06.
- End from Overview selects/focuses Buyer & link; Home returns to Overview;
  ArrowRight selects Payment. The fourth tab is keyboard reachable despite initial
  partial visual clipping. The initial tab-strip affordance still warrants design work.
- Opening nested review advice, then Escape, leaves the detail dialog open and
  returns focus to Ask AI. A second detail Escape closes the dialog. Advice is a
  separate scroll surface; long modal/recovery screenshots require internal scrolling.
- `useScrollRetention.ts` resets position on query/reset-key change and restores it
  after dependency refresh; `useScrollRetention.test.tsx` covers this contract.
  Pagination/no-match were observed in-browser. Precise manual list-scroll restoration
  was not measured; do not infer it from full-page screenshots.

## Responsive and accessibility evidence

- Initial capture set:390/1440, plus320/768/1024 seller widths. Completion set adds
  both-language correction/evidence/outcomes/link/access/long-name states at390/1440,
  selected receipt/advice/stale acceptance, and guided payment unknown states.
- No page-wide horizontal overflow was measured in either capture manifest. Internal
  clipping, scrollability and focus visibility are separate questions.
- A200-codepoint unbroken product name is within the frontend limit but stretches
  the phone card vertically. Avoid equating “no horizontal overflow” with usable
  content density. Some fields in specimens use bilingual synthetic text deliberately.
- Forced system-font rendering at320px Bengali was captured with `fallback=1`.
  This overrides font families in the fixture; it does not prove a network font outage
  or all operating-system Bengali fallback fonts. Production CSS imports Google Fonts.
- A720×500 CSS viewport records half-width desktop reflow. Browser zoom shortcut
  produced no measured zoom change; **actual200% zoom was not verified**. Retain it
  for foundations/browser acceptance, together with screen-reader contrast/name audits.
- `styles/theme.css:195` supplies reduced-motion animation/transition/scroll overrides.
  Source inspected; OS reduced-motion emulation, physical safe areas and virtual-keyboard
  interaction were not run. These are acceptance risks, not passing results.

## Pilot tasks retained

Recruit representative sellers/buyers when available. Ask them to create/share,
submit a buyer claim, find and compare evidence, prepare delivery and recover an
unknown attempt without coaching. Record hesitation, errors, coaching, completion,
and their explanation of claim/acceptance/staging/booking. Preserve unsuccessful
outcomes and test both languages/phone use. Baseline completion uses the roadmap's
explicit expert-walkthrough alternative; it does not waive this validation.

## Package boundary

Package01 closes the evidence inventory and records the current behavior/unknowns.
The listed accessibility and usability findings are inputs to later implementation
packages, not baseline UI fixes. Package02 may compare directions and prototypes;
the roadmap still requires a design decision before broad migration.
