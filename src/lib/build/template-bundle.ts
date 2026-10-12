import fs from "node:fs";
import path from "node:path";

export type TemplateBundle = {
  layers: Record<string, Record<string, string>>;
  skills: Record<string, string>;
  rules: Record<string, string>;
};

export const SHARED_RULES = ["no-comments.mjs", "disable-needs-reason.mjs", "no-hex-colors.mjs"];
export const BUNDLE_PATH = "src/lib/build/templates.bundle.json";

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    });
}

function readTree(dir: string) {
  return Object.fromEntries(
    walk(dir)
      .filter((file) => !file.endsWith(".test.ts"))
      .map((file) => [path.relative(dir, file).split(path.sep).join("/"), fs.readFileSync(file, "utf8")]),
  );
}

export function readTemplateBundle(root: string): TemplateBundle {
  const templates = path.join(root, "templates");
  const layers = Object.fromEntries(
    fs
      .readdirSync(templates, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "skills")
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) => [entry.name, readTree(path.join(templates, entry.name))]),
  );
  const skills = readTree(path.join(templates, "skills"));
  const rules = Object.fromEntries(SHARED_RULES.map((rule) => [rule, fs.readFileSync(path.join(root, "eslint-rules", rule), "utf8")]));
  return { layers, skills, rules };
}
