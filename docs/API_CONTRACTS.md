# API Contracts & Data Flow Guide

> [!NOTE]
> This document is part of **Tier 2 (On-Demand Context)**. Agents should consult this file when adding new FastAPI endpoints or updating frontend client calls.

---

## 1. REST Endpoint Conventions

* **Base URL:** `/api`
* **Response Status Codes:**
  * `200 OK`: Successful retrieval or synchronous operation.
  * `200 OK`: Current demo item creation also returns 200.
  * `422 Unprocessable Entity`: FastAPI request validation failure or malformed payload.
  * `404 Not Found`: Target entity does not exist.
  * `500 Internal Server Error`: Unhandled exception (logs must contain trace).

---

## 2. Pydantic v2 Models & Serialization

All request bodies and responses are defined in `backend/app/models/schemas.py`:

* Explicit type annotations for all fields (no raw `dict` or untyped lists).
* Example contract:
  ```python
  from pydantic import BaseModel

  class ItemCreate(BaseModel):
      title: str
      description: str | None = None
      tags: list[str] = []

  class ItemResponse(BaseModel):
      id: str
      title: str
      description: str | None = None
      tags: list[str] = []
      created_at: str
  ```

---

## 3. Frontend-Backend Synchronization

* Frontend types matching backend schemas are kept in `frontend/src/services/api.ts` or co-located inside `frontend/src/features/<feature>/<feature>.types.ts`.
* Avoid `any` at all costs. Verify frontend type-safety with:
  ```bash
  npm run typecheck:frontend
  ```

## 4. Current demo boundaries

Item routes use an in-memory list even when a database URL is configured. Records
are lost when the process restarts. Configuration flags report configuration,
not successful provider calls, database persistence, or authorization enforcement.
Frontend fallback items are also local simulations, not confirmed server writes.
Tests of these demo behaviors must not be reported as live-service acceptance.
