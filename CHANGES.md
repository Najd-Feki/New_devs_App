# Property Revenue Dashboard - Changes Log

This file tracks each assignment issue, its root cause, and the exact fix applied.

## Issue 1 - Revenue totals do not match expected records

### Symptom
- Dashboard showed stable fallback-looking values instead of expected tenant/property totals.

### Root Cause
- The async DB engine initialization was using a sync-only pool class:
  - `QueuePool` with `create_async_engine(...)`
- This caused DB pool init errors and triggered fallback mock totals in `reservations.py`.
- Revenue query also needed explicit March window logic for assignment validation.

### Fix
- Updated DB pool initialization to use async-compatible defaults:
  - File: `backend/app/core/database_pool.py`
  - Removed `poolclass=QueuePool`
  - Kept configured `DATABASE_URL` normalized to `postgresql+asyncpg://`
- Updated revenue query path:
  - File: `backend/app/services/reservations.py`
  - Use shared `db_pool` instance instead of creating a new pool per request
  - Correct async session usage with awaited session creation
  - Query March 2024 totals using property-local timezone boundaries:
    - `check_in_date AT TIME ZONE COALESCE(p.timezone, 'UTC')`
    - Range: `[2024-03-01, 2024-04-01)`

### Verification
- Backend no longer logs async-pool initialization crash for dashboard revenue requests.
- Revenue requests are no longer forced to mock fallback due to pool init failure.

---

## Issue 2 - Cross-account data leakage (tenant isolation breach)

### Symptom
- Different client accounts can see the same revenue numbers after refresh/property switches.

### Root Cause
- Revenue cache key is scoped only by property:
  - File: `backend/app/services/cache.py`
  - Current key: `revenue:{property_id}`
- Because property IDs can overlap across tenants, cache responses can leak between tenants.

### Fix
- Change cache key to include tenant context:
  - `revenue:{tenant_id}:{property_id}`

### Status
- **Applied**

---

## Issue 3 - Minor cents-level precision discrepancies

### Symptom
- Finance reports show totals occasionally off by small cent values.

### Root Cause
- Financial values are stored as `NUMERIC`/`Decimal` but converted to `float` for API/UI display.
- Binary floating-point representation can introduce tiny rounding artifacts.

### Fix
- Keep arithmetic in `Decimal` until final formatting stage.
- Quantize to currency precision before serializing display totals.
- Backend update:
  - File: `backend/app/api/v1/dashboard.py`
  - Revenue is now quantized with `Decimal("0.01")` + `ROUND_HALF_UP` before returning `total_revenue`.
- Frontend update:
  - File: `frontend/src/components/RevenueSummary.tsx`
  - Removed extra `Math.round(...)` step and precision warning check; now only formats backend value for display.

### Status
- **Applied**

---

## Issue 4 - Property selector exposes other-tenant properties

### Symptom
- Both client accounts can see all properties in the dashboard dropdown.
- Selecting another tenant's property shows zero/no data, which is confusing and weakens tenant isolation UX.

### Root Cause
- Dashboard property selector used a hardcoded global property array:
  - File: `frontend/src/components/Dashboard.tsx`
- UI was not using tenant-scoped property data from backend.
- In this stack, `GET /api/v1/properties` was missing (`404`), so API-driven selector became empty.

### Fix
- Replaced hardcoded selector options with `SecureAPI.getProperties(...)` results.
- Selector now renders only properties available to the authenticated tenant.
- Added real tenant-scoped backend endpoint:
  - File: `backend/app/api/v1/properties.py`
  - Route: `GET /api/v1/properties`
  - Source: `properties` table filtered by `tenant_id` from authenticated user.
- Registered properties router in `backend/app/main.py`.
- Removed temporary frontend fallback list; selector now uses real API data only.

---

## Notes
- Assignment work is being handled issue-by-issue to keep diffs clear and reversible.
- This log is intended to support both code review and Loom walkthrough narration.
- loom video URL: https://www.loom.com/share/533ec59575154a34956628c658dbb8bf
