import { query } from "../../config/db.js";

const run = (client, text, params) =>
  client ? client.query(text, params) : query(text, params);

const baseSelect = `
  r.id, r.kind, r.status, r.title, r.body, r.requester_id, r.subject_user_id,
  r.assigned_to_id, r.decided_by_id, r.decision_note, r.created_at, r.updated_at, r.completed_at,
  r.subject_user_role_snapshot,
  COALESCE(r.subject_user_role_snapshot::text, sr.role::text) AS subject_user_role,
  sr.role::text AS subject_user_current_role,
  rq.name AS requester_name,
  rq.email AS requester_email
`;

const ApprovalRequest = {
  insert: async (
    client,
    { kind, title, body, requesterId, subjectUserId, assignedToId, subjectUserRoleSnapshot }
  ) => {
    const { rows } = await run(
      client,
      `INSERT INTO approval_requests (
         kind, status, title, body, requester_id, subject_user_id, assigned_to_id,
         subject_user_role_snapshot
       )
       VALUES ($1, 'pending', $2, $3::jsonb, $4, $5, $6, $7)
       RETURNING id, kind, status, title, body, requester_id, subject_user_id,
         assigned_to_id, decided_by_id, decision_note, created_at, updated_at, completed_at,
         subject_user_role_snapshot`,
      [
        kind,
        title,
        body ?? null,
        requesterId,
        subjectUserId ?? null,
        assignedToId ?? null,
        subjectUserRoleSnapshot ?? null,
      ]
    );
    return rows[0];
  },

  insertAction: async (
    client,
    { requestId, actorId, fromStatus, toStatus, note, metadata, ipAddress, actorRole }
  ) => {
    const { rows } = await run(
      client,
      `INSERT INTO approval_actions
         (request_id, actor_id, from_status, to_status, note, metadata, ip_address, actor_role)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       RETURNING id, request_id, actor_id, from_status, to_status, note, metadata,
         ip_address, actor_role, created_at`,
      [
        requestId,
        actorId,
        fromStatus ?? null,
        toStatus,
        note ?? null,
        metadata ? JSON.stringify(metadata) : null,
        ipAddress ?? null,
        actorRole ?? null,
      ]
    );
    return rows[0];
  },

  findById: async (id, { client, forUpdate = false } = {}) => {
    const lock = forUpdate ? " FOR UPDATE OF r" : "";
    const { rows } = await run(
      client,
      `SELECT ${baseSelect}
         FROM approval_requests r
         LEFT JOIN users sr ON sr.id = r.subject_user_id
         LEFT JOIN users rq ON rq.id = r.requester_id
        WHERE r.id = $1
        LIMIT 1${lock}`,
      [id]
    );
    return rows[0] || null;
  },

  list: async ({
    client,
    requesterIdOnly,
    status,
    kind,
    limit,
    offset,
  }) => {
    const params = [];
    let where = "WHERE 1=1";
    if (requesterIdOnly != null) {
      params.push(requesterIdOnly);
      where += ` AND r.requester_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      where += ` AND r.status = $${params.length}`;
    }
    if (kind) {
      params.push(kind);
      where += ` AND r.kind = $${params.length}`;
    }
    params.push(limit, offset);
    const lim = params.length - 1;
    const off = params.length;
    const { rows } = await run(
      client,
      `SELECT ${baseSelect}
         FROM approval_requests r
         LEFT JOIN users sr ON sr.id = r.subject_user_id
         LEFT JOIN users rq ON rq.id = r.requester_id
        ${where}
        ORDER BY r.created_at DESC
        LIMIT $${lim} OFFSET $${off}`,
      params
    );
    return rows;
  },

  count: async ({ client, requesterIdOnly, status, statuses, kind }) => {
    const params = [];
    let where = "WHERE 1=1";
    if (requesterIdOnly != null) {
      params.push(requesterIdOnly);
      where += ` AND requester_id = $${params.length}`;
    }
    if (Array.isArray(statuses) && statuses.length > 0) {
      params.push(statuses);
      where += ` AND status = ANY($${params.length}::approval_request_status[])`;
    } else if (status) {
      params.push(status);
      where += ` AND status = $${params.length}`;
    }
    if (kind) {
      params.push(kind);
      where += ` AND kind = $${params.length}`;
    }
    const { rows } = await run(
      client,
      `SELECT COUNT(*)::int AS total FROM approval_requests ${where}`,
      params
    );
    return rows[0].total;
  },

  updateStatus: async (
    client,
    id,
    {
      status,
      decidedById,
      decisionNote,
      completedAt,
    }
  ) => {
    const { rows } = await run(
      client,
      `UPDATE approval_requests
          SET status = $2,
              decided_by_id = COALESCE($3, decided_by_id),
              decision_note = COALESCE($4, decision_note),
              completed_at = COALESCE($5, completed_at),
              updated_at = NOW()
        WHERE id = $1
        RETURNING id, kind, status, title, body, requester_id, subject_user_id,
          assigned_to_id, decided_by_id, decision_note, created_at, updated_at, completed_at,
          subject_user_role_snapshot`,
      [id, status, decidedById ?? null, decisionNote ?? null, completedAt ?? null]
    );
    return rows[0] || null;
  },

  updateAssignee: async (client, id, assignedToId) => {
    const { rows } = await run(
      client,
      `UPDATE approval_requests
          SET assigned_to_id = $2,
              updated_at = NOW()
        WHERE id = $1
        RETURNING id, kind, status, title, body, requester_id, subject_user_id,
          assigned_to_id, decided_by_id, decision_note, created_at, updated_at, completed_at,
          subject_user_role_snapshot`,
      [id, assignedToId]
    );
    return rows[0] || null;
  },

  /** The open (non-terminal) user_onboarding request for a subject, if any. */
  findOpenOnboardingByUser: async (userId, { client, forUpdate = false } = {}) => {
    const lock = forUpdate ? " FOR UPDATE OF r" : "";
    const { rows } = await run(
      client,
      `SELECT ${baseSelect}
         FROM approval_requests r
         LEFT JOIN users sr ON sr.id = r.subject_user_id
         LEFT JOIN users rq ON rq.id = r.requester_id
        WHERE r.subject_user_id = $1
          AND r.kind = 'user_onboarding'
          AND r.status NOT IN ('completed','rejected','cancelled')
        ORDER BY r.created_at DESC
        LIMIT 1${lock}`,
      [userId]
    );
    return rows[0] || null;
  },

  findActionsByRequestId: async (requestId, { client } = {}) => {
    const { rows } = await run(
      client,
      `SELECT a.id, a.request_id, a.actor_id, a.from_status, a.to_status, a.note, a.metadata, a.created_at,
              u.name AS actor_name, u.email AS actor_email, u.role AS actor_role
         FROM approval_actions a
         JOIN users u ON u.id = a.actor_id
        WHERE a.request_id = $1
        ORDER BY a.created_at ASC, a.id ASC`,
      [requestId]
    );
    return rows;
  },
};

export default ApprovalRequest;
