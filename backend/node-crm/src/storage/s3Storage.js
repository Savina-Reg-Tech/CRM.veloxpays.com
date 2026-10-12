/**
 * AWS S3 storage adapter (production).
 *
 * Env:
 *   S3_BUCKET            (required to select this adapter)
 *   AWS_REGION           (default us-east-1 — must be the bucket's region)
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY  (or any default AWS credential chain)
 *   S3_PREFIX            (optional key prefix inside the bucket, e.g. "crm/")
 *   S3_SIGNED_URL_TTL    (seconds a download link stays valid, default 300)
 *   S3_ENDPOINT          (optional — only for S3-compatible stores such as MinIO)
 *   S3_FORCE_PATH_STYLE  ("true" for most S3-compatible stores)
 *
 * Objects are private and encrypted at rest; nothing in the bucket is public. Files reach a
 * browser only as a short-lived signed URL, handed out by an authenticated CRM route after it
 * has checked that this person may see this document.
 */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as presign } from "@aws-sdk/s3-request-presigner";
import { assertSafeKey, contentDisposition } from "./keys.js";

const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.AWS_REGION || "us-east-1";
const PREFIX = process.env.S3_PREFIX || "";
const URL_TTL = parseInt(process.env.S3_SIGNED_URL_TTL, 10) || 300;
const ENDPOINT = process.env.S3_ENDPOINT || undefined;
const FORCE_PATH_STYLE = String(process.env.S3_FORCE_PATH_STYLE || "").toLowerCase() === "true";

let _client;
const client = () =>
  (_client ||= new S3Client({
    region: REGION,
    ...(ENDPOINT ? { endpoint: ENDPOINT } : {}),
    ...(FORCE_PATH_STYLE ? { forcePathStyle: true } : {}),
  }));
const fullKey = (key) => `${PREFIX}${assertSafeKey(key)}`;

export const s3Storage = {
  kind: "s3",

  describe() {
    return { kind: "s3", bucket: BUCKET, region: REGION, prefix: PREFIX, signedUrlTtlSeconds: URL_TTL };
  },

  async put({ key, buffer, contentType }) {
    const Key = fullKey(key);
    await client().send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key,
        Body: buffer,
        ContentType: contentType,
        ServerSideEncryption: "AES256",
      })
    );
    // Store the bare key; URLs are signed on demand (objects stay private).
    return { storagePath: key, fileUrl: null };
  },

  async remove(key) {
    await client().send(
      new DeleteObjectCommand({ Bucket: BUCKET, Key: fullKey(key) })
    );
  },

  /**
   * A link to this one object, valid for S3_SIGNED_URL_TTL seconds. `fileName` / `contentType`
   * make the browser show it under its original name and type (inline — PDFs and images open
   * in the tab) instead of the random storage key.
   */
  async getSignedUrl(key, { fileName, contentType } = {}) {
    return presign(
      client(),
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: fullKey(key),
        ...(fileName ? { ResponseContentDisposition: contentDisposition(fileName) } : {}),
        ...(contentType ? { ResponseContentType: contentType } : {}),
      }),
      { expiresIn: URL_TTL }
    );
  },

  async read(key) {
    const out = await client().send(
      new GetObjectCommand({ Bucket: BUCKET, Key: fullKey(key) })
    );
    return Buffer.from(await out.Body.transformToByteArray());
  },

  /** Can we reach the bucket with these credentials? Never throws. */
  async check() {
    try {
      await client().send(new HeadBucketCommand({ Bucket: BUCKET }));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: describeS3Error(err) };
    }
  },
};

/** A plain-language reason for the most common S3 setup mistakes. */
export function describeS3Error(err) {
  const status = err?.$metadata?.httpStatusCode;
  const name = err?.name || err?.Code || "";
  const code = err?.code || err?.errors?.[0]?.code || "";
  if (["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN"].includes(code)) {
    return `Could not connect to S3${ENDPOINT ? ` at ${ENDPOINT}` : ` in region ${REGION}`} (${code}). Check the network and AWS_REGION.`;
  }
  if (name === "CredentialsProviderError" || /could not load credentials/i.test(err?.message || "")) {
    return "No AWS credentials found. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.";
  }
  if (status === 403 || /AccessDenied|InvalidAccessKeyId|SignatureDoesNotMatch/.test(name)) {
    return `Access denied (${name || status}). Check the access key / secret, and that the IAM policy allows this bucket.`;
  }
  if (status === 404 || name === "NoSuchBucket" || name === "NotFound") {
    return `Bucket "${BUCKET}" was not found. Check S3_BUCKET.`;
  }
  if (status === 301 || name === "PermanentRedirect" || /region/i.test(err?.message || "")) {
    // S3 names the bucket's real region in a response header — pass it on so the fix is obvious.
    const actual = err?.$response?.headers?.["x-amz-bucket-region"];
    return `Bucket "${BUCKET}" is in a different region than AWS_REGION=${REGION}.${actual ? ` Set AWS_REGION=${actual}.` : ""}`;
  }
  return err?.message || String(err);
}
