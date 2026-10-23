# Pilot Baseline and Aggregate Measurement Boundaries

Normative specification for measurement under Ticket 01 and Phase 1 acceptance.

## 1. Privacy-Safe Aggregate Boundaries
To measure pilot effectiveness without compromising buyer or seller privacy:
- **No Personal Data in Metrics**: Metrics records MUST NEVER record buyer names, full phone numbers, delivery addresses, transaction screenshots, or raw SMS content.
- **Aggregates Only**: Measurement is restricted to integer counts and duration intervals:
  - Total order links generated.
  - Total submissions received.
  - Active handling time (seller active duration from receipt inspection to confirmation/decision).
  - Exception and match category frequencies (`MATCHED_AUTOMATIC`, `CONFIRMED_MANUAL`, `REJECTED`, `CANCELLED`).
- **No Analytics Dashboard**: Phase 1 explicitly excludes buyer tracking dashboards or marketing analytics.

## 2. Existing Seller Handling Time Baseline Procedure
Before rolling out automated confirmation to a pilot seller:
1. **Observation Phase**: Measure 3–5 candidate sellers during their routine manual workflow for 20–30 consecutive orders.
2. **Recorded Intervals**:
   - Order creation / payment details dispatch in chat (seconds).
   - Receipt & SMS inspection and TrxID checking (seconds).
   - Address verification and courier preparation (seconds).
3. **Baseline Metrics**: Calculate median handling time and interquartile range (IQR) per order.
4. **Target**: Goal is a demonstrable reduction in seller handling time (e.g. >= 50% reduction in median manual verification time) without introducing unverified automated acceptances.
