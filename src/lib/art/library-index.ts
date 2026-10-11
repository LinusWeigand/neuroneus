import "server-only";
import { blobUrl } from "./blob";
import { LIBRARY_INDEX_PATH, type LibraryIndex } from "./library";

let cached: { at: number; index: LibraryIndex } | null = null;

export async function loadLibraryIndex(): Promise<LibraryIndex | null> {
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.index;
  const res = await fetch(blobUrl("library", LIBRARY_INDEX_PATH), { signal: AbortSignal.timeout(30_000) }).catch(() => null);
  if (!res?.ok) return null;
  cached = { at: Date.now(), index: (await res.json()) as LibraryIndex };
  return cached.index;
}
