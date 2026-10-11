import "server-only";
import type { ProjectRow } from "@/lib/db/schema";
import { fetchBytes, storageConfigured } from "@/lib/art/blob";
import { type ArtPlan, pickKenney, planArt } from "@/lib/art/director";
import { fluxConfigured } from "@/lib/art/flux";
import type { GameLanguage } from "@/lib/art/game-text";
import { loadLibraryIndex } from "@/lib/art/library-index";
import { type ArtAsset, artFiles, type GameArt, paintAssets, paintConcept } from "@/lib/art/pipeline";
import { GAME_STYLE_BY_ID, GAME_STYLES } from "@/lib/art/styles";
import type { ProjectArt } from "@/lib/types";
import type { UsageScope } from "@/lib/usage";
import type { FileMap } from "./repo";

export type ArtStage = "plan" | "picks" | "concept" | "assets" | "install";
export type ArtState = { stage: ArtStage; plan?: ArtPlan; conceptUrl?: string; titleUrl?: string | null; assets?: ArtAsset[] };

export function artConfigured() {
  return storageConfigured() && fluxConfigured();
}

export type ArtStepResult =
  | { state: ArtState; done: false }
  | { done: true; art: ProjectArt; files: FileMap; binaries: Record<string, Buffer>; styleName: string };

export async function advanceArt(input: {
  state: ArtState;
  scope: UsageScope;
  project: ProjectRow;
  spec: string;
  language: GameLanguage;
  dimension: "2d" | "3d";
  files: FileMap;
}): Promise<ArtStepResult> {
  const { state, project, scope } = input;
  switch (state.stage) {
    case "plan": {
      const plan = await planArt(scope, { name: project.name, vision: project.vision, spec: input.spec, language: input.language, dimension: input.dimension });
      const style = GAME_STYLE_BY_ID[plan.styleId];
      return { done: false, state: { stage: style.sprites === "kenney" ? "picks" : "concept", plan } };
    }
    case "picks": {
      const style = GAME_STYLE_BY_ID[state.plan!.styleId];
      const index = await loadLibraryIndex();
      const kenney = index ? await pickKenney(scope, { style, spec: input.spec, index }) : [];
      return { done: false, state: { ...state, stage: "concept", plan: { ...state.plan!, kenney } } };
    }
    case "concept": {
      const style = GAME_STYLE_BY_ID[state.plan!.styleId];
      const concept = await paintConcept(project.id, state.plan!, style);
      return { done: false, state: { ...state, stage: "assets", conceptUrl: concept.url } };
    }
    case "assets": {
      const style = GAME_STYLE_BY_ID[state.plan!.styleId];
      const concept = await fetchBytes(state.conceptUrl!);
      const { assets, titleUrl } = await paintAssets({ projectId: project.id, plan: state.plan!, style, concept, index: await loadLibraryIndex() });
      return { done: false, state: { ...state, stage: "install", assets, titleUrl } };
    }
    case "install": {
      const plan = state.plan!;
      const style = GAME_STYLE_BY_ID[plan.styleId] ?? GAME_STYLES[0];
      const art: GameArt = { styleId: style.id, conceptUrl: state.conceptUrl!, titleUrl: state.titleUrl ?? null, tagline: plan.tagline, assets: state.assets ?? [] };
      const generated = artFiles({ art, style, title: project.name, language: input.language, concept: state.conceptUrl! });
      const binaries: Record<string, Buffer> = {};
      for (let i = 0; i < art.assets.length; i += 6) {
        await Promise.all(art.assets.slice(i, i + 6).map(async (a) => (binaries[a.path] = await fetchBytes(a.url))));
      }
      binaries["docs/concept.jpg"] = await fetchBytes(state.conceptUrl!);
      return {
        done: true,
        art: { style: style.id, styleName: style.name, conceptUrl: state.conceptUrl!, titleUrl: state.titleUrl ?? null, dimension: style.dimension },
        files: { ...input.files, ...generated },
        binaries,
        styleName: style.name,
      };
    }
  }
}
