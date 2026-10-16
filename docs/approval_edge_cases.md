# Approval workflow — edge cases (AF-5)

Confirmed behavior for v1 of the approval system. Implementation lives in
`approvalRbac.js`, `approvalService.js`, migration `009` + `010`, and the
Approvals UI.

---

## Status model

| Status | Meaning | Terminal? |
|--------|---------|-----------|
| `pending` | Submitted, awaiting moderator pickup | No |
| `in_review` | Actively being reviewed | No |
| `approved` | Decision made; may need follow-up (e.g. activate user) | No |
| `completed` | Work finished | **Yes** |
| `rejected` | Denied | **Yes** |
| `cancelled` | Withdrawn by requester or admin | **Yes** |

**Happy path:** `pending → in_review → approved → completed`

**Side exits:** `pending|in_review → rejected|cancelled`

---

## Re-open

**Decision:** Terminal requests (`completed`, `rejected`, `cancelled`) **cannot** be
moved back to `pending`. There is no “re-open” transition.

**Why:** Keeps the audit trail append-only and avoids ambiguous history. If work
must continue after rejection/cancellation, **create a new request**.

**user_onboarding:** The partial unique index allows a new open ticket for the
same subject once the previous one is terminal.

---

## Rejection

**Decision:**

- Reject is allowed from `pending` or `in_review` (moderators / authorized approvers).
- Optional `note` on `PATCH …/status` is stored on the row (`decision_note`) and
  in `approval_actions`.
- After `rejected`, no further status changes (409 from API).

**Requester cancel:** From `pending` or `in_review`, the original requester may
`cancelled` their own ticket. Admins may cancel any non-terminal ticket.

---

## Duplicate approvals

| Scenario | Behavior |
|----------|----------|
| Two open `user_onboarding` tickets for same subject | **Blocked** — DB unique index `uq_approval_open_user_onboarding`; API returns **409** |
| Multiple open `generic` tickets | **Allowed** — no dedupe (operational requests are independent) |
| Double-click approve (race) | **Serialized** — row locked with `SELECT … FOR UPDATE` inside the transition transaction; second writer sees current state |
| Approve already-terminal request | **409** — “closed and cannot be changed” |

---

## Reassignment (`assigned_to_id`)

**Decision (v1):**

- Moderators (`super_admin`, `admin`) may assign or clear a reviewer via
  `PATCH /api/approvals/:id/assign` with `{ "assigned_to_id": <user id> \| null }`.
- Assignment is **advisory** — it does not restrict who may approve/reject.
  Future realtime queues may filter by assignee.
- Cannot assign on **terminal** requests (409).
- Assignee must be an **active** CRM user if not null.
- Each assign/unassign is logged in `approval_actions` with `metadata.type =
  "assign"` (status unchanged).

---

## Role-change impacts

**Decision:** For `user_onboarding`, the subject’s CRM role is **snapshotted at
ticket creation** (`subject_user_role_snapshot`). RBAC for approve/reject uses
the snapshot, not the live `users.role`.

**Rationale:** Approval rules are tied to “what role was requested when the
ticket opened.” If an admin changes the subject’s role mid-flight, moderators
should reject the stale ticket and open a new one rather than silently shifting
approval authority.

The API still exposes the **live** role as `subject_user_current_role` on detail
when it differs from the snapshot (UI can warn).

---

## Auto onboarding on user create

**Decision:** When `userService.createUser` succeeds for
`admin`, `employee`, `agent`, `affiliate`, or `super_admin`, a `user_onboarding`
approval is inserted in the **same transaction** (`insertUserOnboardingApprovalInTransaction`).

| New user role | Who typically creates | Who can approve (in_review → approved) |
|---------------|----------------------|----------------------------------------|
| `admin` | super_admin | super_admin only |
| `employee` | super_admin, admin | super_admin, admin |
| `agent`, `affiliate` | super_admin, admin, employee | super_admin, admin |
| `super_admin` | super_admin | super_admin only |

The seed script bypasses this path. Existing users created before this wiring
will not have tickets until a new user is created.

**Account activation:** Users created through this path start with
`is_active = false` and **cannot sign in** until the onboarding request is
**approved** (or **completed**). **Rejected** or **cancelled** onboarding keeps
(or sets) the subject user **inactive**.

---

## Realtime / polling (v1)

**Decision:** No WebSocket/SSE/Postgres `NOTIFY` in v1. Clients poll via React
Query (`staleTime: 15s`) and invalidate after mutations.

**Implication:** Two moderators may both open the same ticket; the first
transition wins; the second gets **403** (illegal transition) or **409**
(terminal) depending on timing. Acceptable for v1; realtime transport is a
later phase.

---

## Visibility

| Actor | List | Detail | Transition |
|-------|------|--------|------------|
| Moderator | All (or `mine=1`) | All | Per RBAC matrix |
| Non-moderator | Own submissions only | Own only | Cancel own; no staff actions |

---

## Related files

- RBAC matrix: `backend/node-crm/src/config/approvalRbac.js`
- Service rules: `backend/node-crm/src/services/approvalService.js`, `userService.js`
- Schema: `backend/database/migrations/009_approval_workflow.sql`, `010_approval_subject_role_snapshot.sql`
- UI: `frontend/src/features/approvals/pages/ApprovalsPage.tsx`
