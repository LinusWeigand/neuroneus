import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { type Framework, frameworkFiles } from "@/lib/build/frameworks";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { out: { type: "string" }, serve: { type: "boolean" }, port: { type: "string", default: "3500" }, database: { type: "boolean" } },
});

const frameworks = (positionals.length ? positionals : ["starter", "web", "game2d"]) as (Framework | "starter")[];
const VARS = {
  name: "Template Check",
  vision: "A sample app that proves the template builds.",
  lang: "en",
  tagline: "Dodge, collect, survive.",
  comingSoon: "Coming soon",
  shaping: "The team is shaping the spec.",
};

function run(cwd: string, command: string, args: string[]) {
  const started = Date.now();
  execFileSync(command, args, { cwd, stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
  return ((Date.now() - started) / 1000).toFixed(1) + "s";
}

const results: Record<string, unknown> = {};
for (const framework of frameworks) {
  const dir = values.out ? path.join(values.out, framework) : fs.mkdtempSync(path.join(os.tmpdir(), `nn-template-${framework}-`));
  fs.rmSync(dir, { recursive: true, force: true });
  const files = frameworkFiles({ framework, database: Boolean(values.database), slug: `template-${framework}`, vars: VARS });
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
  }
  const timings = {
    install: run(dir, "npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"]),
    build: run(dir, "npm", ["run", "build"]),
  };
  results[framework] = { dir, files: Object.keys(files).length, ...timings };
  if (values.serve && framework === frameworks.at(-1)) {
    const server = spawn("npm", ["start", "--", "--port", values.port!], { cwd: dir, stdio: "inherit", detached: true });
    server.unref();
    results.serving = { url: `http://localhost:${values.port}`, pid: server.pid };
  }
}
process.stdout.write(JSON.stringify(results, null, 2) + "\n");
