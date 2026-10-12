import "server-only";
import { createHmac } from "node:crypto";
import type { ModelMessage } from "ai";
import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { AGENT_BY_ID, builderAgentFor, resolveAgents } from "@/lib/agents";
import { builderModelId } from "@/lib/ai";
import { getDecisions, getMessages, toMessageDTO } from "@/lib/data";
import { db, schema } from "@/lib/db";
import type { BuildRow, ProjectRow } from "@/lib/db/schema";
import { formatTranscript } from "@/lib/engine/prompts";
import type { BuildActivity, BuildDTO, BuildEventDTO, BuildEventKind, BuildNoteData, BuildStatus, BuildTask } from "@/lib/types";
import { recordUsage, roundTokenBudget } from "@/lib/usage";
import { type BuildContext, type BuilderReport, runBuilder } from "./agent";
import { clearBlobs, loadBlob, saveBlobs } from "./blobs";
import { designName } from "@/lib/design/catalog";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { specComplete, specText } from "@/lib/spec/templates";
import { AGENT_AUTHOR, ensureInfra, neonOf, prepareApp, vercelOf } from "./infra";
import { humanLanguage } from "./language";
import { applySchema } from "./neon";
import { planRound } from "./planner";
import { commitChanges, type FileMap, readRepo } from "./repo";
import { deployStage } from "./deploy-stage";
import { buildErrors, deploy, getDeployment, latestLogLines, productionUrl, promote } from "./vercel";
import { advanceArt, artConfigured, type ArtState } from "./art-step";
import { readMarker } from "./frameworks";
import { type Capture, polishLog, verdictLog } from "./review";
import { capture, judge, verificationConfigured } from "./verify";

const ACTIVE: BuildStatus[] = ["queued", "setup", "art", "planning", "building"];
const LEASE_MS = 310_000;
const AGENT_SOFT_MS = 185_000;
const AGENT_HARD_MS = 262_000;
const MAX_AGENT_TURNS = 3;
const DEPLOY_POLL_MS = 200_000;
const MAX_FIXES = 2;
const MAX_STEP_ERRORS = 3;
const DONE: BuildStatus[] = ["done", "failed", "cancelled"];

type TaskInProgress = { history: ModelMessage[]; files: FileMap };

const SPEC_LABELS = Object.fromEntries(Object.entries(DICTIONARIES.en.spec.items).map(([k, v]) => [k, v.label]));

export function internalSecret() {
  const base = process.env.APP_PASSWORD || process.env.AZURE_API_KEY || "neuroneus-dev";
  return createHmac("sha256", base).update("neuroneus-internal-v1").digest("hex");
}

export function selfOrigin(request: Request) {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return prod ? `https://${prod}` : new URL(request.url).origin;
}

export async function startBuild(projectId: string, kind: "setup" | "build", origin: string) {
  if (kind === "build") {
    const [p] = await db.select({ spec: schema.projects.spec }).from(schema.projects).where(eq(schema.projects.id, projectId));
    if (!specComplete(p?.spec ?? null)) return null;
  }
  const active = await activeBuild(projectId);
  if (active) {
    if (kind === "build") {
      await db.update(schema.projects).set({ buildRequested: true }).where(eq(schema.projects.id, projectId));
    }
    return null;
  }
  const [{ max }] = await db
    .select({ max: sql<number | null>`max(${schema.builds.round})` })
    .from(schema.builds)
    .where(eq(schema.builds.projectId, projectId));
  const round = kind === "setup" ? 0 : Math.max(1, (max ?? 0) + 1);
  const [build] = await db
    .insert(schema.builds)
    .values({ projectId, round, kind, origin, phaseStartedAt: new Date() })
    .returning();
  await db.update(schema.projects).set({ buildRequested: false }).where(eq(schema.projects.id, projectId));
  await kick(build.id, origin);
  return build;
}

export async function cancelBuild(projectId: string) {
  const cancelled = await db
    .update(schema.builds)
    .set({ status: "cancelled", activity: null, finishedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.builds.projectId, projectId), inArray(schema.builds.status, ACTIVE)))
    .returning({ id: schema.builds.id });
  await db.update(schema.projects).set({ buildRequested: false }).where(eq(schema.projects.id, projectId));
  await clearBlobs(cancelled.map((b) => b.id));
}

const LIGHT = {
  id: schema.builds.id,
  round: schema.builds.round,
  kind: schema.builds.kind,
  status: schema.builds.status,
  phase: schema.builds.phase,
  taskIndex: schema.builds.taskIndex,
  tasks: schema.builds.tasks,
  error: schema.builds.error,
  activity: schema.builds.activity,
  phaseStartedAt: schema.builds.phaseStartedAt,
  tokens: schema.builds.tokens,
  leaseUntil: schema.builds.leaseUntil,
  origin: schema.builds.origin,
  createdAt: schema.builds.createdAt,
  updatedAt: schema.builds.updatedAt,
};
type LightBuild = { [K in keyof typeof LIGHT]: BuildRow[K] };

export async function activeBuild(projectId: string): Promise<LightBuild | null> {
  const [row] = await db
    .select(LIGHT)
    .from(schema.builds)
    .where(and(eq(schema.builds.projectId, projectId), inArray(schema.builds.status, ACTIVE)))
    .orderBy(desc(schema.builds.createdAt))
    .limit(1);
  return row ?? null;
}

export async function latestBuild(projectId: string): Promise<BuildDTO | null> {
  const row = await latestBuildRow(projectId);
  return row ? toBuildDTO(row) : null;
}

async function latestBuildRow(projectId: string): Promise<LightBuild | null> {
  const [row] = await db
    .select(LIGHT)
    .from(schema.builds)
    .where(eq(schema.builds.projectId, projectId))
    .orderBy(desc(schema.builds.createdAt))
    .limit(1);
  return row ?? null;
}

export async function watchBuild(projectId: string, origin: string): Promise<BuildDTO | null> {
  const row = await latestBuildRow(projectId);
  if (row && ACTIVE.includes(row.status)) await resume(row, origin).catch((err) => console.error("[build] resume failed", err));
  return row ? toBuildDTO(row) : null;
}

export function toBuildDTO(b: LightBuild): BuildDTO {
  return {
    id: b.id,
    round: b.round,
    kind: b.kind,
    status: b.status,
    phase: b.phase ?? null,
    taskIndex: b.taskIndex,
    tasks: b.tasks.map((t) => ({ id: t.id, title: t.title, agentId: t.agentId, status: t.status, summary: t.summary, verification: t.verification })),
    error: b.error,
    activity: ACTIVE.includes(b.status) ? (b.activity ?? null) : null,
    phaseStartedAt: b.phaseStartedAt?.toISOString() ?? null,
    tokens: b.tokens,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

export async function buildEvents(buildId: string, after = 0, limit = 40): Promise<BuildEventDTO[]> {
  const rows = after
    ? await db
        .select()
        .from(schema.buildEvents)
        .where(and(eq(schema.buildEvents.buildId, buildId), gt(schema.buildEvents.id, after)))
        .orderBy(asc(schema.buildEvents.id))
        .limit(limit)
    : (
        await db
          .select()
          .from(schema.buildEvents)
          .where(eq(schema.buildEvents.buildId, buildId))
          .orderBy(desc(schema.buildEvents.id))
          .limit(limit)
      ).reverse();
  return rows.map((e) => ({
    id: e.id,
    taskIndex: e.taskIndex,
    agentId: e.agentId,
    kind: e.kind,
    path: e.path,
    detail: e.detail,
    createdAt: e.createdAt.toISOString(),
  }));
}

async function resume(b: LightBuild, origin: string) {
  const idle = !b.leaseUntil || b.leaseUntil.getTime() < Date.now();
  if (idle && Date.now() - b.updatedAt.getTime() > 25_000) {
    await db.update(schema.builds).set({ updatedAt: new Date() }).where(eq(schema.builds.id, b.id));
    await kick(b.id, b.origin || origin);
  }
}

export async function runStep(buildId: string) {
  const build = await acquireLease(buildId);
  if (!build) return;

  let more = false;
  try {
    more = await advance(build);
    await patch(build.id, { stepErrors: 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[build] step failed (${build.status}/${build.phase ?? "-"})`, err);
    const errors = build.stepErrors + 1;
    if (errors >= MAX_STEP_ERRORS) {
      await failBuild(build, message);
    } else {
      await patch(build.id, { stepErrors: errors });
      more = true;
    }
  } finally {
    await db.update(schema.builds).set({ leaseUntil: null }).where(eq(schema.builds.id, build.id));
  }

  const origin = build.origin ?? "";
  if (more) {
    await kick(build.id, origin);
  } else {
    const [after] = await db.select({ status: schema.builds.status }).from(schema.builds).where(eq(schema.builds.id, build.id));
    if (!after || DONE.includes(after.status)) await clearBlobs(build.id);
    const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, build.projectId));
    if (project?.buildRequested) await startBuild(project.id, "build", origin);
  }
}

async function advance(build: BuildRow): Promise<boolean> {
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, build.projectId));
  if (!project) return false;

  switch (build.status) {
    case "queued":
      await transition(build.id, { status: "setup" });
      return true;

    case "setup": {
      const onStage = (stage: string) => setActivity(build.id, { kind: "setup", stage });
      try {
        if (build.kind === "setup") {
          const p = await ensureInfra(project, onStage);
          const files = await readRepo(p.repoFullName!);
          await saveBlobs(build.id, { files, good: files });
          await transition(build.id, { status: "building", phase: "deploy", tasks: [] });
        } else {
          const { language } = await buildContext(project);
          const prepared = await prepareApp(project, { projectId: project.id, buildId: build.id }, language, onStage);
          await saveBlobs(build.id, { files: prepared.files, good: prepared.files });
          const needsArt = (prepared.framework === "game2d" || prepared.framework === "game3d") && !prepared.project.art && artConfigured();
          if (needsArt) await saveBlobs(build.id, { art: { stage: "plan" } satisfies ArtState });
          await transition(build.id, { status: needsArt ? "art" : "planning" });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db.update(schema.projects).set({ infraError: message.slice(0, 500) }).where(eq(schema.projects.id, project.id));
        throw err;
      }
      return true;
    }

    case "art":
      return artStep(build, project);

    case "planning": {
      await setActivity(build.id, { kind: "planning" });
      const ctx = await buildContext(project);
      const transcript = formatTranscript(await getMessages(project.id, 40), 10_000);
      const planned = await planRound({
        scope: { projectId: project.id, buildId: build.id },
        ctx,
        builder: builderAgentFor(resolveAgents(project.agentIds)),
        files: (await loadBlob<FileMap>(build.id, "files")) ?? {},
        transcript,
        round: build.round,
      });
      if (planned.length === 0) {
        await transition(build.id, { status: "done", finishedAt: new Date() });
        return false;
      }
      const tasks: BuildTask[] = planned.map((t, i) => ({ id: `t${i + 1}`, ...t, status: "pending" }));
      await transition(build.id, { status: "building", phase: "implement", taskIndex: 0, tasks });
      await logEvent(build.id, { kind: "planned", detail: String(tasks.length) });
      await note(project.id, `Building round ${build.round}: ${tasks.map((t) => t.title).join(", ")}`, {
        type: "build_started",
        round: build.round,
        steps: tasks.map((t) => t.title),
      });
      return true;
    }

    case "building":
      if (build.phase === "deploy") return deployStep(build, project);
      if (build.phase === "verify") return verifyStep(build, project);
      return implementStep(build, project);

    default:
      return false;
  }
}

async function implementStep(build: BuildRow, project: ProjectRow): Promise<boolean> {
  const task = build.tasks[build.taskIndex];
  if (!task) {
    await finishRound(build, project);
    return false;
  }
  if (build.phase === "implement" && build.agentTurns === 0 && build.tokens >= roundTokenBudget()) {
    const tasks = build.tasks.map((t, i) => (i >= build.taskIndex && t.status === "pending" ? { ...t, status: "skipped" as const } : t));
    await patch(build.id, { tasks, phase: null });
    await finishRound({ ...build, tasks }, project, { budget: true });
    return false;
  }
  const agent = AGENT_BY_ID[task.agentId] ?? builderAgentFor(resolveAgents(project.agentIds));
  const tasks = withTask(build.tasks, build.taskIndex, { status: "working" });
  await patch(build.id, { tasks });

  const committed = (await loadBlob<FileMap>(build.id, "files")) ?? {};
  const inProgress = build.agentTurns > 0 ? await loadBlob<TaskInProgress>(build.id, "task") : null;
  const fixing = build.phase === "fix";
  const model = builderModelId(project.builderModel, { fixing });
  const report = liveReporter(build, agent.id);
  const started = Date.now();

  const result = await runBuilder({
    agent,
    ctx: await buildContext(project),
    task,
    files: inProgress?.files ?? committed,
    fixLog: fixing ? build.lastError : null,
    model,
    history: inProgress?.history ?? null,
    softDeadline: started + AGENT_SOFT_MS,
    hardDeadline: started + AGENT_HARD_MS,
    cacheKey: `build-${build.id}`,
    report,
  });
  await report.done();
  await recordUsage({ projectId: project.id, buildId: build.id }, "build", model, result.usage);

  if (!result.finished && build.agentTurns + 1 < MAX_AGENT_TURNS) {
    await saveBlobs(build.id, { task: { history: result.history, files: result.files } satisfies TaskInProgress });
    await patch(build.id, { agentTurns: build.agentTurns + 1 });
    await logEvent(build.id, { kind: "continued", agentId: agent.id, taskIndex: build.taskIndex });
    return true;
  }

  await commitChanges(
    project.repoFullName!,
    committed,
    result.files,
    fixing ? `Fix build: ${task.title}` : task.title,
    AGENT_AUTHOR(agent.name),
  );
  await saveBlobs(build.id, { files: result.files, task: null });
  await transition(build.id, {
    phase: "deploy",
    deploymentId: null,
    agentTurns: 0,
    tasks: withTask(tasks, build.taskIndex, result.summary ? { summary: result.summary } : {}),
  });
  return true;
}

async function deployStep(build: BuildRow, project: ProjectRow): Promise<boolean> {
  const vercel = vercelOf(project);
  const neon = neonOf(project);
  if (!vercel) throw new Error("The app's hosting is missing.");
  const agentId = build.tasks[build.taskIndex]?.agentId;

  let deploymentId = build.deploymentId;
  if (!deploymentId) {
    const files = (await loadBlob<FileMap>(build.id, "files")) ?? {};
    if (neon) {
      await setActivity(build.id, { kind: "schema", agentId });
      try {
        await applySchema(neon, files["db/schema.sql"] ?? "");
      } catch (err) {
        return buildFailed(build, project, `Applying db/schema.sql failed: ${err instanceof Error ? err.message : err}`);
      }
    }
    const d = await deploy(vercel, files, { production: !verifies(build) });
    deploymentId = d.id;
    await patch(build.id, { deploymentId });
    await logEvent(build.id, { kind: "deploy_started", agentId, taskIndex: build.taskIndex });
  }

  const started = Date.now();
  let stage = "";
  let d = await getDeployment(deploymentId);
  while (!["READY", "ERROR", "CANCELED"].includes(d.readyState) && Date.now() - started < DEPLOY_POLL_MS) {
    const next = deployStage(d.readyState, await latestLogLines(deploymentId).catch(() => []));
    if (next !== stage) {
      stage = next;
      await setActivity(build.id, { kind: "deploying", stage, agentId });
    }
    await new Promise((r) => setTimeout(r, 3000));
    d = await getDeployment(deploymentId);
  }
  if (d.readyState === "READY") {
    await logEvent(build.id, { kind: "deploy_ready", agentId, taskIndex: build.taskIndex });
    if (verifies(build)) {
      await transition(build.id, { phase: "verify" });
      return true;
    }
    return deployed(build, project);
  }
  if (d.readyState === "ERROR" || d.readyState === "CANCELED") {
    const log = (await buildErrors(deploymentId)) || d.errorMessage || "The build failed without output.";
    const firstError = log.split("\n").find((line) => line.trim())?.trim().slice(0, 200);
    await logEvent(build.id, { kind: "deploy_failed", agentId, taskIndex: build.taskIndex, detail: firstError });
    return buildFailed(build, project, log);
  }
  return true;
}

function verifies(build: BuildRow) {
  return build.kind === "build" && verificationConfigured();
}

const ART_STAGE: Record<ArtState["stage"], string> = { plan: "plan", picks: "picks", concept: "concept", assets: "assets", install: "install" };

async function artStep(build: BuildRow, project: ProjectRow): Promise<boolean> {
  const state = (await loadBlob<ArtState>(build.id, "art")) ?? { stage: "plan" };
  await setActivity(build.id, { kind: "art", stage: ART_STAGE[state.stage] });
  const ctx = await buildContext(project);
  const files = (await loadBlob<FileMap>(build.id, "files")) ?? {};
  const framework = readMarker(files).framework;
  const result = await advanceArt({
    state,
    scope: { projectId: project.id, buildId: build.id },
    project,
    spec: ctx.spec,
    language: ctx.language,
    dimension: framework === "game3d" ? "3d" : "2d",
    files,
  });
  if (!result.done) {
    await saveBlobs(build.id, { art: result.state });
    await patch(build.id, {});
    return true;
  }
  const artist = resolveAgents(project.agentIds).find((a) => a.id === "iris")?.name ?? "Neuroneus";
  await commitChanges(project.repoFullName!, files, result.files, `Add the art: ${result.styleName}`, AGENT_AUTHOR(artist), result.binaries);
  await db.update(schema.projects).set({ art: result.art, updatedAt: new Date() }).where(eq(schema.projects.id, project.id));
  await saveBlobs(build.id, { files: result.files, good: result.files, art: null });
  await logEvent(build.id, { kind: "art_ready", detail: result.styleName });
  await note(project.id, `Art direction: ${result.styleName}.`, { type: "art_ready", style: result.styleName, conceptUrl: result.art.conceptUrl });
  await transition(build.id, { status: "planning" });
  return true;
}

type VerifyState = { capture: Capture };

async function verifyStep(build: BuildRow, project: ProjectRow): Promise<boolean> {
  const task = build.tasks[build.taskIndex];
  const vercel = vercelOf(project);
  if (!task || !vercel || !build.deploymentId) return deployed(build, project);
  const agentId = task.agentId;
  const files = (await loadBlob<FileMap>(build.id, "files")) ?? {};
  const framework = readMarker(files).framework;
  const game = project.spec?.kind === "web_game";
  const state = await loadBlob<VerifyState>(build.id, "verify");

  if (!state) {
    const d = await getDeployment(build.deploymentId);
    try {
      const result = await capture({
        url: `https://${d.url}`,
        game,
        evidencePrefix: `${project.id}/${build.id}/${task.id}-${build.fixAttempts}`,
        onStage: (stage) => setActivity(build.id, { kind: "verifying", stage, agentId }),
      });
      await saveBlobs(build.id, { verify: { capture: result } satisfies VerifyState });
      await patch(build.id, {});
      return true;
    } catch (err) {
      console.error("[build] verification capture failed, shipping unverified", err);
      return ship(build, project, vercel.id, null);
    }
  }

  await setActivity(build.id, { kind: "judging", agentId });
  const ctx = await buildContext(project);
  const verdict = await judge({
    scope: { projectId: project.id, buildId: build.id },
    task,
    spec: ctx.spec,
    capture: state.capture,
    conceptUrl: game ? (project.art?.conceptUrl ?? null) : null,
    artDirection: game ? (files["docs/ART-DIRECTION.md"]?.split("## Assets")[0] ?? null) : null,
  }).catch((err) => {
    console.error("[build] judging failed, shipping unverified", err);
    return null;
  });
  await saveBlobs(build.id, { verify: null });
  if (!verdict) return ship(build, project, vercel.id, null);

  const verification = {
    ...verdict,
    screenshots: state.capture.shots.map((s) => s.url),
    url: state.capture.url,
    checkedAt: new Date().toISOString(),
  };
  const tasks = withTask(build.tasks, build.taskIndex, { verification });
  await patch(build.id, { tasks });
  const current = { ...build, tasks };

  if (!verdict.works) {
    await logEvent(build.id, { kind: "verify_failed", agentId, taskIndex: build.taskIndex, detail: verdict.problems[0]?.slice(0, 200) });
    return buildFailed(current, project, verdictLog(verdict, state.capture));
  }
  const polish = game && framework && (verdict.visualScore ?? 10) < 6 && !task.polished && build.fixAttempts < MAX_FIXES;
  if (polish) {
    await logEvent(build.id, { kind: "verify_failed", agentId, taskIndex: build.taskIndex, detail: verdict.notes[0]?.slice(0, 200) });
    await transition(build.id, {
      tasks: withTask(tasks, build.taskIndex, { polished: true }),
      phase: "fix",
      fixAttempts: build.fixAttempts + 1,
      lastError: polishLog(verdict),
      deploymentId: null,
    });
    return true;
  }
  await logEvent(build.id, { kind: "verified", agentId, taskIndex: build.taskIndex });
  return ship(current, project, vercel.id, build.deploymentId);
}

async function ship(build: BuildRow, project: ProjectRow, vercelProjectId: string, deploymentId: string | null): Promise<boolean> {
  const agentId = build.tasks[build.taskIndex]?.agentId;
  await setActivity(build.id, { kind: "shipping", agentId });
  await promote(vercelProjectId, deploymentId ?? build.deploymentId!);
  await logEvent(build.id, { kind: "shipped", agentId, taskIndex: build.taskIndex });
  return deployed(build, project);
}

async function deployed(build: BuildRow, project: ProjectRow): Promise<boolean> {
  if (!project.appUrl && project.vercelProjectId) {
    const url = await productionUrl(project.vercelProjectId);
    await db.update(schema.projects).set({ appUrl: url }).where(eq(schema.projects.id, project.id));
  }
  if (build.kind === "setup") {
    await transition(build.id, { status: "done", phase: null, finishedAt: new Date() });
    return false;
  }
  const files = await loadBlob<FileMap>(build.id, "files");
  if (files) await saveBlobs(build.id, { good: files });

  const task = build.tasks[build.taskIndex];
  const tasks = withTask(build.tasks, build.taskIndex, { status: "done" });
  if (task) {
    await message(project.id, task.agentId, task.summary || task.title);
  }
  const next = build.taskIndex + 1;
  if (next < tasks.length) {
    await transition(build.id, {
      tasks,
      taskIndex: next,
      phase: "implement",
      fixAttempts: 0,
      lastError: null,
      deploymentId: null,
    });
    return true;
  }
  await patch(build.id, { tasks, phase: null, deploymentId: null });
  await finishRound({ ...build, tasks }, project);
  return false;
}

async function buildFailed(build: BuildRow, project: ProjectRow, log: string): Promise<boolean> {
  if (build.kind === "setup") {
    await failBuild(build, `The starter app failed to deploy:\n${log.slice(0, 600)}`);
    return false;
  }
  if (build.fixAttempts < MAX_FIXES) {
    await transition(build.id, { phase: "fix", fixAttempts: build.fixAttempts + 1, lastError: log, deploymentId: null });
    return true;
  }

  const task = build.tasks[build.taskIndex];
  const [current, good] = await Promise.all([loadBlob<FileMap>(build.id, "files"), loadBlob<FileMap>(build.id, "good")]);
  if (!current || !good) throw new Error("The build lost its source snapshot; can't roll back.");
  await commitChanges(
    project.repoFullName!,
    current,
    good,
    `Roll back: ${task?.title ?? "task"}`,
    AGENT_AUTHOR("Neuroneus"),
  );
  await saveBlobs(build.id, { files: good });
  await logEvent(build.id, { kind: "rolled_back", agentId: task?.agentId, taskIndex: build.taskIndex });
  const tasks = withTask(build.tasks, build.taskIndex, { status: "failed" });
  if (task) {
    await note(project.id, `Rolled back "${task.title}": it didn't build.`, {
      type: "task_rolled_back",
      round: build.round,
      title: task.title,
    });
  }
  const next = build.taskIndex + 1;
  if (next < tasks.length) {
    await transition(build.id, {
      tasks,
      taskIndex: next,
      phase: "implement",
      fixAttempts: 0,
      lastError: null,
      deploymentId: null,
    });
    return true;
  }
  await patch(build.id, { tasks, phase: null, deploymentId: null });
  await finishRound({ ...build, tasks }, project);
  return false;
}

async function finishRound(build: BuildRow, project: ProjectRow, opts: { budget?: boolean } = {}) {
  await transition(build.id, { status: "done", finishedAt: new Date() });
  if (build.kind === "setup") return;
  const done = build.tasks.filter((t) => t.status === "done").length;
  const [fresh] = await db.select({ appUrl: schema.projects.appUrl }).from(schema.projects).where(eq(schema.projects.id, project.id));
  await note(
    project.id,
    `Round ${build.round} shipped: ${done} of ${build.tasks.length} steps live.${opts.budget ? " Stopped early: the round's token budget is used up." : ""}`,
    {
      type: "build_done",
      round: build.round,
      done,
      total: build.tasks.length,
      url: fresh?.appUrl ?? null,
      ...(opts.budget ? { budget: true } : {}),
    },
  );
}

async function failBuild(build: BuildRow, reason: string) {
  await transition(build.id, { status: "failed", error: reason.slice(0, 2000), finishedAt: new Date() });
  await note(build.projectId, `Build round ${build.round} stopped: ${reason.slice(0, 300)}`, {
    type: "build_failed",
    round: build.round,
    reason: reason.slice(0, 300),
  });
}

function liveReporter(build: BuildRow, agentId: string): BuilderReport & { done: () => Promise<void> } {
  let chain: Promise<unknown> = Promise.resolve();
  let current: BuildActivity | null = null;
  let pending: BuildActivity | null = null;
  let lastWrite = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    if (!pending) return;
    const a = pending;
    pending = null;
    lastWrite = Date.now();
    chain = chain.then(() => setActivity(build.id, a)).catch(() => {});
  };

  return {
    activity(a) {
      const same = current && current.kind === a.kind && (current.path ?? "") === (a.path ?? "");
      current = { ...a, agentId, since: same && current ? current.since : new Date().toISOString() };
      pending = current;
      const wait = 1000 - (Date.now() - lastWrite);
      if (wait <= 0) flush();
      else timer ??= setTimeout(flush, wait);
    },
    event(e) {
      chain = chain.then(() => logEvent(build.id, { ...e, agentId, taskIndex: build.taskIndex })).catch(() => {});
    },
    async done() {
      if (timer) clearTimeout(timer);
      flush();
      await chain;
    },
  };
}

async function setActivity(buildId: string, a: Omit<BuildActivity, "since"> & { since?: string }) {
  await db
    .update(schema.builds)
    .set({ activity: { ...a, since: a.since ?? new Date().toISOString() } })
    .where(eq(schema.builds.id, buildId));
}

async function logEvent(
  buildId: string,
  e: { kind: BuildEventKind; agentId?: string; taskIndex?: number; path?: string; detail?: string },
) {
  await db.insert(schema.buildEvents).values({
    buildId,
    kind: e.kind,
    agentId: e.agentId ?? null,
    taskIndex: e.taskIndex ?? null,
    path: e.path ?? null,
    detail: e.detail ?? null,
  });
}

async function buildContext(project: ProjectRow): Promise<BuildContext> {
  const [decisions, done, recent] = await Promise.all([
    getDecisions(project.id),
    db.select({ tasks: schema.builds.tasks }).from(schema.builds).where(eq(schema.builds.projectId, project.id)),
    getMessages(project.id, 30),
  ]);
  const shipped = done.flatMap((b) => b.tasks.filter((t) => t.status === "done").map((t) => t.summary || t.title));
  const human = recent
    .filter((m) => m.authorType === "user" && m.kind === "chat")
    .map((m) => m.content)
    .reverse();
  return {
    name: project.name,
    vision: project.vision,
    kind: project.spec?.kind ?? "web_app",
    spec: project.spec ? specText(project.spec, SPEC_LABELS) : "",
    designName: project.designSlug ? designName(project.designSlug) : null,
    database: Boolean(project.neonProjectId),
    decisions: decisions.map((d) => ({ header: d.header, choice: d.choice })),
    shipped,
    language: humanLanguage([...human, project.vision]),
  };
}

function withTask(tasks: BuildTask[], index: number, change: Partial<BuildTask>) {
  return tasks.map((t, i) => (i === index ? { ...t, ...change } : t));
}

async function patch(id: string, values: Partial<typeof schema.builds.$inferInsert>) {
  await db
    .update(schema.builds)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(schema.builds.id, id));
}

async function transition(id: string, values: Partial<typeof schema.builds.$inferInsert>) {
  await patch(id, { ...values, phaseStartedAt: new Date(), activity: null });
}

async function acquireLease(buildId: string) {
  const [row] = await db
    .update(schema.builds)
    .set({ leaseUntil: new Date(Date.now() + LEASE_MS), updatedAt: new Date() })
    .where(
      and(
        eq(schema.builds.id, buildId),
        inArray(schema.builds.status, ACTIVE),
        or(isNull(schema.builds.leaseUntil), lt(schema.builds.leaseUntil, new Date())),
      ),
    )
    .returning();
  return row ?? null;
}

async function kick(buildId: string, origin: string) {
  try {
    const res = await fetch(`${origin}/api/internal/build-step`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-neuroneus-internal": internalSecret() },
      body: JSON.stringify({ buildId }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) console.error(`[build] kick returned ${res.status}`);
  } catch (err) {
    console.error("[build] kick failed", err);
  }
}

async function message(projectId: string, agentId: string, content: string) {
  await db.insert(schema.messages).values({ projectId, authorType: "agent", agentId, kind: "chat", content });
}

async function note(projectId: string, content: string, data: BuildNoteData) {
  const [row] = await db
    .insert(schema.messages)
    .values({ projectId, authorType: "moderator", kind: "note", content, data })
    .returning();
  return toMessageDTO(row);
}
