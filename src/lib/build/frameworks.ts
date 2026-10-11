import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { FileMap } from "./repo";

export type Framework = "web" | "game2d" | "game3d";
export type Layer = "shared" | "starter" | "gamecommon" | Framework | "database";

export const VERSIONS = {
  next: "16.3.8",
  react: "19.2.8",
  tailwind: "4.3.3",
  typescript: "5.9.3",
  eslint: "9.39.5",
  typesNode: "20.19.43",
  typesReact: "19.3.0",
  neon: "1.2.0",
  phaser: "4.2.1",
  zzfx: "1.4.0",
  three: "0.186.1",
  typesThree: "0.186.0",
  postprocessing: "6.39.5",
} as const;

const SHARED_RULES = ["no-comments.mjs", "disable-needs-reason.mjs", "no-hex-colors.mjs"];

function root() {
  return process.cwd();
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

export function layerFiles(layer: Layer): FileMap {
  const dir = path.join(root(), "templates", layer);
  const files: FileMap = {};
  for (const file of walk(dir)) {
    if (file.endsWith(".test.ts")) continue;
    files[path.relative(dir, file).split(path.sep).join("/")] = fs.readFileSync(file, "utf8");
  }
  if (layer === "shared") {
    for (const rule of SHARED_RULES) files[`eslint-rules/${rule}`] = fs.readFileSync(path.join(root(), "eslint-rules", rule), "utf8");
  }
  return files;
}

const RAW = /\.(md|css)$/;

export function fill(content: string, vars: Record<string, string>, raw = false) {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in vars ? (raw ? vars[key] : JSON.stringify(vars[key]).slice(1, -1)) : match,
  );
}

export function materialize(layers: Layer[], vars: Record<string, string>): FileMap {
  const files: FileMap = {};
  for (const layer of layers) {
    for (const [file, content] of Object.entries(layerFiles(layer))) files[file] = fill(content, vars, RAW.test(file));
  }
  return files;
}

function skillFiles(framework: Framework | "starter"): FileMap {
  if (framework !== "game2d") return {};
  const dir = path.join(root(), "templates", "skills", "phaser");
  return Object.fromEntries(walk(dir).map((file) => [`docs/skills/phaser/${path.basename(file)}`, fs.readFileSync(file, "utf8")]));
}

export function packageJson(input: { slug: string; framework: Framework | "starter"; database: boolean }) {
  const dependencies: Record<string, string> = { next: VERSIONS.next, react: VERSIONS.react, "react-dom": VERSIONS.react };
  const devDependencies: Record<string, string> = {
    "@tailwindcss/postcss": VERSIONS.tailwind,
    "@types/node": VERSIONS.typesNode,
    "@types/react": VERSIONS.typesReact,
    "@types/react-dom": VERSIONS.typesReact,
    eslint: VERSIONS.eslint,
    "eslint-config-next": VERSIONS.next,
    tailwindcss: VERSIONS.tailwind,
    typescript: VERSIONS.typescript,
  };
  if (input.framework === "game2d") Object.assign(dependencies, { phaser: VERSIONS.phaser, zzfx: VERSIONS.zzfx });
  if (input.framework === "game3d") {
    Object.assign(dependencies, { three: VERSIONS.three, postprocessing: VERSIONS.postprocessing, zzfx: VERSIONS.zzfx });
    devDependencies["@types/three"] = VERSIONS.typesThree;
  }
  if (input.database) dependencies["@neondatabase/serverless"] = VERSIONS.neon;
  const pkg = {
    name: input.slug,
    version: "0.1.0",
    private: true,
    scripts: { dev: "next dev", build: "eslint . --max-warnings 0 && next build", start: "next start", lint: "eslint ." },
    dependencies: sortKeys(dependencies),
    devDependencies: sortKeys(devDependencies),
  };
  return JSON.stringify(pkg, null, 2) + "\n";
}

function sortKeys(record: Record<string, string>) {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

export function frameworkFiles(input: {
  framework: Framework | "starter";
  database: boolean;
  slug: string;
  vars: Record<string, string>;
}): FileMap {
  const layers: Layer[] =
    input.framework === "web"
      ? ["shared", "starter", "web"]
      : input.framework === "starter"
        ? ["shared", "starter"]
        : ["shared", "gamecommon", input.framework];
  if (input.database) layers.push("database");
  return { ...materialize(layers, { slug: input.slug, ...input.vars }), ...skillFiles(input.framework), "package.json": packageJson(input) };
}

export type Marker = { kind?: string; design?: string | null; database?: boolean; framework?: Framework };

export function readMarker(files: FileMap): Marker {
  try {
    return JSON.parse(files[".neuroneus.json"] ?? "{}") as Marker;
  } catch {
    return {};
  }
}

export function storageNote(framework: Framework, database: boolean) {
  if (framework === "web") {
    return database
      ? "Neon Postgres. `import { sql } from \"@/lib/db\"` and query with tagged templates in Server Actions and queries; never build SQL strings. Every schema change goes into `db/schema.sql` as idempotent SQL (it runs before each deploy; never drop tables or columns). Pages that read the database render per request: `export const dynamic = \"force-dynamic\";`."
      : "No server database. Keep state in React; persist what must survive a reload on the device with localStorage (guard for server rendering).";
  }
  return database
    ? "Online data (leaderboards, shared saves) goes through Server Actions using `lib/db.ts` (`sql` tagged templates); schema in `db/schema.sql`, idempotent, applied before each deploy. Local things (best score, settings) stay in `game/storage.ts`."
    : "Nothing is stored on a server. The best score and settings live in `game/storage.ts` (localStorage).";
}

export function prepareFrameworkFiles(input: {
  before: FileMap;
  framework: Framework;
  database: boolean;
  slug: string;
  vars: Record<string, string>;
}): FileMap {
  const marker = readMarker(input.before);
  const vars = { ...input.vars, storage: storageNote(input.framework, input.database) };
  const files = { ...input.before };
  if (marker.framework !== input.framework) {
    Object.assign(files, frameworkFiles({ framework: input.framework, database: input.database, slug: input.slug, vars }));
  } else if (input.database && !marker.database) {
    Object.assign(files, materialize(["database"], vars));
    const pkg = JSON.parse(files["package.json"] ?? "{}") as { dependencies?: Record<string, string> };
    pkg.dependencies = { ...(pkg.dependencies ?? {}), "@neondatabase/serverless": VERSIONS.neon };
    files["package.json"] = JSON.stringify(pkg, null, 2) + "\n";
  }
  const agents = layerFiles(input.framework)["AGENTS.md"];
  if (agents) files["AGENTS.md"] = fill(agents, { slug: input.slug, ...vars }, true);
  files[".neuroneus.json"] = JSON.stringify({ ...marker, framework: input.framework, database: input.database }, null, 2) + "\n";
  return files;
}
