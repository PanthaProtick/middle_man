# Plan: Ticket 03 — Retire Full-Catalogue Synchronization and Seller Controls

Date: 2026-10-31
Parent Issue: `.scratch/pathao-on-demand-locations/issues/03-retire-full-catalogue-synchronization.md`
Specification: `.scratch/pathao-on-demand-locations/spec.md`

## Overview
Retire the obsolete full city/zone/area crawler, manual catalog refresh endpoints, and seller catalog status UI. Ensure connection events, scheduled jobs, and CLI commands never trigger complete hierarchy crawls. Keep existing snapshot tables, migrations, and historical submission records intact without destructive database changes. Buyer on-demand location selection remains fully operational.

---

## Detailed Task Clusters

### Cluster 1: Backend API & Service Retirement
1. **API Router (`backend/app/api/pathao.py`)**:
   - Remove `GET /{environment}/catalog` (`catalog_status`).
   - Remove `POST /{environment}/catalog/refresh` (`refresh_catalog`).
   - Remove unused imports (`CatalogStatus`, `pathao_snapshot_jobs`, `pathao_snapshot_sync`, `BackgroundTasks`).
   - Keep connection (`GET`, `PUT`, `DELETE`), stores (`GET`), and defaults (`PATCH`) intact.
2. **Sync Service (`backend/app/services/pathao_snapshot_sync.py`)**:
   - Retire the full crawl logic (`crawl()` and `refresh()`).
   - Keep `run_due()` and `run_one()` as retired no-ops that log retirement warnings and generate 0 provider requests / 0 crawls.
   - Keep CLI entry point `if __name__ == '__main__': asyncio.run(run_due())` safe for any existing scheduled invocation.
3. **Catalog Helper (`backend/app/services/pathao_catalog.py`)**:
   - Remove `reader()` helper (lines 162-171) which was exclusively used for crawler session reuse.
4. **Command Wrappers (`package.json`, `scripts/workspace.mjs`)**:
   - Retire or preserve `refresh:locations` wrapper so that invocation runs the retired no-op without error or crawl traffic.

### Cluster 2: Frontend Seller Settings & Localization
1. **Remove Obsolete Component**:
   - Delete `frontend/src/features/seller/PathaoCatalogStatus.tsx`.
   - Delete `frontend/src/features/seller/PathaoCatalogStatus.test.tsx`.
2. **Update Seller Settings (`frontend/src/features/seller/PathaoSettings.tsx`)**:
   - Remove import and rendering of `PathaoCatalogStatus`.
   - Retain connection cards, environment switch, credentials form, pickup store select, delivery service select, and disconnect button.
3. **Clean Up Obsolete Copy (`frontend/src/features/locale/courierCopy.ts`)**:
   - Remove obsolete catalog strings: `"Buyer delivery locations"`, `"Locations last updated"`, `"Locations are not ready. Buyers can submit a written address."`, `"Updating delivery locations…"`, `"Location refresh failed. Previously saved locations remain available."`, `"Location refresh failed. No saved locations are available yet."`, `"Refresh locations"`, `"Check location status"`.
4. **Update Frontend Tests (`frontend/src/features/seller/PathaoSettings.test.tsx`)**:
   - Assert that seller settings renders connection status, pickup defaults, etc., but does NOT render catalog status or refresh buttons.

### Cluster 3: Reconcile Backend Tests
1. **`backend/tests/test_pathao_catalog_routes.py`**:
   - Assert that `GET /seller/courier/pathao/{env}/catalog` and `POST /seller/courier/pathao/{env}/catalog/refresh` return 404 (retired endpoints).
   - Assert that connection (`PUT`) produces 0 crawl traffic.
   - Assert that public order location endpoint works immediately on demand without sync.
2. **`backend/tests/test_pathao_catalog_session.py`**:
   - Reconcile to assert that the retired sync entry points perform 0 auth calls and 0 provider requests.
3. **`backend/tests/test_pathao_snapshots_postgres.py` & `test_pathao_snapshots.py`**:
   - Reconcile tests: remove calls to retired endpoints `/catalog/refresh` and `/catalog`.
   - Verify `run_due()` does not perform crawls or update snapshot rows.
   - Verify existing snapshot tables (`pathao_catalog_snapshots`, `pathao_catalog_lists`, `pathao_catalog_sync`) and historical rows remain intact in the database.

### Cluster 4: Operations & Documentation
1. **`docs/pathao-catalog-operations.md`**:
   - Document retirement of the full hierarchy crawler and manual refresh endpoints.
   - Instruct operators to remove existing hourly cron jobs (`npm run refresh:locations` or `python -m app.services.pathao_snapshot_sync`).
   - Note that local code removal alone does not prove hosted schedule decommission.
2. **`docs/pathao-location-contract.md`**:
   - Update contract to reflect retirement of catalog sync endpoints and seller refresh controls.

---

## Verification Plan

1. **Focused Backend Tests**:
   - `npm run test:backend -- tests/test_pathao_catalog_routes.py tests/test_pathao_catalog_session.py tests/test_pathao_connections.py tests/test_pathao_locations.py`
2. **Focused Frontend Tests**:
   - `npm run test:frontend -- src/features/seller/PathaoSettings.test.tsx src/features/seller/PathaoSettingsLocale.test.tsx`
3. **Repository Conventions & Typechecks**:
   - `npm run conventions`
   - `npm run typecheck`
   - `npm run lint`
4. **Full Pre-Handoff Gate**:
   - `npm run check`
5. **Separately Reported Status**:
   - Browser check: pass / unrun
   - Hosted scheduling removal: unrun / operator action required
