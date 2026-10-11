import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { config } from "dotenv";
import sharp from "sharp";
import { blobUrl, putBlob, sha1 } from "@/lib/art/blob";
import { contactSheet } from "@/lib/art/process";
import { KENNEY_PACKS, type LibraryFile, type LibraryIndex } from "@/lib/art/library";

config({ path: [".env.local", ".env"], quiet: true });

const CACHE = path.join(os.tmpdir(), "nn-kenney");
const SHEET_SIZE = 48;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

async function pageZipUrl(slug: string) {
  const html = await (await fetch(`https://kenney.nl/assets/${slug}`, { headers: { "user-agent": "Mozilla/5.0" } })).text();
  const match = /media\/pages\/assets\/[^'"]+\.zip/.exec(html);
  if (!match) throw new Error(`No download link for ${slug}`);
  return `https://kenney.nl/${match[0]}`;
}

async function download(slug: string) {
  const dir = path.join(CACHE, slug);
  if (fs.existsSync(dir)) return dir;
  fs.mkdirSync(CACHE, { recursive: true });
  const zip = path.join(CACHE, `${slug}.zip`);
  const res = await fetch(await pageZipUrl(slug), { headers: { "user-agent": "Mozilla/5.0" } });
  fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  execFileSync("unzip", ["-q", "-o", zip, "-d", dir]);
  return dir;
}

async function main() {
  const only = process.argv.slice(2);
  const index: LibraryIndex = { updatedAt: new Date().toISOString(), packs: {} };
  for (const pack of KENNEY_PACKS.filter((p) => !only.length || only.includes(p.slug))) {
    const dir = await download(pack.slug);
    const files = walk(dir)
      .map((file) => path.relative(dir, file).split(path.sep).join("/"))
      .filter((file) => pack.include.test(file) && !(pack.exclude?.test(file) ?? false))
      .sort();
    const entries: LibraryFile[] = [];
    const thumbs: { data: Buffer; label: string }[] = [];
    for (let i = 0; i < files.length; i += 8) {
      const batch = await Promise.all(
        files.slice(i, i + 8).map(async (file) => {
          const data = fs.readFileSync(path.join(dir, file));
          const target = file.replace(pack.strip ?? /^$/, "");
          const meta = file.endsWith(".png") ? await sharp(data).metadata() : null;
          await putBlob("library", `kenney/${pack.slug}/${target}`, data, file.endsWith(".png") ? "image/png" : "model/gltf-binary");
          return { data, meta, entry: { path: target, sha1: sha1(data), size: data.length, width: meta?.width, height: meta?.height } };
        }),
      );
      for (const { data, meta, entry } of batch) {
        entries.push(entry);
        if (meta && !entry.path.includes("/Textures/") && thumbs.length < 400) thumbs.push({ data, label: entry.path });
      }
    }
    const sheets: string[] = [];
    for (let i = 0; i < thumbs.length; i += SHEET_SIZE) {
      const sheet = await contactSheet(thumbs.slice(i, i + SHEET_SIZE), 128);
      const name = `kenney/${pack.slug}/_sheet-${sheets.length + 1}.png`;
      await putBlob("library", name, sheet, "image/png");
      sheets.push(blobUrl("library", name));
    }
    index.packs[pack.slug] = { name: pack.name, dimension: pack.dimension, license: "CC0 1.0 (kenney.nl)", files: entries, sheets };
    process.stdout.write(`${pack.slug}: ${entries.length} files, ${(entries.reduce((n, e) => n + e.size, 0) / 1048576).toFixed(1)} MB, ${sheets.length} sheets\n`);
  }
  const existing = await fetch(blobUrl("library", "kenney/index.json")).then((r) => (r.ok ? (r.json() as Promise<LibraryIndex>) : null));
  const merged: LibraryIndex = { updatedAt: index.updatedAt, packs: { ...(existing?.packs ?? {}), ...index.packs } };
  await putBlob("library", "kenney/index.json", Buffer.from(JSON.stringify(merged)), "application/json");
  process.stdout.write(`index: ${Object.keys(merged.packs).length} packs\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
