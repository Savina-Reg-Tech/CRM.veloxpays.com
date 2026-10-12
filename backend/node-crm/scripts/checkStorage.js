/**
 * End-to-end check of document storage, using the SAME configuration the server will use.
 *
 *   npm run storage:check
 *   docker compose exec backend npm run storage:check
 *
 * Uploads a tiny test file, reads it back, makes a download link and fetches it, then deletes
 * the file. Prints exactly which step failed and why. Touches nothing else in the bucket.
 */
import "dotenv/config";
import { randomUUID } from "crypto";

const { storage, storageStatus } = await import("../src/storage/index.js");

const step = async (label, fn) => {
  process.stdout.write(`  ${label} … `);
  try {
    const out = await fn();
    console.log("ok");
    return out;
  } catch (err) {
    console.log("FAILED");
    console.error(`\n❌ ${label} failed: ${err?.name ? `${err.name}: ` : ""}${err?.message || err}`);
    if (err?.$metadata?.httpStatusCode) console.error(`   HTTP ${err.$metadata.httpStatusCode} from S3`);
    process.exit(1);
  }
};

const status = await storageStatus();
console.log("Document storage:", JSON.stringify({ ...status, error: undefined, warning: undefined }));
if (status.warning) console.log(`⚠️  ${status.warning}`);
if (!status.ok) {
  console.error(`\n❌ Storage is not reachable: ${status.error}`);
  process.exit(1);
}

const key = `storage-check/${randomUUID()}.pdf`;
const body = Buffer.from("%PDF-1.4\n% velox-crm storage check\n");

await step("upload a test file", () => storage.put({ key, buffer: body, contentType: "application/pdf" }));
await step("read it back", async () => {
  const back = await storage.read(key);
  if (!back.equals(body)) throw new Error("the file read back is not the file that was uploaded");
});
await step("create a download link and fetch it", async () => {
  const url = await storage.getSignedUrl(key, { fileName: "storage check.pdf", contentType: "application/pdf" });
  if (!url) return; // local disk: served by the CRM download route instead
  const res = await fetch(url);
  if (!res.ok) throw new Error(`the signed link answered HTTP ${res.status}`);
  if (!Buffer.from(await res.arrayBuffer()).equals(body)) throw new Error("the signed link returned different content");
  const disposition = res.headers.get("content-disposition") || "";
  if (!disposition.includes("storage check.pdf")) throw new Error(`unexpected Content-Disposition: ${disposition}`);
});
await step("delete the test file", () => storage.remove(key));
await step("confirm it is gone", async () => {
  try {
    await storage.read(key);
  } catch {
    return;
  }
  throw new Error("the test file still exists after delete");
});

console.log(`\n✅ Document storage works (${status.kind}${status.bucket ? `: ${status.bucket}` : ""}).`);
