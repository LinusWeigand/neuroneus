import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { FileMap } from "./repo";

export type Framework = "web" | "game2d" | "game3d";
export type Layer = "shared" | "starter" | Framework | "database";

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

export function fill(content: string, vars: Record<string, string>) {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (key in vars ? JSON.stringify(vars[key]).slice(1, -1) : match));
}

export function materialize(layers: Layer[], vars: Record<string, string>): FileMap {
  const files: FileMap = {};
  for (const layer of layers) {
    for (const [file, content] of Object.entries(layerFiles(layer))) files[file] = fill(content, vars);
  }
  return files;
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
  const layers: Layer[] = ["shared", input.framework === "starter" ? "starter" : input.framework];
  if (input.database) layers.push("database");
  return { ...materialize(layers, { slug: input.slug, ...input.vars }), "package.json": packageJson(input) };
}
