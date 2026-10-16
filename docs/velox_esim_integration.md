# Velox eSIM platform integration (CRM ↔ external service)

## Service boundaries

| Service | Default URL | Purpose |
|---------|-------------|---------|
| **Velox eSIM API** | `http://localhost:5000` | eSIM customers, orders, purchases (source of truth) |
| **Velox-CRM API** | `http://localhost:5001` | CRM users, approvals, proxy to Velox for staff |

The CRM **never** exposes `VELOX_API_KEY` to the browser. The React app calls
`/api/velox-esim/*` on the CRM backend; the backend calls Velox with `x-api-key`.

## Access control (v1)

Only **`super_admin`** and **`admin`** may:

- Call `GET /api/velox-esim/customers` and `GET /api/velox-esim/customers/:id`
- See **eSIM Customers** in the sidebar and UI

Enforced in `veloxEsimRoutes.js` (backend) and `RoleGuard` + `sidebarConfig` (frontend).

## Integration pattern (v1)

**Read-only proxy** — live data from Velox; no sync into local `customers` table yet.
Optional import/sync is tracked as VELOX-6.

## Environment (CRM backend)

```bash
# Velox eSIM platform (separate process)
VELOX_API_URL=http://localhost:5000
VELOX_API_KEY=<shared secret — must match Velox CRM_API_KEY>

# Docker Desktop (CRM container → host Velox):
# VELOX_API_URL=http://host.docker.internal:5000
```

## VELOX-0 — Connection checklist

1. Start Velox eSIM backend on port **5000**.
2. Set `CRM_API_KEY` on Velox and `VELOX_API_KEY` on CRM to the **same** value.
3. From your machine:

```bash
curl -s "http://localhost:5000/api/crm/customers?limit=1" \
  -H "x-api-key: YOUR_KEY" | head -c 500
```

4. Log in to CRM as **super_admin** or **admin**, open **eSIM Customers**, or:

```bash
# After CRM login cookie is set:
curl -s "http://localhost:5001/api/velox-esim/health" -b "velox_token=..."
```

Expected CRM health payload: `{ "configured": true, "reachable": true, ... }`.

## Code layout

```
backend/node-crm/src/integrations/veloxEsim/
  config.js    — env + view roles
  errors.js    — normalize Velox failures
  mappers.js   — Velox JSON → CRM DTOs
  client.js    — HTTP to Velox (fetch)

backend/node-crm/src/services/veloxEsimService.js
backend/node-crm/src/controllers/veloxEsimController.js
backend/node-crm/src/routes/veloxEsimRoutes.js

frontend/src/features/velox-esim/
```

## External API reference

See [`VELOX_CRM_API.md`](../VELOX_CRM_API.md) for field definitions (`planType`,
`countryCode`, `region`, `phone`, etc.).
