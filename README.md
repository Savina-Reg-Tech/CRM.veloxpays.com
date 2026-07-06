# Velox CRM (`CRM.veloxpays.com`)

Full-stack customer relationship management platform for Velox Pays. The stack is a **React + Vite** SPA, a **Node.js + Express** API, and **PostgreSQL**. Optional integrations connect to the Velox eSIM platform and VeloxVerse admin APIs.

This document is written for **DevOps and platform engineers** deploying the application to staging or production.

---

## Table of contents

1. [Architecture](#architecture)
2. [Repository layout](#repository-layout)
3. [Prerequisites](#prerequisites)
4. [Environment variables](#environment-variables)
5. [Database setup](#database-setup)
6. [Local development](#local-development)
7. [Docker deployment](#docker-deployment)
8. [Production checklist](#production-checklist)
9. [Health checks & monitoring](#health-checks--monitoring)
10. [Background jobs](#background-jobs)
11. [External integrations](#external-integrations)
12. [Troubleshooting](#troubleshooting)

---

## Architecture

```
┌─────────────────┐     HTTPS      ┌──────────────────┐
│  Browser / SPA  │ ──────────────▶│  nginx (frontend)│  port 80
│  React + Vite   │                │  static assets   │
└────────┬────────┘                └──────────────────┘
         │  API calls (cookie auth)
         │  VITE_API_URL → /api/*
         ▼
┌─────────────────┐                ┌──────────────────┐
│  Express API    │ ──────────────▶│  PostgreSQL      │
│  (backend)      │                │  crm_db          │
└────────┬────────┘                └──────────────────┘
         │
         ├──▶ AWS S3 (verification documents) — or local disk in dev
         ├──▶ SMTP / Gmail (notifications & form emails)
         ├──▶ Velox eSIM API (VELOX_API_URL)
         └──▶ VeloxVerse API (VELOXVERSE_API_URL) — admin proxy
```

| Component | Technology | Default port (dev) |
|-----------|------------|-------------------|
| Frontend | React 18, Vite 5, Tailwind CSS 4, nginx (prod) | `3001` (dev), `80` (Docker) |
| Backend | Node.js 20, Express 4, JWT (httpOnly cookie) | `5001` (`.env.example`), `5002` (Dockerfile default) |
| Database | PostgreSQL 14+ recommended | `5432` |

**Important:** Set `PORT` explicitly in every environment. The backend falls back to `5002` when `PORT` is unset (`server.js`), while `.env.example` uses `5001`. Keep `VITE_API_URL` aligned with the backend URL you actually expose.

---

## Repository layout

```
CRM.veloxpays.com/
├── frontend/                 # React SPA (Vite)
│   ├── Dockerfile            # Multi-stage: Node build → nginx serve
│   ├── nginx.conf            # SPA routing + asset caching
│   └── .env.example
├── backend/
│   ├── Dockerfile            # Build context: ./backend
│   ├── database/
│   │   ├── migrations/       # SQL migrations 001–014 (run in order)
│   │   ├── schemas/          # Reference schema snapshots
│   │   └── seeds/
│   │       └── superAdminSeed.js
│   └── node-crm/             # Express application root
│       ├── server.js         # Entry point
│       ├── config/db.js      # PostgreSQL pool
│       ├── src/
│       │   ├── app.js        # Routes & middleware
│       │   └── jobs/         # Expiry cron + CLI script
│       ├── scripts/          # Optional data seeds (e.g. loan forms)
│       └── .env.example
└── README.md
```

---

## Prerequisites

| Requirement | Version / notes |
|-------------|-----------------|
| **Node.js** | 20.x (matches Docker images) |
| **npm** | 9+ |
| **PostgreSQL** | 14+ (uses `TIMESTAMPTZ`, enums, JSON) |
| **Docker** (optional) | 24+ with BuildKit |
| **AWS** (production) | S3 bucket + IAM credentials for document storage |
| **SMTP or Gmail** | For outbound email (see [Environment variables](#environment-variables)) |

---

## Environment variables

### Backend (`backend/node-crm/.env`)

Copy from the example file:

```bash
cp backend/node-crm/.env.example backend/node-crm/.env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | HTTP port the API listens on (e.g. `5002`) |
| `NODE_ENV` | Yes (prod) | `production` in deployed environments |
| `DB_HOST` | Yes | PostgreSQL hostname |
| `DB_PORT` | Yes | PostgreSQL port (default `5432`) |
| `DB_NAME` | Yes | Database name (default `crm_db`) |
| `DB_USER` | Yes | Database user |
| `DB_PASSWORD` | Yes | Database password |
| `JWT_SECRET` | Yes | Strong random secret for signing session tokens |
| `JWT_EXPIRES_IN` | No | Token lifetime (default `7d`) |
| `ALLOWED_ORIGINS` | Yes (prod) | Comma-separated frontend origins for CORS, e.g. `https://crm.veloxpays.com` |
| `COOKIE_SECURE` | Yes (HTTPS) | Set `true` when the site is served over HTTPS so auth cookies include the `Secure` flag |
| `VELOX_API_URL` | If using eSIM | Base URL of the Velox eSIM service (no trailing slash) |
| `VELOX_API_KEY` | If using eSIM | Shared API key (must match Velox eSIM `CRM_API_KEY`) |
| `S3_BUCKET` | Prod recommended | S3 bucket for verification documents; leave empty for local disk |
| `AWS_REGION` | If S3 | AWS region (default `us-east-1`) |
| `S3_PREFIX` | No | Key prefix inside the bucket (default `verification/`) |
| `S3_SIGNED_URL_TTL` | No | Presigned URL lifetime in seconds (default `300`) |
| `STORAGE_LOCAL_DIR` | Dev only | Local upload directory when `S3_BUCKET` is empty (default `uploads`) |
| `SMTP_HOST` | Recommended | SMTP server; if empty, notification emails are logged, not sent |
| `SMTP_PORT` | No | Default `587` |
| `SMTP_SECURE` | No | `true` for TLS on port 465 |
| `SMTP_USER` / `SMTP_PASS` | If SMTP auth | SMTP credentials |
| `MAIL_FROM` | No | From address for SMTP notifications |
| `MAIL_USER` / `MAIL_APP_PASSWORD` | If using forms | Gmail credentials for **form submission** emails (separate from SMTP notifications) |
| `PUBLIC_API_BASE` | Prod (embed forms) | Public URL of the API used by `/form.js` embed script, e.g. `https://api.crm.veloxpays.com` |
| `EXPIRY_CRON_DISABLED` | No | `true` to disable in-process expiry scheduler |
| `EXPIRY_CRON_SCHEDULE` | No | Cron expression (default `0 2 * * *` — daily at 02:00 server time) |
| `EXPIRY_PURGE_FILES` | No | `true` to delete file bytes from storage when accounts expire |
| `VELOXVERSE_API_URL` | If using VV admin | VeloxVerse backend base URL, e.g. `https://api.veloxverse.com/api/v1` |
| `VELOXVERSE_BRIDGE_EMAIL_MAP` | If using VV admin | CRM→VeloxVerse email mapping, e.g. `admin@crm.com:admin@veloxverse.com` |
| `VELOXVERSE_BRIDGE_USER_EMAIL` | No | Single override email for all proxied VeloxVerse requests |

AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, or instance/task role) are read via the standard AWS SDK credential chain when S3 is enabled.

### Frontend (`frontend/.env`)

```bash
cp frontend/.env.example frontend/.env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Backend API base URL **including** `/api`, e.g. `https://api.crm.veloxpays.com/api` |

`VITE_API_URL` is **baked into the JavaScript bundle at build time**. Rebuild the frontend image whenever the API URL changes.

---

## Database setup

### 1. Create the database

```bash
psql -U postgres -c "CREATE DATABASE crm_db;"
```

### 2. Run migrations (in order)

Migrations are plain SQL files — there is no automated migration runner. Apply them sequentially:

```bash
export PGHOST=localhost PGPORT=5432 PGUSER=postgres PGDATABASE=crm_db

for f in backend/database/migrations/*.sql; do
  echo "Applying $(basename "$f")..."
  psql -v ON_ERROR_STOP=1 -f "$f"
done
```

Migration files (`001` → `014`) cover: users/RBAC, customers, services, approval workflow, document verification, and form builder.

### 3. Seed the super admin

From the backend app directory (loads `.env` from `node-crm/`):

```bash
cd backend/node-crm
node ../database/seeds/superAdminSeed.js
```

Default credentials (change immediately after first login):

| Field | Value |
|-------|-------|
| Email | `admin@crm.com` |
| Password | `VeloxAdmin@2026!` |
| Role | `super_admin` |

The seed is idempotent — re-running it resets the super admin password.

### 4. Optional: seed loan application forms

```bash
cd backend/node-crm
node scripts/seed-loan-forms.js
```

---

## Local development

### Backend

```bash
cd backend/node-crm
npm ci
cp .env.example .env   # edit DB and secrets
npm run dev            # nodemon on PORT from .env
```

Verify: `curl http://localhost:5001/health`

### Frontend

```bash
cd frontend
npm ci
cp .env.example .env   # set VITE_API_URL to match backend
npm run dev            # Vite dev server on http://localhost:3001
```

### Tests

```bash
cd backend/node-crm && npm test
cd frontend && npm test
```

---

## Docker deployment

Both services ship with Dockerfiles. **Build contexts matter:**

| Service | Build context | Dockerfile |
|---------|---------------|------------|
| Backend | `./backend` | `backend/Dockerfile` |
| Frontend | `./frontend` | `frontend/Dockerfile` |

### Build images

```bash
# Backend
docker build -t velox-crm-backend ./backend

# Frontend — pass the production API URL at build time
docker build \
  --build-arg VITE_API_URL=https://api.crm.veloxpays.com/api \
  -t velox-crm-frontend \
  ./frontend
```

### Run containers

```bash
# Backend (mount uploads volume if using local storage instead of S3)
docker run -d \
  --name crm-api \
  -p 5002:5002 \
  --env-file backend/node-crm/.env \
  -e NODE_ENV=production \
  -e PORT=5002 \
  -v crm-uploads:/app/uploads \
  velox-crm-backend

# Frontend
docker run -d \
  --name crm-web \
  -p 80:80 \
  velox-crm-frontend
```

### Recommended `docker-compose.yml`

The Dockerfiles reference compose-style one-shot jobs (`seed`, `expire`). A minimal compose stack:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: crm_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d crm_db"]
      interval: 5s
      retries: 5

  backend:
    build: ./backend
    ports:
      - "5002:5002"
    env_file: ./backend/node-crm/.env
    environment:
      DB_HOST: db
      PORT: 5002
      NODE_ENV: production
    volumes:
      - uploads:/app/uploads
    depends_on:
      db:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      args:
        VITE_API_URL: ${VITE_API_URL:-http://localhost:5002/api}
    ports:
      - "3000:80"
    depends_on:
      - backend

  # One-shot: seed super admin (run after migrations)
  seed:
    build: ./backend
    env_file: ./backend/node-crm/.env
    environment:
      DB_HOST: db
    command: ["node", "database/seeds/superAdminSeed.js"]
    depends_on:
      db:
        condition: service_healthy
    profiles: ["tools"]

  # One-shot: verification expiry sweep (alternative to in-process cron)
  expire:
    build: ./backend
    env_file: ./backend/node-crm/.env
    environment:
      DB_HOST: db
    command: ["node", "src/jobs/runExpiry.js"]
    depends_on:
      db:
        condition: service_healthy
    profiles: ["tools"]

volumes:
  pgdata:
  uploads:
```

**First-time compose bootstrap:**

```bash
# 1. Start Postgres
docker compose up -d db

# 2. Run migrations (from host, against the exposed DB port)
export PGHOST=localhost PGPORT=5432 PGUSER=postgres PGDATABASE=crm_db
for f in backend/database/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -f "$f"; done

# 3. Seed admin + start app
docker compose --profile tools run --rm seed
docker compose up -d backend frontend
```

**Scheduled expiry (if `EXPIRY_CRON_DISABLED=true`):**

```bash
# Example cron entry — daily at 02:00
0 2 * * * cd /path/to/CRM.veloxpays.com && docker compose --profile tools run --rm expire
```

### Reverse proxy (production)

Place nginx, Traefik, or an ALB in front of both services:

| Path | Target |
|------|--------|
| `https://crm.veloxpays.com/*` | Frontend container (port 80) |
| `https://api.crm.veloxpays.com/*` | Backend container (port 5002) |

Backend requirements behind a proxy:

- Set `app.set('trust proxy', true)` — already configured in `app.js`
- Set `COOKIE_SECURE=true`
- Set `ALLOWED_ORIGINS` to the exact frontend origin(s)
- Set `PUBLIC_API_BASE` to the public API URL for embedded forms

---

## Production checklist

- [ ] PostgreSQL provisioned; all 14 migrations applied
- [ ] Strong `JWT_SECRET` generated and stored in secrets manager
- [ ] `NODE_ENV=production`
- [ ] `ALLOWED_ORIGINS` set to production frontend URL(s) only
- [ ] `COOKIE_SECURE=true` on HTTPS deployments
- [ ] `VITE_API_URL` points to production API; frontend image rebuilt
- [ ] `S3_BUCKET` + IAM credentials configured (do not rely on local disk)
- [ ] SMTP configured for account/verification notifications
- [ ] Gmail (`MAIL_USER` / `MAIL_APP_PASSWORD`) configured if form builder emails are used
- [ ] `PUBLIC_API_BASE` set for public form embeds (`/public/*`, `/form.js`)
- [ ] Super admin password changed after first login
- [ ] Velox eSIM / VeloxVerse URLs and keys configured if those features are enabled
- [ ] Expiry job: in-process cron **or** external scheduler with `EXPIRY_CRON_DISABLED=true`
- [ ] Persistent volume for `uploads/` if S3 is not used
- [ ] Health check wired to `GET /health` on the backend

---

## Health checks & monitoring

| Endpoint | Method | Expected response |
|----------|--------|-------------------|
| `/health` | GET | `{"status":"ok","timestamp":"..."}` |
| `/` | GET | Same as above |
| Frontend `/` | GET | `index.html` (nginx) |

Backend logs on startup:

- PostgreSQL connection status
- Document storage mode (S3 vs local)
- Expiry scheduler status

The API exits with code 1 if PostgreSQL is unreachable at startup.

---

## Background jobs

### Verification expiry sweep

Accounts that miss the 7-day verification window are deactivated and their documents are soft-deleted. Two modes:

1. **In-process (default):** `node-cron` runs inside the API container on `EXPIRY_CRON_SCHEDULE` (default `0 2 * * *`).
2. **External:** Set `EXPIRY_CRON_DISABLED=true` and schedule:

   ```bash
   node backend/node-crm/src/jobs/runExpiry.js
   ```

Set `EXPIRY_PURGE_FILES=true` to also delete file bytes from S3/local storage on expiry (metadata is always retained).

---

## External integrations

### Velox eSIM

| Variable | Purpose |
|----------|---------|
| `VELOX_API_URL` | eSIM platform base URL |
| `VELOX_API_KEY` | Shared secret for CRM ↔ eSIM |

CRM routes: `/api/velox-esim/*` (super_admin and admin only).

### VeloxVerse Admin Bridge

Proxies CRM admin UI calls to VeloxVerse at `/api/vv-admin/*`.

| Variable | Purpose |
|----------|---------|
| `VELOXVERSE_API_URL` | VeloxVerse API base |
| `VELOXVERSE_BRIDGE_EMAIL_MAP` | Maps CRM admin emails to VeloxVerse user emails for audit columns |

The CRM JWT cookie is forwarded as a Bearer token; VeloxVerse must trust the shared `JWT_SECRET`.

### Public form embed

Unauthenticated endpoints for embedded lead-capture forms:

- `GET /public/forms/:id` — form schema
- `POST /public/forms/:id/submit` — submission
- `GET /form.js` — embed helper script

These allow `Access-Control-Allow-Origin: *`. Set `PUBLIC_API_BASE` so the embed script calls the correct public API host.

---

## API routes (reference)

| Prefix | Auth | Description |
|--------|------|-------------|
| `/api/auth` | Mixed | Login, logout, session (`/me`) |
| `/api/users` | JWT | User management |
| `/api/customers` | JWT | Customer CRUD |
| `/api/services` | JWT | Service catalog |
| `/api/approvals` | JWT | Approval workflow |
| `/api/verification` | JWT | Document verification |
| `/api/notifications` | JWT | In-app notifications |
| `/api/velox-esim` | JWT (admin) | Velox eSIM proxy |
| `/api/forms` | JWT | Form builder (admin) |
| `/api/vv-admin` | JWT (admin) | VeloxVerse admin proxy |
| `/public` | None | Public form endpoints |

Authentication uses an **httpOnly cookie** named `velox_token`. The frontend sends it automatically via `withCredentials: true`.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Login succeeds but session lost on refresh | `COOKIE_SECURE=true` over HTTP, or CORS origin mismatch | Match `ALLOWED_ORIGINS` to frontend URL; only enable `COOKIE_SECURE` on HTTPS |
| Frontend calls wrong API | Stale `VITE_API_URL` in built bundle | Rebuild frontend with correct `--build-arg VITE_API_URL=...` |
| `Failed to connect to PostgreSQL` on startup | DB not ready or wrong `DB_*` vars | Check connectivity; ensure migrations ran |
| Documents not persisting across deploys | Local storage without a volume | Use S3 in production, or mount `uploads/` volume |
| Form emails not sending | Gmail vars unset | Set `MAIL_USER` and `MAIL_APP_PASSWORD` |
| Notification emails not sending | SMTP unset | Configure `SMTP_HOST` and related vars |
| VeloxVerse admin pages 401/503 | Bridge not configured | Set `VELOXVERSE_API_URL` and email map; verify shared JWT secret |
| Embed forms call `localhost` | `PUBLIC_API_BASE` unset | Set to public API URL |
| CORS error in browser | Origin not in allowlist | Add exact origin (scheme + host + port) to `ALLOWED_ORIGINS` |

---

## License & support

Internal Velox Pays project. For deployment questions, contact the engineering team with this README, your environment variable redactions, and relevant container/proxy logs.
