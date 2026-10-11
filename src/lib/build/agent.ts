import "server-only";
import { hasToolCall, isStepCount, type LanguageModelUsage, type ModelMessage, streamText, tool } from "ai";
import { z } from "zod";
import type { AgentDef } from "@/lib/agents";
import { callSettings, modelFor } from "@/lib/ai";
import type { BuildActivity, BuildEventKind } from "@/lib/types";
import type { FileMap } from "./repo";

export type BuildContext = {
  name: string;
  vision: string;
  kind: "web_app" | "web_game";
  spec: string;
  designName: string | null;
  database: boolean;
  decisions: { header: string; choice: string }[];
  shipped: string[];
  language: "German" | "English";
};

export type BuilderReport = {
  activity: (a: Omit<BuildActivity, "since" | "agentId">) => void;
  event: (e: { kind: BuildEventKind; path?: string; detail?: string }) => void;
};

const MAX_FILES = 300;
const MAX_FILE_CHARS = 150_000;
const MAX_STEPS = 30;
const PROTECTED = /^(\.git\/|node_modules\/|\.next\/|\.env)/;
const PRELOADED = ["AGENTS.md", "docs/DESIGN-BRIEF.md", "docs/ART-DIRECTION.md"];
const COMPACT_AT = 200_000;
const KEEP_RECENT = 6;

function checkPath(path: string) {
  const p = path.trim().replace(/^\.\//, "");
  if (!p || p.startsWith("/") || p.includes("..") || p.includes("\\") || PROTECTED.test(p)) {
    throw new Error(`Invalid path "${path}". Use a relative path inside the project, like app/page.tsx.`);
  }
  return p;
}

export function codeMap(files: FileMap) {
  return Object.keys(files)
    .sort()
    .map((p) => {
      const exports = /\.(tsx?|mjs|js)$/.test(p) ? exportsOf(files[p]) : [];
      return `${p} (${files[p].length})${exports.length ? ` — ${exports.join(", ")}` : ""}`;
    })
    .join("\n");
}

function exportsOf(source: string) {
  const names: string[] = [];
  const re = /^export\s+(default\s+)?(?:async\s+)?(?:function\*?|const|let|class|type|interface|enum)\s+([A-Za-z0-9_$]+)/gm;
  for (const m of source.matchAll(re)) names.push(m[1] ? `default ${m[2]}` : m[2]);
  if (names.length === 0 && /^export\s+default\b/m.test(source)) names.push("default");
  return names.length > 8 ? [...names.slice(0, 8), "…"] : names;
}

function instructions(
  agent: AgentDef,
  ctx: BuildContext,
  files: FileMap,
  task: { title: string; detail: string },
  fix: string | null,
) {
  const decisions = ctx.decisions.length ? ctx.decisions.map((d) => `- ${d.header}: ${d.choice}`).join("\n") : "None yet.";
  const shipped = ctx.shipped.length ? ctx.shipped.map((s) => `- ${s}`).join("\n") : "Nothing yet (starter app).";
  const what = ctx.kind === "web_game" ? "web game" : "web app";
  const brief = files["docs/DESIGN-BRIEF.md"];
  const preloaded = PRELOADED.filter((p) => files[p])
    .map((p) => `<file path="${p}">\n${files[p].trim()}\n</file>`)
    .join("\n\n");
  const design = files["docs/ART-DIRECTION.md"]
    ? "the art direction in docs/ART-DIRECTION.md (below): its palette, type, look, rules and asset list. A reviewer compares every deploy with its target screenshot, so make the game look like it."
    : !ctx.designName
    ? "keep it clean and consistent."
    : brief
      ? `the ${ctx.designName} design system. docs/DESIGN-BRIEF.md (below) has its tokens and rules; follow it strictly for every pixel and never invent colors or styles outside it. DESIGN.md has the full system: read the section you need (search it) only when the brief doesn't cover a component.`
      : `the ${ctx.designName} design system in DESIGN.md. Follow it strictly for every pixel: its tokens, typography, components and do's and don'ts. Never invent colors or styles outside it. Search it for the sections you need.`;

  return `You are ${agent.name}, the ${agent.role} and the only engineer writing code on a team of AI agents building a real ${what} for a human. Implement one task at a time in the codebase.

How to work:
- The project's conventions, design brief and spec are below, with a map of every file (size in characters, and what code files export). Files shown in full below need no reading.
- Read only the files the task touches, several at once with read_files. Use search to find usages instead of reading whole files.
- After you call finish, the platform builds the app, a reviewer plays the deployed preview and compares it with the task, the spec${ctx.kind === "web_game" ? " and the target screenshot" : ""}; only then does it ship. Make it work end to end.
- Make complete, focused changes. The app must build under strict TypeScript and the feature must work end to end, including empty, loading and error states.
- You cannot run commands. Be careful with imports, types and Next.js 16 APIs; check that every import you add exists.
- Use edit_file for small changes and write_file for new files or full rewrites.
- Work in few steps: batch reads, then write. Don't re-read a file you just wrote.
- When done, call finish with one sentence for the product owner: what they can now do in the app, in plain product language, no code, file or library names. Write it in ${ctx.language}.

Project: ${ctx.name}
Vision: ${ctx.vision}

Spec (the source of truth; don't build what it puts out of scope):
${ctx.spec}

Design: ${design}
Database: ${ctx.database ? "Neon Postgres (see AGENTS.md)." : "none. Keep state in the browser (React state, localStorage)."}

${preloaded}

Decisions the human made:
${decisions}

Already shipped:
${shipped}

Files:
${codeMap(files)}

Your task: ${task.title}
${task.detail}
${
  fix
    ? `
${
        /^(Verification|It works)/.test(fix)
          ? "A reviewer played the deployed preview of this task. Address every point with the smallest change that keeps the task's intent:"
          : "The last deploy of this task FAILED to build. Fix the cause with the smallest change that keeps the task's intent. Build output:"
      }
\`\`\`
${fix.slice(0, 6000)}
\`\`\`
`
    : ""
}`;
}

function portable(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((m) => {
    if (m.role !== "assistant" || !Array.isArray(m.content)) return m;
    return {
      ...m,
      content: m.content
        .filter((p) => p.type !== "reasoning")
        .map((p) => {
          const copy = { ...p } as Record<string, unknown>;
          delete copy.providerOptions;
          return copy as typeof p;
        }),
    };
  });
}

const size = (messages: ModelMessage[]) => JSON.stringify(messages).length;

export function compact(messages: ModelMessage[], force = false): ModelMessage[] {
  if (!force && size(messages) < COMPACT_AT) return messages;
  const calls = new Map<string, { tool: string; paths: string[]; at: number }>();
  const lastTouch = new Map<string, number>();
  messages.forEach((m, at) => {
    if (m.role !== "assistant" || !Array.isArray(m.content)) return;
    for (const p of m.content) {
      if (p.type !== "tool-call") continue;
      const input = (p.input ?? {}) as { path?: unknown; paths?: unknown };
      const paths = [input.path, ...(Array.isArray(input.paths) ? input.paths : [])].filter((x): x is string => typeof x === "string");
      calls.set(p.toolCallId, { tool: p.toolName, paths, at });
      for (const path of paths) lastTouch.set(path, at);
    }
  });

  const keepFrom = messages.length - KEEP_RECENT;
  const shrink = (aggressive: boolean) =>
    messages.map((m, i): ModelMessage => {
      if (i >= keepFrom) return m;
      if (m.role === "assistant" && Array.isArray(m.content)) {
        return {
          ...m,
          content: m.content.map((p) => {
            if (p.type !== "tool-call" || p.toolName !== "write_file") return p;
            const input = p.input as { path?: string; content?: unknown };
            if (typeof input?.content !== "string" || input.content.length < 400) return p;
            return { ...p, input: { ...input, content: `[${input.content.length} characters written; read the file to see them]` } };
          }),
        };
      }
      if (m.role === "tool") {
        return {
          ...m,
          content: m.content.map((p) => {
            if (p.type !== "tool-result") return p;
            const call = calls.get(p.toolCallId);
            if (!call || (call.tool !== "read_file" && call.tool !== "read_files")) return p;
            const stale = call.paths.length > 0 && call.paths.every((path) => (lastTouch.get(path) ?? -1) > call.at);
            if (!stale && !aggressive) return p;
            const value = `[Content of ${call.paths.join(", ")} omitted to save space${stale ? ": changed or read again later" : ""}. Read it again if you need it.]`;
            return { ...p, output: { type: "text" as const, value } };
          }),
        };
      }
      return m;
    });

  const light = shrink(false);
  return size(light) < COMPACT_AT * 0.7 ? light : shrink(true);
}

function addUsage(total: LanguageModelUsage, u: LanguageModelUsage): LanguageModelUsage {
  const n = (a?: number, b?: number) => (a ?? 0) + (b ?? 0);
  return {
    inputTokens: n(total.inputTokens, u.inputTokens),
    inputTokenDetails: {
      noCacheTokens: n(total.inputTokenDetails.noCacheTokens, u.inputTokenDetails?.noCacheTokens),
      cacheReadTokens: n(total.inputTokenDetails.cacheReadTokens, u.inputTokenDetails?.cacheReadTokens),
      cacheWriteTokens: n(total.inputTokenDetails.cacheWriteTokens, u.inputTokenDetails?.cacheWriteTokens),
    },
    outputTokens: n(total.outputTokens, u.outputTokens),
    outputTokenDetails: {
      textTokens: n(total.outputTokenDetails.textTokens, u.outputTokenDetails?.textTokens),
      reasoningTokens: n(total.outputTokenDetails.reasoningTokens, u.outputTokenDetails?.reasoningTokens),
    },
    totalTokens: n(total.totalTokens, u.totalTokens),
  };
}

const NO_USAGE: LanguageModelUsage = {
  inputTokens: 0,
  inputTokenDetails: { noCacheTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  outputTokens: 0,
  outputTokenDetails: { textTokens: 0, reasoningTokens: 0 },
  totalTokens: 0,
};

const ACTIVITY_FOR_TOOL: Record<string, BuildActivity["kind"]> = {
  list_files: "listing",
  read_file: "reading",
  read_files: "reading",
  search: "searching",
  write_file: "writing",
  edit_file: "editing",
  delete_file: "deleting",
  finish: "thinking",
};

export async function runBuilder(args: {
  agent: AgentDef;
  ctx: BuildContext;
  task: { title: string; detail: string };
  files: FileMap;
  fixLog: string | null;
  model: string;
  history: ModelMessage[] | null;
  softDeadline: number;
  hardDeadline: number;
  cacheKey: string;
  report: BuilderReport;
}): Promise<{ files: FileMap; summary: string | null; finished: boolean; history: ModelMessage[]; usage: LanguageModelUsage }> {
  const files: FileMap = { ...args.files };
  const { report } = args;
  let summary: string | null = null;
  let usage = NO_USAGE;

  const readOne = (path: string) => {
    const p = checkPath(path);
    if (!(p in files)) return `File not found: ${p}`;
    report.event({ kind: "read", path: p });
    return files[p].length > 60_000 ? files[p].slice(0, 60_000) + "\n[truncated]" : files[p];
  };

  const tools = {
    list_files: tool({
      description: "List all files in the project with their sizes in characters (the instructions already have this map).",
      inputSchema: z.object({}),
      execute: async () => {
        report.event({ kind: "listed" });
        return codeMap(files);
      },
    }),
    read_file: tool({
      description: "Read one file's full content.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => readOne(path),
    }),
    read_files: tool({
      description: "Read several files at once (up to 8). Prefer this over several read_file calls.",
      inputSchema: z.object({ paths: z.array(z.string()).min(1).max(8) }),
      execute: async ({ paths }) => paths.map((p) => `<file path="${p}">\n${readOne(p)}\n</file>`).join("\n\n"),
    }),
    search: tool({
      description: "Case-insensitive text search across all files. Returns path:line: text for each match.",
      inputSchema: z.object({ query: z.string().min(1) }),
      execute: async ({ query }) => {
        const q = query.toLowerCase();
        const hits: string[] = [];
        for (const [p, content] of Object.entries(files)) {
          content.split("\n").forEach((line, i) => {
            if (hits.length < 60 && line.toLowerCase().includes(q)) hits.push(`${p}:${i + 1}: ${line.trim().slice(0, 200)}`);
          });
        }
        report.event({ kind: "searched", detail: query.slice(0, 80) });
        return hits.length ? hits.join("\n") : "No matches.";
      },
    }),
    write_file: tool({
      description: "Create a file or replace its entire content.",
      inputSchema: z.object({ path: z.string(), content: z.string() }),
      execute: async ({ path, content }) => {
        const p = checkPath(path);
        if (!(p in files) && Object.keys(files).length >= MAX_FILES) return "Too many files in the project.";
        if (content.length > MAX_FILE_CHARS) return "File too large; split it up.";
        const created = !(p in files);
        files[p] = content;
        report.event({ kind: "wrote", path: p, detail: created ? "new" : undefined });
        return `Wrote ${p} (${content.length} chars).`;
      },
    }),
    edit_file: tool({
      description: "Replace one exact occurrence of `find` with `replace` in a file. `find` must match exactly once.",
      inputSchema: z.object({ path: z.string(), find: z.string().min(1), replace: z.string() }),
      execute: async ({ path, find, replace }) => {
        const p = checkPath(path);
        const content = files[p];
        if (content === undefined) return `File not found: ${p}`;
        const count = content.split(find).length - 1;
        if (count === 0) return `No match for the given text in ${p}. Read the file and try again.`;
        if (count > 1) return `The text matches ${count} times in ${p}; include more surrounding lines.`;
        files[p] = content.replace(find, () => replace);
        report.event({ kind: "edited", path: p });
        return `Edited ${p}.`;
      },
    }),
    delete_file: tool({
      description: "Delete a file.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => {
        const p = checkPath(path);
        if (!(p in files)) return `File not found: ${p}`;
        delete files[p];
        report.event({ kind: "deleted", path: p });
        return `Deleted ${p}.`;
      },
    }),
    finish: tool({
      description: "Call when the task is complete. `summary`: one sentence for the product owner, product language only.",
      inputSchema: z.object({ summary: z.string() }),
      execute: async ({ summary: s }) => {
        summary = s.trim();
        report.event({ kind: "finished" });
        return "Done.";
      },
    }),
  };

  const opening: ModelMessage[] = args.history?.length
    ? [
        ...args.history,
        { role: "user", content: "You ran out of time in the previous session. Continue the task where you left off, then call finish." },
      ]
    : [
        {
          role: "user",
          content: args.fixLog ? "Fix the build, then call finish." : "Implement the task, then call finish.",
        },
      ];

  let history: ModelMessage[] = args.history ?? opening;
  try {
    const result = streamText({
      model: modelFor(args.model),
      instructions: instructions(args.agent, args.ctx, args.files, args.task, args.fixLog),
      messages: opening,
      tools,
      stopWhen: [isStepCount(MAX_STEPS), hasToolCall("finish"), () => Date.now() > args.softDeadline],
      prepareStep: ({ messages }) => {
        const compacted = compact(messages);
        return compacted === messages ? undefined : { messages: compacted };
      },
      onStepFinish: (step) => {
        usage = addUsage(usage, step.usage);
      },
      ...callSettings(args.model, 24_000, { promptCacheKey: args.cacheKey }),
      maxRetries: 2,
      abortSignal: AbortSignal.timeout(Math.max(10_000, args.hardDeadline - Date.now())),
    });

    const inputs = new Map<string, { tool: string; buf: string }>();
    for await (const part of result.fullStream) {
      switch (part.type) {
        case "start-step":
        case "reasoning-start":
          report.activity({ kind: "thinking" });
          break;
        case "tool-input-start":
          inputs.set(part.id, { tool: part.toolName, buf: "" });
          report.activity({ kind: ACTIVITY_FOR_TOOL[part.toolName] ?? "thinking" });
          break;
        case "tool-input-delta": {
          const input = inputs.get(part.id);
          if (!input) break;
          input.buf += part.delta;
          const path = /"paths?"\s*:\s*\[?\s*"([^"]+)"/.exec(input.buf)?.[1];
          const query = /"query"\s*:\s*"([^"]*)/.exec(input.buf)?.[1];
          report.activity({
            kind: ACTIVITY_FOR_TOOL[input.tool] ?? "thinking",
            path,
            query,
            chars: input.tool === "write_file" || input.tool === "edit_file" ? input.buf.length : undefined,
          });
          break;
        }
        case "tool-result":
          inputs.delete(part.toolCallId);
          break;
      }
    }
    history = compact(portable([...opening, ...(await result.responseMessages)]));
  } catch (err) {
    console.warn(`[builder] ${args.agent.name} stopped:`, err instanceof Error ? err.message : err);
  }
  return { files, summary, finished: summary !== null, history, usage };
}
