import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { parseArgs } from "node:util";
import { config } from "dotenv";
import { type Browser, chromium, type Page } from "playwright";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";

config({ path: [".env.local", ".env"], quiet: true });

const t = DICTIONARIES.en;
const ROOT = process.cwd();
const STATE_DIR = path.join(ROOT, ".verify");
const INSTANCE = path.join(STATE_DIR, "instance.json");
const EVIDENCE = path.join(STATE_DIR, "evidence");
const OFFLINE_ENV = ["GITHUB_APP_ID", "GITHUB_INSTALLATION_ID", "NEON_API_KEY", "VERCEL_API_KEY"];
let sessionCookie = "";

type Instance = { pid: number; port: number; url: string; profile: Profile; startedAt: string; log: string; password: string };
type Profile = "local" | "full";
type Result = Record<string, unknown> & { ok: boolean };

const HELP = `pnpm verify <command> [options]

Drives a running Neuroneus the way a user does and saves evidence to .verify/evidence/.

Commands
  launch [--profile local|full] [--port 3400]   build and start an instance (local: no GitHub, Vercel or Neon)
  doctor [--url http://localhost:3300]          is the instance worth driving?
  features                                      list the features drive knows
  drive <feature> [--project <id>] [--message <text>] [--name <text>] [--vision <text>] [--url <base>]
  wait-run --project <id> [--timeout 300]       wait until a huddle finishes
  wait-build --project <id> [--timeout 1800]    wait until a build round finishes, printing its stages
  cleanup                                       stop the instance launch started (evidence stays)

Output is one JSON object per command on stdout. Exit code 1 when ok is false.`;

const FEATURES: Record<string, { needs?: "project"; run: (page: Page, ctx: DriveContext) => Promise<Result> }> = {
  home: { run: driveHome },
  "create-project": { run: driveCreateProject },
  huddle: { needs: "project", run: driveHuddle },
  decide: { needs: "project", run: driveDecide },
  "project-tab": { needs: "project", run: driveProjectTab },
  language: { run: driveLanguage },
  "delete-project": { needs: "project", run: driveDeleteProject },
};

type DriveContext = { base: string; project?: string; message?: string; name?: string; vision?: string; evidence: string };

function out(result: Result): never {
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.ok ? 0 : 1);
}

function readInstance(): Instance | null {
  try {
    return JSON.parse(fs.readFileSync(INSTANCE, "utf8")) as Instance;
  } catch {
    return null;
  }
}

function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function freePort(preferred: number): Promise<number> {
  for (let port = preferred; port < preferred + 50; port++) {
    const free = await new Promise<boolean>((resolve) => {
      const server = net.createServer().once("error", () => resolve(false));
      server.listen(port, () => server.close(() => resolve(true)));
    });
    if (free) return port;
  }
  throw new Error(`No free port near ${preferred}.`);
}

async function waitFor(check: () => Promise<boolean>, timeoutMs: number, intervalMs = 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function signIn(base: string) {
  const password = readInstance()?.password ?? process.env.VERIFY_PASSWORD ?? "";
  const res = await fetch(`${base}/api/auth`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("nn_session="));
  sessionCookie = cookie ?? "";
  return res.ok;
}

async function api<T>(base: string, route: string): Promise<{ status: number; body: T | null }> {
  const res = await fetch(base + route, { headers: { cookie: ["nn_locale=en", sessionCookie].filter(Boolean).join("; ") } });
  return { status: res.status, body: (await res.json().catch(() => null)) as T | null };
}

async function launch(profile: Profile, preferredPort: number) {
  const existing = readInstance();
  if (existing && alive(existing.pid)) out({ ok: false, error: "An instance is already running.", instance: existing });
  fs.mkdirSync(EVIDENCE, { recursive: true });
  if (!process.env.DATABASE_URL) out({ ok: false, error: "DATABASE_URL is not set (.env.local). Start the scratch database first, see the skill's Launch section." });

  const password = randomBytes(16).toString("hex");
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production", APP_PASSWORD: password };
  if (profile === "local") for (const key of OFFLINE_ENV) env[key] = "";

  const build = spawn("pnpm", ["build"], { cwd: ROOT, env, stdio: "pipe" });
  let buildLog = "";
  build.stdout.on("data", (d) => (buildLog += d));
  build.stderr.on("data", (d) => (buildLog += d));
  const code = await new Promise<number>((resolve) => build.on("close", (c) => resolve(c ?? 1)));
  if (code !== 0) out({ ok: false, error: "pnpm build failed.", log: buildLog.slice(-3000) });

  const port = await freePort(preferredPort);
  const log = path.join(STATE_DIR, `instance-${port}.log`);
  const logFd = fs.openSync(log, "w");
  const server = spawn("pnpm", ["next", "start", "--port", String(port)], { cwd: ROOT, env, detached: true, stdio: ["ignore", logFd, logFd] });
  server.unref();
  const url = `http://localhost:${port}`;
  const ready = await waitFor(async () => (await fetch(url)).ok, 90_000);
  const instance: Instance = { pid: server.pid!, port, url, profile, startedAt: new Date().toISOString(), log, password };
  fs.writeFileSync(INSTANCE, JSON.stringify(instance, null, 2));
  out({ ok: ready, instance, ...(ready ? {} : { error: "The server didn't answer within 90 s.", logTail: fs.readFileSync(log, "utf8").slice(-2000) }) });
}

async function doctor(urlOverride?: string) {
  const instance = readInstance();
  const base = urlOverride ?? instance?.url;
  if (!base) out({ ok: false, error: "No instance. Run `pnpm verify launch` or pass --url." });
  const checks: { name: string; ok: boolean; detail?: unknown }[] = [];
  if (!urlOverride && instance) checks.push({ name: "process", ok: alive(instance.pid), detail: { pid: instance.pid } });
  const home = await fetch(base).catch(() => null);
  checks.push({ name: "home answers", ok: Boolean(home?.ok), detail: home?.status ?? "unreachable" });
  checks.push({ name: "sign in", ok: await signIn(base).catch(() => false) });
  const projects = await api<{ projects: unknown[] }>(base, "/api/projects").catch(() => null);
  checks.push({
    name: "database",
    ok: projects?.status === 200 && Array.isArray(projects.body?.projects),
    detail: projects?.status === 401 ? "signed out: pass VERIFY_PASSWORD for an instance launch didn't start" : projects?.status,
  });
  checks.push({ name: "azure configured", ok: Boolean(process.env.AZURE_API_KEY && process.env.AZURE_RESOURCE_NAME) });
  out({ ok: checks.every((c) => c.ok), base, profile: urlOverride ? "external" : (instance?.profile ?? "external"), checks });
}

async function cleanup() {
  const instance = readInstance();
  if (!instance) out({ ok: true, stopped: false, note: "Nothing launched." });
  if (alive(instance.pid)) {
    process.kill(-instance.pid, "SIGTERM");
    const stopped = await waitFor(async () => !alive(instance.pid), 8000, 250);
    if (!stopped) process.kill(-instance.pid, "SIGKILL");
  }
  fs.rmSync(INSTANCE, { force: true });
  out({ ok: true, stopped: true, pid: instance.pid, evidence: EVIDENCE });
}

async function withPage<T>(fn: (page: Page, browser: Browser) => Promise<T>): Promise<T> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    return await fn(page, browser);
  } finally {
    await browser.close();
  }
}

async function shot(page: Page, ctx: DriveContext, name: string) {
  const file = path.join(ctx.evidence, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return path.relative(ROOT, file);
}

async function openProject(page: Page, ctx: DriveContext) {
  await page.goto(`${ctx.base}/p/${ctx.project}`);
  await page.getByRole("textbox", { name: t.composer.label }).waitFor({ timeout: 20_000 });
}

async function projectState(ctx: DriveContext) {
  const { body } = await api<{ project: { running: boolean }; messages: { kind: string; authorType: string; data: { status?: string } | null }[] }>(ctx.base, `/api/projects/${ctx.project}`);
  return body;
}

async function waitRun(ctx: DriveContext, timeoutMs: number) {
  await new Promise((r) => setTimeout(r, 1500));
  return waitFor(async () => (await projectState(ctx))?.project.running === false, timeoutMs, 2000);
}

function summarize(state: Awaited<ReturnType<typeof projectState>>) {
  const messages = state?.messages ?? [];
  return {
    messages: messages.length,
    agentMessages: messages.filter((m) => m.authorType === "agent" && m.kind === "chat").length,
    pendingCard: messages.some((m) => m.kind === "decision_request" && m.data?.status === "pending"),
  };
}

async function driveHome(page: Page, ctx: DriveContext): Promise<Result> {
  await page.goto(ctx.base);
  const heading = await page.getByRole("heading").first().textContent();
  return { ok: Boolean(heading), heading, screenshot: await shot(page, ctx, "home") };
}

async function driveCreateProject(page: Page, ctx: DriveContext): Promise<Result> {
  await page.goto(`${ctx.base}/new`);
  await page.getByLabel(t.newProject.nameLabel).fill(ctx.name ?? `Verify ${new Date().toISOString().slice(11, 19)}`);
  await page.locator("#vision").fill(ctx.vision ?? "A small web app where a book club suggests books, votes on the next read, and sees the meeting date.");
  await page.getByRole("button", { name: t.newProject.submit }).click();
  await page.waitForURL(/\/p\/[0-9a-f-]{36}/, { timeout: 90_000 });
  const projectId = /\/p\/([0-9a-f-]{36})/.exec(page.url())![1];
  ctx.project = projectId;
  const settled = await waitRun(ctx, 300_000);
  return { ok: settled, projectId, ...summarize(await projectState(ctx)), screenshot: await shot(page, ctx, "created") };
}

async function driveHuddle(page: Page, ctx: DriveContext): Promise<Result> {
  await openProject(page, ctx);
  const before = summarize(await projectState(ctx));
  await page.getByRole("textbox", { name: t.composer.label }).fill(ctx.message ?? "What is the riskiest assumption in this plan?");
  await page.keyboard.press("Enter");
  const settled = await waitRun(ctx, 300_000);
  await page.reload();
  const after = summarize(await projectState(ctx));
  return {
    ok: settled && after.agentMessages > before.agentMessages,
    newAgentMessages: after.agentMessages - before.agentMessages,
    pendingCard: after.pendingCard,
    screenshot: await shot(page, ctx, "huddle"),
  };
}

async function driveDecide(page: Page, ctx: DriveContext): Promise<Result> {
  await openProject(page, ctx);
  const groups = page.getByRole("radiogroup");
  const count = await groups.count();
  if (count === 0) return { ok: false, error: "No open decision card." };
  const acceptAll = page.getByRole("button", { name: t.card.acceptAll });
  if ((await acceptAll.count()) > 0) await acceptAll.click();
  else await groups.last().getByRole("radio").first().click();
  const settled = await waitRun(ctx, 300_000);
  await page.reload();
  return { ok: settled, ...summarize(await projectState(ctx)), screenshot: await shot(page, ctx, "decided") };
}

async function openDetails(page: Page) {
  await page.getByRole("tab", { name: t.app.tabProject }).first().click();
}

async function driveProjectTab(page: Page, ctx: DriveContext): Promise<Result> {
  await openProject(page, ctx);
  await openDetails(page);
  const builder = page.getByText(/writes all the code/).first();
  const shown = await builder.waitFor({ state: "visible", timeout: 15_000 }).then(() => true).catch(() => false);
  return { ok: shown, builderLine: shown ? await builder.textContent() : null, screenshot: await shot(page, ctx, "project-tab") };
}

async function visible(page: Page, text: string, timeout = 15_000) {
  return page
    .getByText(text, { exact: true })
    .first()
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
}

async function driveLanguage(page: Page, ctx: DriveContext): Promise<Result> {
  await page.goto(`${ctx.base}/new`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("group", { name: t.lang.label }).getByRole("button", { name: "DE" }).click();
  const german = (await visible(page, DICTIONARIES.de.newProject.title)) && (await visible(page, DICTIONARIES.de.newProject.nameLabel));
  const evidence = await shot(page, ctx, "german");
  await page.getByRole("group", { name: DICTIONARIES.de.lang.label }).getByRole("button", { name: "EN" }).click();
  const english = (await visible(page, t.newProject.title)) && (await visible(page, t.newProject.nameLabel));
  return { ok: german && english, german, english, screenshot: evidence };
}

async function driveDeleteProject(page: Page, ctx: DriveContext): Promise<Result> {
  const before = await api<{ project: { name: string } }>(ctx.base, `/api/projects/${ctx.project}`);
  if (before.status !== 200 || !before.body) return { ok: false, error: `Project ${ctx.project} not found.` };
  await openProject(page, ctx);
  await openDetails(page);
  await page.getByRole("button", { name: t.details.delete }).last().click();
  await page.getByLabel(t.details.deleteConfirmLabel(before.body.project.name)).fill(before.body.project.name);
  const evidence = await shot(page, ctx, "delete-confirm");
  await page.getByRole("button", { name: t.details.deleteConfirm }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 120_000 });
  const after = await api(ctx.base, `/api/projects/${ctx.project}`);
  return { ok: after.status === 404, projectGone: after.status === 404, screenshot: evidence };
}

async function waitBuild(base: string, project: string, timeoutMs: number) {
  const stages: string[] = [];
  let last = "";
  let status = "";
  const done = await waitFor(
    async () => {
      const { body } = await api<{ build: { status: string; phase: string | null; taskIndex: number; activity: { kind: string } | null } | null }>(base, `/api/projects/${project}/activity`);
      const b = body?.build;
      status = b?.status ?? "none";
      const line = b ? `${b.status}/${b.phase ?? "-"}/task ${b.taskIndex + 1}/${b.activity?.kind ?? "-"}` : "no build";
      if (line !== last) {
        stages.push(`${new Date().toISOString().slice(11, 19)} ${line}`);
        last = line;
      }
      return ["done", "failed", "cancelled", "none"].includes(status);
    },
    timeoutMs,
    3000,
  );
  out({ ok: done && status === "done", status, stages });
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      profile: { type: "string", default: "local" },
      port: { type: "string", default: "3400" },
      url: { type: "string" },
      project: { type: "string" },
      message: { type: "string" },
      name: { type: "string" },
      vision: { type: "string" },
      timeout: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  const [command, feature] = positionals;
  if (!command || values.help) {
    process.stdout.write(HELP + "\n");
    return;
  }
  const base = values.url ?? readInstance()?.url;
  switch (command) {
    case "launch":
      return launch(values.profile === "full" ? "full" : "local", Number(values.port));
    case "doctor":
      return doctor(values.url);
    case "cleanup":
      return cleanup();
    case "features":
      return out({ ok: true, features: Object.keys(FEATURES) });
    case "wait-run": {
      if (!base || !values.project) out({ ok: false, error: "wait-run needs a running instance (or --url) and --project." });
      await signIn(base);
      const ctx: DriveContext = { base, project: values.project, evidence: EVIDENCE };
      const settled = await waitRun(ctx, Number(values.timeout ?? 300) * 1000);
      return out({ ok: settled, ...summarize(await projectState(ctx)) });
    }
    case "wait-build":
      if (!base || !values.project) out({ ok: false, error: "wait-build needs a running instance (or --url) and --project." });
      await signIn(base);
      return waitBuild(base, values.project, Number(values.timeout ?? 1800) * 1000);
    case "drive": {
      const spec = feature ? FEATURES[feature] : undefined;
      if (!spec) out({ ok: false, error: `Unknown feature "${feature}".`, features: Object.keys(FEATURES) });
      if (!base) out({ ok: false, error: "No instance. Run `pnpm verify launch` or pass --url." });
      if (spec.needs === "project" && !values.project) out({ ok: false, error: `${feature} needs --project <id>.` });
      const evidence = path.join(EVIDENCE, `${new Date().toISOString().replace(/[:.]/g, "-")}-${feature}`);
      fs.mkdirSync(evidence, { recursive: true });
      const ctx: DriveContext = { base, project: values.project, message: values.message, name: values.name, vision: values.vision, evidence };
      await signIn(base);
      const result = await withPage(async (page) => {
        const [name, value] = sessionCookie.split("=");
        await page.context().addCookies([
          { name: "nn_locale", value: "en", url: base },
          ...(name && value ? [{ name, value, url: base }] : []),
        ]);
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        const r = await spec.run(page, ctx);
        return { ...r, pageErrors: errors };
      });
      fs.writeFileSync(path.join(evidence, "result.json"), JSON.stringify(result, null, 2));
      return out({ ...result, feature, evidence: path.relative(ROOT, evidence) });
    }
    default:
      out({ ok: false, error: `Unknown command "${command}".`, help: HELP });
  }
}

main().catch((err) => out({ ok: false, error: err instanceof Error ? err.message : String(err) }));
