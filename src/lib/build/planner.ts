import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { AgentDef } from "@/lib/agents";
import { callSettings, modelFor, plannerModelId } from "@/lib/ai";
import { recordUsage, type UsageScope } from "@/lib/usage";
import { type BuildContext, codeMap } from "./agent";
import { readMarker } from "./frameworks";
import type { FileMap } from "./repo";

const planSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
    }),
  ),
});

const FRAMEWORK_NOTES: Record<string, string> = {
  game2d:
    "Phaser 4 game in game/ (scenes in game/scenes, UI in game/ui.ts, game feel in game/juice.ts, assets by key from game/assets.ts). Menus and HUD are in the engine, never React. A reviewer plays every deploy.",
  game3d:
    "Three.js game in game/ (scene setup in game/world.ts, the game in game/play.ts, HUD in components/hud.tsx, models by key from game/assets.ts). A reviewer plays every deploy.",
  web: "Next.js app: routes in app/, features in features/<feature>/, shared UI in components/ui, tokens in app/globals.css. A reviewer opens every deploy on desktop and phone.",
};

export type PlannedTask = { title: string; detail: string; agentId: string };

export async function planRound(args: {
  scope: UsageScope;
  ctx: BuildContext;
  builder: AgentDef;
  files: FileMap;
  transcript: string;
  round: number;
}): Promise<PlannedTask[]> {
  const { ctx } = args;
  const framework = readMarker(args.files).framework ?? null;
  const art = args.files["docs/ART-DIRECTION.md"];
  const assets = art ? art.slice(art.indexOf("## Assets")).trim() : "";
  const max = args.round <= 1 ? 5 : 4;
  const model = plannerModelId();

  const { output, usage } = await generateText({
    model: modelFor(model),
    output: Output.object({ schema: planSchema }),
    ...callSettings(model, 6000),
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(180_000),
    instructions: `You are the tech lead of a team of AI agents building a real ${ctx.kind === "web_game" ? "web game" : "web app"} (Next.js 16, TypeScript, Tailwind CSS 4${ctx.database ? ", Neon Postgres" : ", no server database"}, deployed on Vercel). Plan build round ${args.round}.

Project: ${ctx.name}
Vision: ${ctx.vision}

Spec (complete; build exactly this, nothing it puts out of scope):
${ctx.spec}

${
      art
        ? `Art direction: docs/ART-DIRECTION.md, with painted art ready to use:\n${assets}`
        : `Design system: ${ctx.designName ? `${ctx.designName} (DESIGN.md in the repo). Every task builds to it.` : "none."}`
    }
${framework ? `Framework: ${FRAMEWORK_NOTES[framework]}` : ""}

Decisions the human made (respect them):
${ctx.decisions.map((d) => `- ${d.header}: ${d.choice}`).join("\n") || "None yet."}

Already shipped:
${ctx.shipped.map((s) => `- ${s}`).join("\n") || "Nothing yet: the app is a placeholder starter page."}

${args.builder.name} (${args.builder.role}) implements every task.

Rules:
- 1 to ${max} tasks, in build order, highest user value first. Each task is a vertical slice that is deployable on its own and visibly improves the app.
- ${
      args.round <= 1
        ? ctx.kind === "web_game"
          ? framework
            ? "The first task builds the real game in place of the placeholder play scene: the core loop with the painted assets (by key), win/lose and score, juice on every action, title and game-over text adapted to the game. Later tasks add mechanics, progression and polish."
            : "The first task makes the game playable end to end on the canvas shell: start screen, the core loop, game over and restart, styled with DESIGN.md's tokens. Later tasks add mechanics, progression and feedback."
          : "The first task sets up DESIGN.md's tokens and fonts, and replaces the placeholder with the real app shell and the core feature, so the human sees the product take shape immediately."
        : "Build on what's shipped. Don't redo it."
    }
- Keep each task small enough for one engineer in one sitting: a few files, no more.
- MVP scope only. No authentication, payments, email or third-party APIs that need keys, unless the human decided otherwise.
- title: max 6 words, product language (what the user gets), written in ${ctx.language}.
- detail: an implementation brief for the engineer (English): user-visible behavior and acceptance criteria, pages and routes, data tables and columns, edge states, and the files to create or change. Max 120 words.`,
    prompt: `Recent conversation:
${args.transcript || "(none)"}

Current files (size in characters, exports):
${codeMap(args.files)}

Plan the round.`,
  });
  await recordUsage(args.scope, "plan", model, usage);

  return output.tasks
    .filter((t) => t.title.trim() && t.detail.trim())
    .slice(0, max)
    .map((t) => ({
      title: t.title.trim().slice(0, 80),
      detail: t.detail.trim().slice(0, 2000),
      agentId: args.builder.id,
    }));
}
