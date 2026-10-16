# Document Verification & Account Activation (KYC)

A KYC-style verification system layered on top of the existing approval workflow.
Employees, agents, and affiliates upload role-specific documents; super-admins and
admins review them and activate accounts; unverified accounts are soft-expired
after 7 days.

> Implements [`CRM-User-Verification.md`](../CRM-User-Verification.md).

---

## Lifecycle

1. A super-admin/admin creates a user. **All new users can log in immediately.**
   - Admins/super-admins → `account_status = active` (no documents needed).
   - Employees/agents/affiliates → `account_status = pending`, with a 7-day
     `verification_deadline`.
2. On login, unverified users are confined to the **Verification Dashboard**
   (`/dashboard/verification`) by `VerificationGate` — every other route
   redirects there until the account is activated.
3. The user uploads each required document. Each upload opens a
   `document_verification` approval request; its status **is** the document's
   review status.
4. A moderator reviews each document (Approve / Reject-with-comment). Status
   values: `pending` → `in_review` → `approved` | `rejected`.
5. When **every required document is approved**, the Activate button unlocks.
   Activation flips the account to `active` and closes the onboarding request.
6. If verification isn't completed within 7 days, the daily worker moves the
   account to `expired` (login blocked) and **soft-deletes** documents — nothing
   is hard-deleted, so the audit trail is preserved.

## Required documents per role

The single source of truth is `backend/.../config/verificationDocs.js`
(mirrored in `frontend/src/config/verificationDocs.ts`).

| Role | Required | Optional |
|------|----------|----------|
| Employee | Passport, Driving License, Proof of Address, Experience Letter, Police Verification | — |
| Agent | Passport, Driving License, Proof of Address, Business Registration, Trade License, Incorporation Certificate, Tax Certificate, Business Address Proof, Business Bank Account Details, Business Bank Statements | — |
| Affiliate | Passport, Driving License, Proof of Address, Bank Account Details | Business Account Details |

## Storage

Documents are **never** stored in Postgres — only metadata is (file name,
original name, storage path, URL, MIME type, size, upload date). Bytes go to a
storage adapter:

- **S3** (production) — set `S3_BUCKET` (+ `AWS_REGION`, credentials, optional
  `S3_PREFIX`). Objects are private; downloads use short-lived signed URLs.
- **Local disk** (dev fallback) — used automatically when `S3_BUCKET` is empty.
  Files are served through the authenticated `/documents/:id/file` route.

Constraints: **PDF/JPG/JPEG/PNG**, **max 10 MB** per file (enforced by multer).

## Notifications

In-app + email (best-effort) on: `document_uploaded`, `document_approved`,
`document_rejected`, `reupload_required`, `account_activated`,
`account_expiring_24h`, `account_expired`. Email uses SMTP when `SMTP_HOST` is
set, otherwise logs the message (dev fallback). See `notifications` table and the
header bell in the SPA.

## Audit log

Every action is appended to `approval_actions` with `actor_id`, `actor_role`,
`ip_address`, `from_status`, `to_status`, `note`, and `metadata` — satisfying the
spec's audit requirements (user, action, timestamp, IP, role, metadata).

## Expiry worker

`src/jobs/expiryWorker.js` runs in-process daily (default `0 2 * * *`,
configurable via `EXPIRY_CRON_SCHEDULE`). It:

1. Warns accounts expiring within 24h.
2. Expires past-deadline accounts: `account_status = expired`,
   `is_active = false`, documents archived (`archived_at` set), onboarding
   request cancelled. With `EXPIRY_PURGE_FILES=true`, file bytes are removed from
   storage while metadata is retained.

Run it externally instead by setting `EXPIRY_CRON_DISABLED=true` and using
`docker compose run --rm expire`.

---

## API — `/api/verification`

All routes require authentication.

### Acting user

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/meta` | Statuses + required documents for the caller's role |
| `POST` | `/documents` | Upload (multipart: `doc_type`, `file`) |
| `GET`  | `/documents/me` | The caller's live documents |
| `GET`  | `/me/progress` | Progress (uploaded X/Y, status, per-doc table) |
| `GET`  | `/documents/:id/file` | Download/preview (owner or moderator) |

### Moderator (super_admin / admin)

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/review?role=&status=&search=&limit=&offset=` | Verification queue |
| `GET`  | `/review/:userId` | Progress + documents + activity timeline |
| `PATCH`| `/documents/:id/status` | `{ to_status, note? }` — review a document (note required to reject) |
| `POST` | `/users/:userId/activate` | Activate (409 unless all required docs approved) |
| `POST` | `/users/:userId/suspend` | `{ note? }` — suspend account |
| `POST` | `/users/:userId/reject` | `{ note }` — reject verification |

## API — `/api/notifications`

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/?limit=` | Recent notifications |
| `GET`  | `/unread-count` | `{ count }` for the header badge |
| `PATCH`| `/:id/read` | Mark one read |
| `PATCH`| `/read-all` | Mark all read |

## Migration

Migration `011_document_verification.sql` adds the `document_verification`
approval kind, the `verification_documents` and `notifications` tables, the
`account_status` / `verification_deadline` / `archived_at` columns on `users`,
and `ip_address` / `actor_role` on `approval_actions`. Apply to an existing DB:

```bash
docker compose run --rm migrate
```
