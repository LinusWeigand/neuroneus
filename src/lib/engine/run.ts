import "server-only";
import { randomUUID } from "node:crypto";
import { generateText, NoObjectGeneratedError, Output, smoothStream, streamText } from "ai";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { type AgentDef, resolveAgents } from "@/lib/agents";
import { callSettings, chatModelId, modelFor, structuredModelId } from "@/lib/ai";
import { startBuild } from "@/lib/build/engine";
import { infraConfigured } from "@/lib/build/infra";
import { getDecisions, getMessages, isCancelRequested, toDecisionDTO, toMessageDTO } from "@/lib/data";
import { db, schema } from "@/lib/db";
import type { ProjectRow } from "@/lib/db/schema";
import { designName } from "@/lib/design/catalog";
import { chooseDesign } from "@/lib/design/choose";
import { appendDecisions } from "@/lib/github";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { extractSpec } from "@/lib/spec/extract";
import { EMPTY_SPEC, openSpecPoints, type ProjectSpec, specComplete, specTemplate } from "@/lib/spec/templates";
import { humanLanguage } from "@/lib/build/language";
import { recordUsage, type UsageScope } from "@/lib/usage";
import type {
  DecisionCard,
  MessageDTO,
  RunEvent,
  TurnInput,
} from "@/lib/types";
import {
  agentInstructions,
  agentPrompt,
  formatTranscript,
  type Mode,
  planInstructions,
  planPrompt,
  type ProjectContext,
  specSynthesisInstructions,
  synthesisInstructions,
  synthesisPrompt,
} from "./prompts";
import { kindCard, normalizeCard, sanitizeAnswers, synthesisSchema, type RawCard } from "./card";
import { RunInputError } from "./errors";
import { ackTurn, arrangeTurns, huddleShape, parseMentions, type PlannedTurn, type Turn } from "./huddle";
import { firstJsonObject } from "@/lib/json";

type Emit = (event: RunEvent) => void;

const TIMEOUT_MS = 120_000;
const RUN_BUDGET_MS = 280_000;
const CARD_RESERVE_MS = 150_000;

function timeLimit(deadline: number, reserve = 0, cap = TIMEOUT_MS) {
  return AbortSignal.timeout(Math.max(10_000, Math.min(cap, deadline - reserve - Date.now())));
}

export async function executeRun(args: {
  project: ProjectRow;
  runId: string;
  input: TurnInput;
  emit: Emit;
  origin?: string;
}) {
  const { project, runId, input } = args;
  const deadline = Date.now() + RUN_BUDGET_MS;
  let lastStatus: string | null = null;
  const emit: Emit = (event) => {
    if (event.type === "status") {
      if (event.label === lastStatus) return;
      lastStatus = event.label;
    }
    args.emit(event);
  };
  const team = resolveAgents(project.agentIds);
  if (team.length === 0) throw new RunInputError("noAgents");
  const scope: UsageScope = { projectId: project.id };

  const [history, locked, builtRounds] = await Promise.all([
    getMessages(project.id, 120),
    getDecisions(project.id),
    db.select({ tasks: schema.builds.tasks }).from(schema.builds).where(eq(schema.builds.projectId, project.id)),
  ]);
  let spec: ProjectSpec = project.spec ?? EMPTY_SPEC;
  if (!project.spec) {
    const told = [
      project.vision,
      ...history.filter((m) => m.authorType === "user" && m.kind === "chat").map((m) => m.content),
      ...locked.map((d) => `Decided: ${d.header}: ${d.choice}`),
    ];
    spec = await saveSpec(project.id, EMPTY_SPEC, await extractSpec({ scope, spec, text: told.join("\n\n"), source: "vision" }));
  }
  const wasComplete = specComplete(spec);
  const ctx: ProjectContext = {
    name: project.name,
    vision: project.vision,
    team,
    lockedDecisions: locked.map((d) => ({ header: d.header, choice: d.choice })),
    shipped: builtRounds.flatMap((b) => b.tasks.filter((t) => t.status === "done").map((t) => t.summary || t.title)),
    ...specContext(spec),
    language: humanLanguage(humanTexts(history, project)),
  };

  let mode: Mode;
  let mentioned: AgentDef[] = [];
  let repoLog: Promise<void> | null = null;

  if (input.kind === "message") {
    for (const m of history) {
      if (m.kind === "decision_request" && m.data?.type === "decision_card" && m.data.status === "pending") {
        const data: DecisionCard = { ...m.data, status: "superseded" };
        const updated = await updateMessageData(m.id, data);
        if (updated) {
          Object.assign(m, updated);
          emit({ type: "message", message: updated });
        }
      }
    }
    const userMsg = await insertMessage({
      projectId: project.id,
      authorType: "user",
      kind: "chat",
      content: input.content,
      runId,
    });
    history.push(userMsg);
    emit({ type: "message", message: userMsg });

    emit({ type: "status", label: "reading" });
    spec = await saveSpec(project.id, spec, await extractSpec({
      scope,
      spec,
      text: input.content,
      source: "chat",
      context: formatTranscript(history.slice(-10, -1)),
    }));
    Object.assign(ctx, specContext(spec));

    mentioned = parseMentions(input.content, team);
    if (!wasComplete && specComplete(spec)) {
      mode = "ack";
      ctx.specJustCompleted = true;
    } else {
      mode = mentioned.length > 0 ? "direct" : "open";
    }
  } else {
    const request = history.find((m) => m.id === input.requestMessageId);
    if (!request || request.data?.type !== "decision_card") throw new RunInputError("cardMissing");
    if (request.data.status !== "pending") throw new RunInputError("alreadyDecided");

    const answers = sanitizeAnswers(request.data, input.answers);
    const card: DecisionCard = { ...request.data, status: "answered", answers };

    let kindChanged = false;
    for (const a of answers) {
      if (!a.questionId.startsWith("spec:")) continue;
      const key = a.questionId.slice(5);
      if (key === "kind") {
        const kind = a.value === "web_app" || a.value === "web_game" ? a.value : /game|spiel|play/i.test(a.choice) ? "web_game" : "web_app";
        kindChanged = kind !== spec.kind;
        spec = { ...spec, kind };
      } else {
        const option = request.data.questions.find((q) => q.id === a.questionId)?.options.find((o) => o.label === a.choice);
        const value = option ? `${option.label}: ${option.description}` : a.choice;
        spec = { ...spec, answers: { ...spec.answers, [key]: { value, source: "decision" } } };
      }
    }
    if (kindChanged) {
      const told = [project.vision, ...history.filter((m) => m.authorType === "user" && m.kind === "chat").map((m) => m.content)];
      spec = await extractSpec({ scope, spec, text: told.join("\n\n"), source: "vision" });
    }
    spec = await saveSpec(project.id, project.spec ?? EMPTY_SPEC, spec);
    Object.assign(ctx, specContext(spec));
    const updated = await updateMessageData(request.id, card);
    if (updated) {
      Object.assign(request, updated);
      emit({ type: "message", message: updated });
    }

    await db.insert(schema.decisions).values(
      answers.map((a) => ({
        projectId: project.id,
        requestMessageId: request.id,
        header: a.header,
        question: a.question,
        choice: a.choice,
        isCustom: a.isCustom,
        wasRecommended: a.wasRecommended,
      })),
    );
    ctx.lockedDecisions.push(...answers.map((a) => ({ header: a.header, choice: a.choice })));

    const answerMsg = await insertMessage({
      projectId: project.id,
      authorType: "user",
      kind: "decision_answer",
      content: answers.map((a) => `${a.header}: ${a.choice}`).join("\n"),
      data: { type: "decision_answer", requestMessageId: request.id, answers },
      runId,
    });
    history.push(answerMsg);
    emit({ type: "message", message: answerMsg });
    const all = await db
      .select()
      .from(schema.decisions)
      .where(eq(schema.decisions.projectId, project.id))
      .orderBy(schema.decisions.createdAt);
    emit({ type: "decisions", decisions: all.map(toDecisionDTO) });

    if (project.repoFullName) {
      const repo = project.repoFullName;
      repoLog = appendDecisions(repo, answers)
        .then(async ({ url }) => {
          const note = await insertMessage({
            projectId: project.id,
            authorType: "moderator",
            kind: "note",
            content: `Logged ${answers.length === 1 ? "1 decision" : `${answers.length} decisions`} to [${repo}/docs/DECISIONS.md](${url})`,
            data: { type: "repo_log", count: answers.length, repo, url },
            runId,
          });
          emit({ type: "message", message: note });
        })
        .catch((err) => console.error("[run] failed to log decisions to GitHub", err));
    }
    if (!specComplete(spec)) {
      mode = "spec";
    } else {
      mode = "ack";
      ctx.specJustCompleted = !wasComplete;
      if (wasComplete && args.origin && project.repoFullName && infraConfigured()) {
        await startBuild(project.id, "build", args.origin).catch((err) => console.error("[run] build failed to start", err));
      }
    }
  }

  ctx.language = humanLanguage(humanTexts(history, project));
  const cancelled = await discuss({ ctx, mode, mentioned, history, project, runId, emit, deadline });

  if (!cancelled && mode !== "ack") {
    await synthesize({ ctx, history, project, runId, emit, deadline });
  }
  if (ctx.specJustCompleted) {
    await specCompleted({ project: { ...project, spec }, spec, runId, emit, origin: args.origin });
  }
  emit({ type: "status", label: null });
  if (repoLog) await repoLog;
}

async function discuss(args: {
  ctx: ProjectContext;
  mode: Mode;
  mentioned: AgentDef[];
  history: MessageDTO[];
  project: ProjectRow;
  runId: string;
  emit: Emit;
  deadline: number;
}): Promise<boolean> {
  const { ctx, mode, mentioned, history, project, runId, emit, deadline } = args;
  if (await isCancelRequested(project.id, runId)) return true;

  emit({ type: "status", label: "reading" });
  const turns = await planHuddle({ ctx, mode, mentioned, history, projectId: project.id, deadline });

  let failures = 0;
  for (const turn of turns) {
    if (await isCancelRequested(project.id, runId)) return true;
    if (deadline - CARD_RESERVE_MS - Date.now() < 30_000) break;
    emit({ type: "status", label: null });
    emit({ type: "typing", agentId: turn.agent.id });
    const msg = await speak({ agent: turn.agent, focus: turn.focus, ctx, history, project, runId, emit, deadline });
    if (!msg) {
      if (++failures >= 2) throw new Error("The model failed twice in a row. Check the Azure deployment and quota.");
      continue;
    }
    failures = 0;
    history.push(msg);
  }
  return false;
}

async function planHuddle(args: {
  ctx: ProjectContext;
  mode: Mode;
  mentioned: AgentDef[];
  history: MessageDTO[];
  projectId: string;
  deadline: number;
}): Promise<Turn[]> {
  const { ctx, mode, mentioned } = args;
  const team = ctx.team;
  if (mode === "ack") return [ackTurn(team, Boolean(ctx.specJustCompleted))];

  const shape = huddleShape(mode, team, mentioned);
  let planned: PlannedTurn[] = [];
  const model = structuredModelId();
  const ids = team.map((a) => a.id) as [string, ...string[]];
  const planSchema = z.object({ turns: z.array(z.object({ agentId: z.enum(ids), focus: z.string() })) });
  try {
    const { output, usage } = await generateText({
      model: modelFor(model),
      instructions: planInstructions(ctx, mode, mentioned, shape.maxTurns),
      prompt: planPrompt(formatTranscript(args.history)),
      output: Output.object({ schema: planSchema }),
      ...callSettings(model, 600),
      maxRetries: 1,
      abortSignal: timeLimit(args.deadline, CARD_RESERVE_MS),
    });
    await recordUsage({ projectId: args.projectId }, "huddle_plan", model, usage);
    planned = output.turns;
  } catch (err) {
    const recovered = NoObjectGeneratedError.isInstance(err) ? firstJsonObject(err.text, planSchema) : null;
    if (recovered) planned = recovered.turns;
    else console.warn("[run] huddle plan failed, using roster order:", err instanceof Error ? err.message : err);
  }
  return arrangeTurns({ mode, team, mentioned, planned, shape });
}

async function speak(args: {
  agent: AgentDef;
  focus: string;
  ctx: ProjectContext;
  history: MessageDTO[];
  project: ProjectRow;
  runId: string;
  emit: Emit;
  deadline: number;
}): Promise<MessageDTO | null> {
  const { agent, focus, ctx, history, project, runId, emit, deadline } = args;
  const id = randomUUID();
  const createdAt = new Date();
  emit({ type: "start", id, agentId: agent.id, createdAt: createdAt.toISOString() });

  let text = "";
  let pending = "";
  let prefixChecked = false;
  const model = chatModelId();
  try {
    const result = streamText({
      model: modelFor(model),
      instructions: agentInstructions(agent, ctx),
      prompt: agentPrompt(agent, ctx, formatTranscript(history), focus),
      ...callSettings(model, 300),
      maxRetries: 1,
      abortSignal: timeLimit(deadline, CARD_RESERVE_MS),
      experimental_transform: smoothStream({ delayInMs: 14, chunking: "word" }),
    });
    for await (const chunk of result.textStream) {
      const delta = chunk.replace(/`/g, "");
      if (!prefixChecked) {
        pending += delta;
        if (pending.length < agent.name.length + 6 && !pending.includes("\n")) continue;
        pending = stripNamePrefix(pending, agent).replace(/^\s+/, "");
        prefixChecked = true;
        if (pending) {
          text += pending;
          emit({ type: "delta", id, text: pending });
        }
        continue;
      }
      text += delta;
      emit({ type: "delta", id, text: delta });
    }
    if (!prefixChecked && pending) {
      const rest = stripNamePrefix(pending, agent).replace(/^\s+/, "");
      text += rest;
      if (rest) emit({ type: "delta", id, text: rest });
    }
    await recordUsage({ projectId: project.id }, "chat", model, await result.usage);
  } catch (err) {
    console.error(`[run] ${agent.name} failed to speak`, err);
    if (!text.trim()) {
      emit({ type: "discard", id });
      return null;
    }
    text = text.trimEnd() + "…";
  }

  text = text.trim();
  if (!text) {
    emit({ type: "discard", id });
    return null;
  }
  const msg = await insertMessage({
    id,
    projectId: project.id,
    authorType: "agent",
    agentId: agent.id,
    kind: "chat",
    content: text,
    runId,
    createdAt,
  });
  emit({ type: "end", message: msg });
  return msg;
}

function stripNamePrefix(text: string, agent: AgentDef) {
  const name = agent.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`^\\s*\\**${name}\\**(\\s*\\([^)]*\\))?\\s*:\\s*`, "i"), "");
}

async function synthesize(args: {
  ctx: ProjectContext;
  history: MessageDTO[];
  project: ProjectRow;
  runId: string;
  emit: Emit;
  deadline: number;
}) {
  const { ctx, history, project, runId, emit, deadline } = args;
  if (await isCancelRequested(project.id, runId)) return;
  emit({ type: "status", label: "preparing" });

  const points = ctx.specOpen.slice(0, 3);
  if (points[0]?.key === "kind") {
    await postCard(kindCard(ctx.language), project.id, runId, emit);
    emit({ type: "status", label: null });
    return;
  }

  let raw: RawCard;
  const model = structuredModelId();
  try {
    const { output, usage } = await generateText({
      model: modelFor(model),
      instructions: points.length ? specSynthesisInstructions(ctx, points) : synthesisInstructions(ctx),
      prompt: synthesisPrompt(ctx, formatTranscript(history)),
      output: Output.object({ schema: synthesisSchema }),
      ...callSettings(model, 3000),
      maxRetries: 1,
      abortSignal: timeLimit(deadline, 0, Infinity),
    });
    raw = output;
    await recordUsage({ projectId: project.id }, "card", model, usage);
  } catch (err) {
    console.error("[run] decision synthesis failed", err);
    emit({ type: "status", label: null });
    return;
  }

  const card = normalizeCard(raw, ctx.team, points.length ? points.map((p) => `spec:${p.key}`) : undefined);
  emit({ type: "status", label: null });
  if (card) await postCard(card, project.id, runId, emit);
}

async function postCard(card: DecisionCard, projectId: string, runId: string, emit: Emit) {
  const msg = await insertMessage({
    projectId,
    authorType: "moderator",
    kind: "decision_request",
    content: card.summary,
    data: card,
    runId,
  });
  emit({ type: "message", message: msg });
}

const SPEC_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(DICTIONARIES.en.spec.items).map(([k, v]) => [k, v.label]),
);

function specContext(spec: ProjectSpec): Pick<ProjectContext, "kind" | "specSummary" | "specOpen"> {
  const guides = spec.kind ? Object.fromEntries(specTemplate(spec.kind).map((i) => [i.key, i.guide])) : {};
  const answered = Object.entries(spec.answers)
    .filter(([, a]) => a.value?.trim())
    .map(([k, a]) => `- ${SPEC_LABELS[k] ?? k}: ${a.value}`);
  return {
    kind: spec.kind,
    specSummary: answered.length ? answered.join("\n") : "(nothing answered yet)",
    specOpen: openSpecPoints(spec).map((key) => ({
      key,
      label: SPEC_LABELS[key] ?? key,
      guide:
        key === "kind"
          ? "Is this a web app (a tool, site or service people use) or a web game (something people play)?"
          : (guides[key] ?? ""),
    })),
  };
}

async function saveSpec(projectId: string, before: ProjectSpec, after: ProjectSpec) {
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    await db.update(schema.projects).set({ spec: after }).where(eq(schema.projects.id, projectId));
  }
  return after;
}

function humanTexts(history: MessageDTO[], project: ProjectRow) {
  const texts = history.filter((m) => m.authorType === "user" && m.kind === "chat").map((m) => m.content);
  return [...texts.reverse(), project.vision];
}

async function specCompleted(args: { project: ProjectRow; spec: ProjectSpec; runId: string; emit: Emit; origin?: string }) {
  const { project, spec, runId, emit } = args;
  try {
    const kind = spec.kind ?? "web_app";
    let slug = project.designSlug;
    if (!slug && kind === "web_app") {
      slug = await chooseDesign({ projectId: project.id }, { name: project.name, vision: project.vision, spec });
      await db.update(schema.projects).set({ designSlug: slug }).where(eq(schema.projects.id, project.id));
    }
    const design = slug ? designName(slug) : null;
    const note = await insertMessage({
      projectId: project.id,
      authorType: "moderator",
      kind: "note",
      content: `Spec complete: ${kind === "web_game" ? "web game" : "web app"}${design ? `, ${design} design` : ""}. The team starts building.`,
      data: { type: "spec_complete", kind, design },
      runId,
    });
    emit({ type: "message", message: note });
  } catch (err) {
    console.error("[run] spec completion note failed", err);
  }
  if (args.origin && project.repoFullName && infraConfigured()) {
    await startBuild(project.id, "build", args.origin).catch((err) => console.error("[run] build failed to start", err));
  }
}

async function insertMessage(values: typeof schema.messages.$inferInsert) {
  const [row] = await db.insert(schema.messages).values(values).returning();
  return toMessageDTO(row);
}

async function updateMessageData(id: string, data: DecisionCard) {
  const [row] = await db
    .update(schema.messages)
    .set({ data, updatedAt: sql`now()` })
    .where(eq(schema.messages.id, id))
    .returning();
  return row ? toMessageDTO(row) : null;
}
