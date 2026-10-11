import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { decodeBlob, encodeBlob } from "./blob-codec";

type BlobName = "files" | "good" | "task";

export async function loadBlob<T>(buildId: string, name: BlobName): Promise<T | null> {
  const [row] = await db
    .select({ data: schema.buildBlobs.data })
    .from(schema.buildBlobs)
    .where(and(eq(schema.buildBlobs.buildId, buildId), eq(schema.buildBlobs.name, name)));
  return row ? decodeBlob<T>(row.data) : null;
}

export async function saveBlobs(buildId: string, blobs: Partial<Record<BlobName, unknown | null>>) {
  for (const [name, value] of Object.entries(blobs) as [BlobName, unknown][]) {
    if (value === undefined) continue;
    if (value === null) {
      await db.delete(schema.buildBlobs).where(and(eq(schema.buildBlobs.buildId, buildId), eq(schema.buildBlobs.name, name)));
      continue;
    }
    const data = await encodeBlob(value);
    await db
      .insert(schema.buildBlobs)
      .values({ buildId, name, data })
      .onConflictDoUpdate({
        target: [schema.buildBlobs.buildId, schema.buildBlobs.name],
        set: { data, updatedAt: sql`now()` },
      });
  }
}

export async function clearBlobs(buildIds: string | string[]) {
  const ids = Array.isArray(buildIds) ? buildIds : [buildIds];
  if (ids.length) await db.delete(schema.buildBlobs).where(inArray(schema.buildBlobs.buildId, ids));
}
