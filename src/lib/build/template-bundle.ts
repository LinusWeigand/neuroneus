import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type TemplateBundle = {
  layers: Record<string, Record<string, string>>;
  skills: Record<string, string>;
  rules: Record<string, string>;
};

export const SHARED_RULES = ["no-comments.mjs", "disable-needs-reason.mjs", "no-hex-colors.mjs"];
export const BUNDLE_PATH = "src/lib/build/templates.bundle.json";

function gitFiles(root: string, dir: string) {
  return execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", dir], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter((file) => file && !file.endsWith(".test.ts") && fs.existsSync(path.join(root, file)))
    .sort();
}

function readTree(root: string, dir: string) {
  return Object.fromEntries(gitFiles(root, dir).map((file) => [path.posix.relative(dir, file), fs.readFileSync(path.join(root, file), "utf8")]));
}

export function readTemplateBundle(root: string): TemplateBundle {
  const layers = Object.fromEntries(
    fs
      .readdirSync(path.join(root, "templates"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "skills")
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) => [entry.name, readTree(root, `templates/${entry.name}`)]),
  );
  const skills = readTree(root, "templates/skills");
  const rules = Object.fromEntries(SHARED_RULES.map((rule) => [rule, fs.readFileSync(path.join(root, "eslint-rules", rule), "utf8")]));
  return { layers, skills, rules };
}
