# 02: Capture parcel details early

**What to build:** A seller can optionally supply parcel weight and quantity while creating a buyer link, then see and complete or correct those details in the confirmed order's courier draft.

**Blocked by:** 01 — Create courier drafts on confirmation.

**Status:** done

- [x] Extend the typed order-creation workflow from form through API, persistence, and draft display with optional parcel weight and quantity. Do not require courier setup or parcel preparation to create a buyer link.
- [x] Require explicit valid weight and quantity before a draft can be considered complete. Do not silently supply a guessed weight or quantity.
- [x] Provide authenticated, shop-scoped, versioned draft editing for missing or corrected parcel details. Reject invalid values without losing other entered draft data.
- [x] Persist the seller's early values through confirmation and process restart. Later draft edits preserve the order's agreed terms, accepted advance, and remaining COD calculation.
- [x] Show which parcel fields remain incomplete and distinguish optional early entry from fields needed before booking. Follow existing modal accessibility, mobile layout, and error-association conventions.
- [x] A stale edit or another seller's request cannot overwrite current parcel details. Duplicate edits follow existing idempotency/version conventions where applicable.
- [x] Verify through API/PostgreSQL tests and create-order/draft component tests: omitted early fields, valid early entry, completion after confirmation, invalid inputs, stale versions, ownership, and restart persistence.
- [x] Run focused tests and root `npm run check` as the final gate; report actual results. This ticket does not submit a courier request.

## Implementation record

- `orders` and `courier_drafts` store nullable `parcel_weight_grams` (1..1,000,000) and `parcel_quantity` (1..10,000). Draft updates use `version` with `expected_version`, `Idempotency-Key`, `STALE_VERSION`, and `IDEMPOTENCY_KEY_REUSED` semantics.
- `PATCH /api/seller/orders/{order_id}/courier-draft` edits confirmed drafts only; omitted fields stay unchanged, explicit nulls and empty payloads are rejected, and foreign/missing orders return 404. Early values are copied into the draft at confirmation; edits touch only draft parcel fields.
- UI: optional kg/quantity fields on create-order; draft shows ordered missing fields, edits with stable idempotency keys across retries, hides cross-session save errors, and offers reload after stale/unknown outcomes.
- Verified: focused memory API tests (12), PostgreSQL courier/draft tests (10), frontend component/parcel tests, and root `npm run check` (tooling, backend lint/types/tests, frontend lint/tests/build, HTTP smoke) all passed against a disposable loopback PostgreSQL 18 cluster.
- Not in scope: courier submission. Existing unrelated working-tree changes (`GLOSSARY.md`, `frontend/src/App.tsx`, `frontend/src/App.test.tsx`, untracked planning docs) remain untouched.

## Review follow-up — 2026-10-26

- Reproduced the create-order parcel validation accessibility failure with a regression test before applying the fix: custom validation stopped submission without marking or describing the invalid inputs.
- `useEarlyParcelDetails.ts` now owns optional parcel values and field-specific validation errors; `CreateOrderModal.tsx` uses its validated payload. `ParcelEarlyFields.tsx` associates inline alerts with each invalid input and focuses the first invalid field on submission. Editing clears only that field's error and does not move focus. Entered values remain intact.
- `FormErrorBanner.tsx` now announces general form failures with `role="alert"`. `CreateOrderModal.test.tsx` and new `CreateOrderParcelValidation.test.tsx` cover announcements, both invalid fields, focus, correction, preserved entries, and successful retry.
- Focused command: `npm run test:frontend -- src/features/seller/CreateOrderParcelValidation.test.tsx src/features/seller/CreateOrderModal.test.tsx src/features/seller/CourierDraft.test.tsx src/features/seller/parcel.test.ts` — 4 files, 16 tests passed.
- Initial root check `.cache/checks/check-FEKFI6/result.json` failed in backend tests under local runtime settings and inaccessible Windows temp paths. Reran `npm run check` with process-local `SELF_TEST_MODE=false`, `TEMP`/`TMP=E:\middle_man\.cache\parcel-review-temp`, and `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.cache/parcel-review-pytest`.
- Final gate `.cache/checks/check-v9P42D/result.json`: all eight stages passed; backend 406 passed / 122 skipped, frontend 169 passed. `git diff --check` passed. PostgreSQL cases were skipped in this run; browser, screen-reader, physical-device, and live-provider acceptance were not run.
- No remaining implementation action from this review. Browser/screen-reader acceptance remains a separate unverified gate. Unrelated checkout changes were preserved; no commit created.
