import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { callSettings, modelFor, structuredModelId } from "@/lib/ai";
import { recordUsage, type UsageScope } from "@/lib/usage";
import type { LibraryIndex } from "./library";
import { GAME_STYLE_BY_ID, GAME_STYLES, type GameStyle } from "./styles";

export type SpritePlan = { key: string; prompt: string; size: number };
export type KenneyPick = { key: string; pack: string; file: string; size: number };

export type ArtPlan = {
  styleId: string;
  concept: string;
  background: string;
  title: string;
  tagline: string;
  sprites: SpritePlan[];
  kenney: KenneyPick[];
};

const KEY = /^[a-z][a-zA-Z0-9]{1,23}$/;
const RESERVED = new Set(["background", "title", "spark", "glow", "dot", "star", "diamond"]);

const planSchema = z.object({
  styleId: z.enum(GAME_STYLES.map((s) => s.id) as [string, ...string[]]),
  concept: z.string(),
  background: z.string(),
  title: z.string(),
  tagline: z.string(),
  sprites: z.array(z.object({ key: z.string(), prompt: z.string(), size: z.number() })),
});

const picksSchema = z.object({ picks: z.array(z.object({ key: z.string(), pack: z.string(), file: z.string(), size: z.number() })) });

function cleanKey(key: string) {
  const k = key.replace(/[^a-zA-Z0-9]/g, "").replace(/^[^a-z]+/, "");
  return KEY.test(k) && !RESERVED.has(k) ? k : null;
}

export async function planArt(scope: UsageScope, input: { name: string; vision: string; spec: string; language: string; dimension: "2d" | "3d" }): Promise<ArtPlan> {
  const model = structuredModelId();
  const styles = GAME_STYLES.filter((s) => s.dimension === input.dimension);
  const { output, usage } = await generateText({
    model: modelFor(model),
    output: Output.object({ schema: planSchema }),
    ...callSettings(model, 4000),
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(200_000),
    instructions: `You are the art director of a small game studio. Give this ${input.dimension.toUpperCase()} web game a striking, coherent look that fits its audience and mood, and plan the art an image model will paint.

Styles (id: name, what it fits):
${styles.map((s) => `- ${s.id}: ${s.name}, ${s.fits}`).join("\n")}

Plan:
- styleId: the style that fits the game best.
- concept: a prompt for one target screenshot of the game in play, as a player would see it mid-game: the player, the main objects and the scene, the camera view the spec implies (side view, top-down), the HUD only as a small score in a corner. This screenshot is the visual target everything else matches.
- background: a prompt for the gameplay background alone, with no characters, items, text or UI, leaving open space where the action happens.
- title: a prompt for the title screen art: the game's world and hero as key art, with empty space at the top for the logo, no text.
- tagline: one short line under the logo, in ${input.language}, max 6 words.
- sprites: only for styles that paint their own sprites: the 2 to 6 key game objects the code needs (player, enemies, items, obstacles), each as one object. key: a camelCase id the code uses (e.g. player, carrot, hawk, fox, hole). prompt: the object alone, its look, pose and colors; never a scene. size: its display size in the game in px (on a 1280×720 screen), 32 to 220.
- Prompts are in English, concrete about shapes, colors and mood, and never name brands, artists or existing games.`,
    prompt: `Game: ${input.name}\nVision: ${input.vision}\n\nSpec:\n${input.spec}`,
  });
  await recordUsage(scope, "design", model, usage);
  const style = GAME_STYLE_BY_ID[output.styleId] ?? styles[0];
  const sprites: SpritePlan[] = [];
  if (style.sprites === "flux") {
    for (const sprite of output.sprites.slice(0, 6)) {
      const key = cleanKey(sprite.key);
      if (key && !sprites.some((s) => s.key === key)) sprites.push({ key, prompt: sprite.prompt, size: Math.round(Math.min(220, Math.max(32, sprite.size))) });
    }
  }
  return {
    styleId: style.id,
    concept: output.concept,
    background: output.background,
    title: output.title,
    tagline: output.tagline.slice(0, 60),
    sprites,
    kenney: [],
  };
}

function packListing(index: LibraryIndex, packs: string[]) {
  return packs
    .filter((p) => index.packs[p])
    .map((p) => `## ${p}\n${index.packs[p].files.filter((f) => !f.path.includes("Textures/")).map((f) => f.path).join("\n")}`)
    .join("\n\n");
}

export async function pickKenney(scope: UsageScope, input: { style: GameStyle; spec: string; index: LibraryIndex }): Promise<KenneyPick[]> {
  const packs = input.style.kenney.filter((p) => p !== "particle-pack" && p !== "input-prompts");
  if (!packs.length) return [];
  const model = structuredModelId();
  const { output, usage } = await generateText({
    model: modelFor(model),
    output: Output.object({ schema: picksSchema }),
    ...callSettings(model, 4000),
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(200_000),
    instructions: `You pick ready-made ${input.style.dimension.toUpperCase()} game assets from a library for a ${input.style.name} game. Pick the 3 to 14 files the game's code needs: the player, enemies, items, obstacles and the tiles or props for the world. Use files from one pack where possible, so the look stays consistent.

For each pick: key (a camelCase id the code uses, e.g. player, coin, groundTile, tree), pack, file (exactly as listed), size (display size in px on a 1280×720 screen, or the length in world units for 3D models, 1 to 40).

Library:
${packListing(input.index, packs)}`,
    prompt: `Spec:\n${input.spec}`,
  });
  await recordUsage(scope, "design", model, usage);
  const known = new Set(packs.flatMap((p) => (input.index.packs[p]?.files ?? []).map((f) => `${p}/${f.path}`)));
  const picks: KenneyPick[] = [];
  for (const pick of output.picks.slice(0, 14)) {
    const key = cleanKey(pick.key);
    if (key && known.has(`${pick.pack}/${pick.file}`) && !picks.some((p) => p.key === key)) picks.push({ key, pack: pick.pack, file: pick.file, size: pick.size });
  }
  return picks;
}
