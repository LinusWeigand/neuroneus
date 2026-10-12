import "server-only";
import { blobUrl, putBlob, sha1 } from "./blob";
import { assetsTs, fontsTs, paletteCss, paletteTs, textTs } from "./codegen";
import type { ArtPlan } from "./director";
import { generateImage } from "./flux";
import { gameText, type GameLanguage } from "./game-text";
import type { LibraryIndex } from "./library";
import { CutoutError, cutOut, toBackground, toJpeg } from "./process";
import type { GameStyle } from "./styles";

export type ArtAsset = {
  key: string;
  path: string;
  url: string;
  sha1: string;
  size: number;
  width?: number;
  height?: number;
  display?: number;
  source: "painted" | "kenney";
  kind: "image" | "model";
};

export type GameArt = { styleId: string; conceptUrl: string; titleUrl: string | null; tagline: string; assets: ArtAsset[] };

const STYLE_SUFFIX = "Polished, professional indie game art, cohesive palette, crisp readable shapes.";

async function limit<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
      while (next < tasks.length) {
        const i = next++;
        results[i] = await tasks[i]();
      }
    }),
  );
  return results;
}

async function store(projectId: string, name: string, data: Buffer, contentType: string) {
  const hash = sha1(data);
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const url = await putBlob("art", `${projectId}/${name}-${hash.slice(0, 10)}.${extension}`, data, contentType);
  return { url, sha1: hash, size: data.length };
}

export async function paintConcept(projectId: string, plan: ArtPlan, style: GameStyle) {
  const image = await generateImage({ prompt: `${plan.concept} Art style: ${style.artPrompt}. ${STYLE_SUFFIX} Gameplay screenshot.`, width: 1344, height: 768 });
  const jpeg = await toJpeg(image, 1344);
  const stored = await store(projectId, "concept", jpeg, "image/jpeg");
  return { png: image, url: stored.url };
}

export async function paintAssets(input: {
  projectId: string;
  plan: ArtPlan;
  style: GameStyle;
  concept: Buffer;
  index: LibraryIndex | null;
}): Promise<{ assets: ArtAsset[]; titleUrl: string | null }> {
  const { projectId, plan, style, concept } = input;
  const references = [concept];
  const scenery = async (key: "background" | "title", prompt: string) => {
    const image = await generateImage({ prompt: `${prompt} Art style: ${style.artPrompt}. ${STYLE_SUFFIX} No characters, no text, no UI.`, width: 1344, height: 768, references });
    const webp = await toBackground(image);
    const stored = await store(projectId, key, webp, "image/webp");
    return { key, path: `public/assets/art/${key}.webp`, ...stored, width: 1920, height: 1080, source: "painted", kind: "image" } satisfies ArtAsset;
  };
  const sprite = async (key: string, prompt: string, display: number): Promise<ArtAsset | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const image = await generateImage({
        prompt: `${prompt}. A single game sprite of this one object, centered, filling most of the frame, in exactly the art style, palette and line work of the reference image. The background is one perfectly flat, untextured pure magenta #FF00FF right up to the object's outline: no paper texture, no gradient, no glow or light on the background, no cast shadow, no ground, no text, nothing else.`,
        width: 768,
        height: 768,
        references,
      });
      try {
        const cut = await cutOut(image, Math.min(512, Math.max(96, display * 2)));
        const stored = await store(projectId, key, cut.data, "image/png");
        return { key, path: `public/assets/art/${key}.png`, ...stored, width: cut.width, height: cut.height, display, source: "painted", kind: "image" };
      } catch (err) {
        if (!(err instanceof CutoutError)) throw err;
        console.warn(`[art] ${key}: ${err.message}`);
      }
    }
    return null;
  };
  const tasks: (() => Promise<ArtAsset | null>)[] = [
    () => scenery("background", input.plan.background),
    () => scenery("title", input.plan.title),
    ...plan.sprites.map((s) => () => sprite(s.key, s.prompt, s.size)),
  ];
  const painted = (await limit(tasks, 3)).filter((asset): asset is ArtAsset => asset !== null);
  const kenney: ArtAsset[] = [];
  for (const pick of plan.kenney) {
    const file = input.index?.packs[pick.pack]?.files.find((f) => f.path === pick.file);
    if (!file) continue;
    const model = file.path.endsWith(".glb");
    kenney.push({
      key: pick.key,
      path: `public/assets/kenney/${pick.pack}/${file.path}`,
      url: blobUrl("library", `kenney/${pick.pack}/${file.path}`),
      sha1: file.sha1,
      size: file.size,
      width: file.width,
      height: file.height,
      display: pick.size,
      source: "kenney",
      kind: model ? "model" : "image",
    });
  }
  const textures = kenney.some((a) => a.kind === "model") ? modelTextures(input.index, plan) : [];
  return { assets: [...painted, ...kenney, ...textures], titleUrl: painted.find((a) => a.key === "title")?.url ?? null };
}

function modelTextures(index: LibraryIndex | null, plan: ArtPlan): ArtAsset[] {
  const packs = new Set(plan.kenney.map((p) => p.pack));
  return [...packs].flatMap((pack) =>
    (index?.packs[pack]?.files ?? [])
      .filter((f) => f.path.startsWith("Textures/"))
      .map((f) => ({
        key: "",
        path: `public/assets/kenney/${pack}/${f.path}`,
        url: blobUrl("library", `kenney/${pack}/${f.path}`),
        sha1: f.sha1,
        size: f.size,
        width: f.width,
        height: f.height,
        source: "kenney" as const,
        kind: "image" as const,
      })),
  );
}

export function webPath(asset: ArtAsset) {
  return "/" + asset.path.replace(/^public\//, "");
}

export function artFiles(input: { art: GameArt; style: GameStyle; title: string; language: GameLanguage; concept: string }) {
  const { art, style } = input;
  const images = art.assets.filter((a) => a.kind === "image" && a.key).map((a) => ({ key: a.key, path: webPath(a) }));
  const models = art.assets.filter((a) => a.kind === "model" && a.key).map((a) => ({ key: a.key, path: webPath(a) }));
  const lock = Object.fromEntries(art.assets.map((a) => [a.path, { sha1: a.sha1, size: a.size, url: a.url }]));
  return {
    "game/palette.ts": paletteTs(style),
    "app/palette.css": paletteCss(style),
    "app/fonts.ts": fontsTs(style),
    "game/assets.ts": assetsTs(images, [], models),
    "game/text.ts": textTs(gameText(input.language, input.title, art.tagline)),
    "assets.lock.json": JSON.stringify(lock, null, 2) + "\n",
    "docs/ART-DIRECTION.md": artDirection(input),
  };
}

function artDirection(input: { art: GameArt; style: GameStyle; concept: string }) {
  const { art, style } = input;
  const assets = art.assets
    .filter((a) => a.key)
    .map((a) => `| \`${a.key}\` | ${a.kind} | \`${webPath(a)}\` | ${a.width ?? "?"}×${a.height ?? "?"} | ${a.display ? `${a.display}` : "-"} | ${a.source} |`)
    .join("\n");
  return `# Art direction: ${style.name}

The look of this game. Everything on screen follows it.

![Target screenshot](${input.concept})

The target screenshot above is the bar: the finished game should look like it.

## Palette (game/palette.ts)

| Role | Color |
|---|---|
${Object.entries(style.palette)
  .map(([role, color]) => `| ${role} | \`${color}\` |`)
  .join("\n")}

Use colors only through \`PALETTE\` / \`hex()\` / \`css()\`; never write hex values anywhere else.

## Type

Display: ${style.fonts.display.family}. Body: ${style.fonts.body.family}. Use \`label()\` from game/ui.ts; it applies the fonts, outline and shadow.

## Look

Post-processing (game/look.ts): bloom ${style.look.bloom}, vignette ${style.look.vignette}, saturation ${style.look.saturation}. Outline ${style.look.outline}px, corner radius ${style.look.corner}px.${style.pixelArt ? " Pixel art: integer scaling only." : ""}

## Rules

${style.rules.map((r) => `- ${r}`).join("\n")}
- Every action gets feedback from game/juice.ts: a hit is burst + shake + flash + sound; a pickup is burst + popText + squash + sound.
- Menus, HUD and screens are built in the engine with game/ui.ts, styled by this palette and type.

## Assets (game/assets.ts)

| Key | Kind | Path | Pixels | Display size | Source |
|---|---|---|---|---|---|
${assets}

Load assets by key (\`this.add.image(x, y, "player")\`) and size them to the display size. Binary assets are managed by the platform (assets.lock.json); you cannot add new image files, so draw anything missing with game/textures.ts or Graphics in the palette.
`;
}
