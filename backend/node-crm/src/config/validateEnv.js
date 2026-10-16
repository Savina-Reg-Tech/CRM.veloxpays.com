/**
 * Startup checks for secrets. JWT_SECRET signs every CRM session AND is the key VeloxVerse
 * trusts for the admin bridge (its CRM_JWT_SECRET), so a guessable value means anyone can mint
 * a super-admin session on both platforms. Production refuses to start with one.
 */

const MIN_JWT_SECRET_LENGTH = 32;

// Values that have appeared in this repo's examples / compose defaults — never acceptable.
const PLACEHOLDER_RE = /change|your_|example|secret_?key|placeholder|do-not-use|test-secret|replace/i;

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {string[]} problems; empty when the environment is safe to start with
 */
export function findEnvProblems(env = process.env) {
  const problems = [];
  const secret = env.JWT_SECRET ?? "";
  const isProduction = env.NODE_ENV === "production";

  if (secret === "") {
    problems.push("JWT_SECRET is not set.");
  } else if (isProduction) {
    if (secret.length < MIN_JWT_SECRET_LENGTH) {
      problems.push(`JWT_SECRET is too short (${secret.length} characters; need at least ${MIN_JWT_SECRET_LENGTH}).`);
    }
    if (PLACEHOLDER_RE.test(secret)) {
      problems.push("JWT_SECRET looks like a placeholder from an example file.");
    }
  }
  return problems;
}

/** Exit before listening if the environment is unsafe. */
export function assertSafeEnv(env = process.env) {
  const problems = findEnvProblems(env);
  if (problems.length === 0) return;
  console.error("❌ Refusing to start — unsafe configuration:");
  for (const p of problems) console.error(`   • ${p}`);
  console.error("   Generate a secret with: openssl rand -hex 32");
  console.error("   (VeloxVerse's CRM_JWT_SECRET must be set to the same value.)");
  process.exit(1);
}
