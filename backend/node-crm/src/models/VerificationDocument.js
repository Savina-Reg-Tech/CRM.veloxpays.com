import { query } from "../../config/db.js";

const run = (client, text, params) =>
  client ? client.query(text, params) : query(text, params);

/**
 * verification_documents holds file METADATA only. Each row is paired with one
 * approval_request (kind = 'document_verification') whose status IS the
 * document's review status. Joins below expose that status + decision note.
 */
const docSelect = `
  d.id, d.user_id, d.doc_type, d.approval_request_id,
  d.file_name, d.original_file_name, d.storage_path, d.file_url,
  d.mime_type, d.file_size, d.uploaded_at, d.archived_at,
  d.custom_label,
  r.status        AS status,
  r.decision_note AS review_note,
  r.decided_by_id AS reviewed_by,
  r.updated_at    AS reviewed_at
`;

const VerificationDocument = {
  /** Insert a new document metadata row. */
  insert: async (
    client,
    {
      userId,
      docType,
      approvalRequestId,
      fileName,
      originalFileName,
      storagePath,
      fileUrl,
      mimeType,
      fileSize,
      customLabel,
    }
  ) => {
    const { rows } = await run(
      client,
      `INSERT INTO verification_documents
         (user_id, doc_type, approval_request_id, file_name, original_file_name,
          storage_path, file_url, mime_type, file_size, custom_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, user_id, doc_type, approval_request_id, file_name,
         original_file_name, storage_path, file_url, mime_type, file_size,
         custom_label, uploaded_at`,
      [
        userId,
        docType,
        approvalRequestId,
        fileName,
        originalFileName,
        storagePath,
        fileUrl,
        mimeType,
        fileSize,
        customLabel || null,
      ]
    );
    return rows[0];
  },

  /** Live (non-archived) document of a given type for a user, if any. */
  findLiveByType: async (userId, docType, { client, forUpdate = false } = {}) => {
    const lock = forUpdate ? " FOR UPDATE OF d" : "";
    const { rows } = await run(
      client,
      `SELECT ${docSelect}
         FROM verification_documents d
         JOIN approval_requests r ON r.id = d.approval_request_id
        WHERE d.user_id = $1 AND d.doc_type = $2 AND d.archived_at IS NULL
        LIMIT 1${lock}`,
      [userId, docType]
    );
    return rows[0] || null;
  },

  /** All live documents for a user, newest first. */
  findLiveByUser: async (userId, { client } = {}) => {
    const { rows } = await run(
      client,
      `SELECT ${docSelect}
         FROM verification_documents d
         JOIN approval_requests r ON r.id = d.approval_request_id
        WHERE d.user_id = $1 AND d.archived_at IS NULL
        ORDER BY d.uploaded_at DESC`,
      [userId]
    );
    return rows;
  },

  /** Single document by id (with its current review status). */
  findById: async (id, { client } = {}) => {
    const { rows } = await run(
      client,
      `SELECT ${docSelect}
         FROM verification_documents d
         JOIN approval_requests r ON r.id = d.approval_request_id
        WHERE d.id = $1
        LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  /** Soft-delete (archive) a single document. Returns the archived row. */
  archiveById: async (id, { client } = {}) => {
    const { rows } = await run(
      client,
      `UPDATE verification_documents
          SET archived_at = NOW()
        WHERE id = $1 AND archived_at IS NULL
        RETURNING id, user_id, doc_type, storage_path`,
      [id]
    );
    return rows[0] || null;
  },

  /** Soft-delete all live documents for a user (expiry sweep). */
  archiveAllForUser: async (userId, { client } = {}) => {
    const { rows } = await run(
      client,
      `UPDATE verification_documents
          SET archived_at = NOW()
        WHERE user_id = $1 AND archived_at IS NULL
        RETURNING id, storage_path`,
      [userId]
    );
    return rows;
  },

  /** Count of approved live documents per type for a user (activation gate). */
  approvedDocTypesForUser: async (userId, { client } = {}) => {
    const { rows } = await run(
      client,
      `SELECT d.doc_type
         FROM verification_documents d
         JOIN approval_requests r ON r.id = d.approval_request_id
        WHERE d.user_id = $1 AND d.archived_at IS NULL AND r.status = 'approved'`,
      [userId]
    );
    return rows.map((r) => r.doc_type);
  },
};

export default VerificationDocument;
