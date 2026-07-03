/**
 * Role-based required-documents catalog (KYC verification).
 *
 * Single source of truth for:
 *   • Which document types each role must upload before activation.
 *   • Optional documents that count toward the catalog but not the gate.
 *   • Human-readable labels (reused by the API + frontend mirror).
 *
 * Mirrored on the frontend in `src/config/verificationDocs.ts` — keep in sync.
 */

/** Canonical document types and their display labels. */
export const DOC_LABELS = Object.freeze({
  passport: "Passport",
  driving_license: "Driving License",
  proof_of_address: "Proof of Address",
  experience_letter: "Experience Letter",
  police_verification: "Police Verification Certificate",
  business_registration: "Business Registration Certificate",
  trade_license: "Trade License",
  incorporation_certificate: "Incorporation Certificate",
  tax_certificate: "Tax Certificate",
  business_address_proof: "Business Address Proof",
  business_bank_account_details: "Business Bank Account Details",
  business_bank_statements: "Business Bank Statements",
  bank_account_details: "Bank Account Details",
  business_account_details: "Business Account Details",
});

/**
 * Per-role requirements.
 *   required — must be Approved before the account can be activated.
 *   optional — may be uploaded; does NOT gate activation.
 *
 * @type {Readonly<Record<string, { required: readonly string[]; optional: readonly string[] }>>}
 */
export const ROLE_REQUIRED_DOCUMENTS = Object.freeze({
  employee: {
    required: [
      "passport",
      "driving_license",
      "proof_of_address",
      "experience_letter",
      "police_verification",
    ],
    optional: [],
  },

  agent: {
    required: [
      // Personal
      "passport",
      "driving_license",
      "proof_of_address",
      // Business
      "business_registration",
      "trade_license",
      "incorporation_certificate",
      "tax_certificate",
      "business_address_proof",
      "business_bank_account_details",
      "business_bank_statements",
    ],
    optional: [],
  },

  affiliate: {
    required: [
      "passport",
      "driving_license",
      "proof_of_address",
      "bank_account_details",
    ],
    // Only if the affiliate is registered as a business entity.
    optional: ["business_account_details"],
  },

  // Admins / super-admins are auto-activated and upload nothing.
  admin: { required: [], optional: [] },
  super_admin: { required: [], optional: [] },
});

/** Roles that must complete document verification before activation. */
export const ROLES_REQUIRING_VERIFICATION = Object.freeze([
  "employee",
  "agent",
  "affiliate",
]);

/** Days a newly created (unverified) account has to finish verification. */
export const VERIFICATION_WINDOW_DAYS = 7;

/**
 * @param {string | undefined} role
 * @returns {boolean}
 */
export function roleRequiresVerification(role) {
  return (
    typeof role === "string" && ROLES_REQUIRING_VERIFICATION.includes(role)
  );
}

/**
 * @param {string | undefined} role
 * @returns {{ required: readonly string[]; optional: readonly string[] }}
 */
export function getRoleDocumentSpec(role) {
  return ROLE_REQUIRED_DOCUMENTS[role] || { required: [], optional: [] };
}

/** Every doc type (required + optional) valid for a role. */
export function getAllowedDocTypes(role) {
  const spec = getRoleDocumentSpec(role);
  return [...spec.required, ...spec.optional];
}

/** Custom doc types are prefixed with "custom_". */
export const CUSTOM_DOC_PREFIX = "custom_";

/**
 * @param {string | undefined} docType
 * @returns {boolean}
 */
export function isCustomDocType(docType) {
  return typeof docType === "string" && docType.startsWith(CUSTOM_DOC_PREFIX);
}

/**
 * @param {string | undefined} role
 * @param {string | undefined} docType
 * @returns {boolean}
 */
export function isDocTypeAllowedForRole(role, docType) {
  if (typeof docType !== "string") return false;
  // Custom (additional) documents are allowed for any verification role.
  if (isCustomDocType(docType) && roleRequiresVerification(role)) return true;
  return getAllowedDocTypes(role).includes(docType);
}

/** Human label for a doc type, falling back to the raw key. */
export function docLabel(docType) {
  return DOC_LABELS[docType] || docType;
}
