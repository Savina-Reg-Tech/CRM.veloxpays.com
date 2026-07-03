/**
 * AWS S3 storage adapter (production).
 *
 * Env:
 *   S3_BUCKET            (required to select this adapter)
 *   AWS_REGION           (default us-east-1)
 *   S3_PREFIX            (optional key prefix, e.g. "verification/")
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY  (or any default AWS credential chain)
 *   S3_SIGNED_URL_TTL    (seconds, default 300)
 *
 * Objects are private; documents are handed to clients as short-lived signed URLs.
 */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as presign } from "@aws-sdk/s3-request-presigner";

const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.AWS_REGION || "us-east-1";
const PREFIX = process.env.S3_PREFIX || "";
const URL_TTL = parseInt(process.env.S3_SIGNED_URL_TTL, 10) || 300;

let _client;
const client = () => (_client ||= new S3Client({ region: REGION }));
const fullKey = (key) => `${PREFIX}${key}`;

export const s3Storage = {
  kind: "s3",

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

  async getSignedUrl(key) {
    return presign(
      client(),
      new GetObjectCommand({ Bucket: BUCKET, Key: fullKey(key) }),
      { expiresIn: URL_TTL }
    );
  },

  async read(key) {
    const out = await client().send(
      new GetObjectCommand({ Bucket: BUCKET, Key: fullKey(key) })
    );
    return Buffer.from(await out.Body.transformToByteArray());
  },
};
