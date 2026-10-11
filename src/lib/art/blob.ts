import "server-only";
import { createHash } from "node:crypto";

export type BlobContainer = "library" | "art" | "evidence";

export function storageConfigured() {
  return Boolean(process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_SAS);
}

export function blobUrl(container: BlobContainer, name: string) {
  return `https://${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${container}/${name.split("/").map(encodeURIComponent).join("/")}`;
}

export function sha1(data: Buffer) {
  return createHash("sha1").update(data).digest("hex");
}

export async function putBlob(container: BlobContainer, name: string, data: Buffer, contentType: string, attempts = 3) {
  if (!storageConfigured()) throw new Error("Azure storage is not configured (AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_SAS).");
  const url = blobUrl(container, name);
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(`${url}?${process.env.AZURE_STORAGE_SAS}`, {
        method: "PUT",
        headers: {
          "x-ms-blob-type": "BlockBlob",
          "content-type": contentType,
          "x-ms-blob-cache-control": "public, max-age=31536000, immutable",
        },
        body: new Uint8Array(data),
        signal: AbortSignal.timeout(120_000),
      });
      if (res.ok) return url;
      lastError = new Error(`Azure storage ${res.status}: ${(await res.text()).slice(0, 200)}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  throw lastError;
}

export async function fetchBytes(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Fetching ${url} failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
