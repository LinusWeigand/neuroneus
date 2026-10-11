import type { GameStyle, GoogleFont } from "./styles";

export type ImageAsset = { key: string; path: string };
export type SheetAsset = ImageAsset & { frameWidth: number; frameHeight: number };

export function fontExportName(family: string) {
  return family.replace(/[^A-Za-z0-9]+/g, "_");
}

function fontCall(font: GoogleFont, variable: string) {
  const weights = [...new Set(font.weights)].sort();
  return `${fontExportName(font.family)}({ subsets: ["latin"], weight: ${JSON.stringify(weights)}, variable: "${variable}", display: "swap" })`;
}

export function fontsTs(style: GameStyle) {
  const imports = [...new Set([style.fonts.display.family, style.fonts.body.family].map(fontExportName))].sort();
  return `import { ${imports.join(", ")} } from "next/font/google";

export const display = ${fontCall(style.fonts.display, "--font-display")};
export const body = ${fontCall(style.fonts.body, "--font-body")};
`;
}

export function paletteTs(style: GameStyle) {
  const palette = Object.entries(style.palette)
    .map(([role, color]) => `  ${role}: "${color}",`)
    .join("\n");
  const look = Object.entries(style.look)
    .map(([key, value]) => `  ${key}: ${value},`)
    .join("\n");
  return `export const STYLE = "${style.id}";

export const PALETTE = {
${palette}
} as const;

export const PIXEL_ART = ${style.pixelArt};

export const LOOK = {
${look}
} as const;
`;
}

export function paletteCss(style: GameStyle) {
  const vars = Object.entries(style.palette)
    .map(([role, color]) => `  --game-${role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${color};`)
    .join("\n");
  return `:root {\n${vars}\n}\n`;
}

export function assetsTs(images: ImageAsset[], sheets: SheetAsset[] = [], models: ImageAsset[] = []) {
  const modelLines = models.map((a) => `  ${JSON.stringify(a.key)}: ${JSON.stringify(a.path)},`).join("\n");
  const imageLines = images.map((a) => `  ${JSON.stringify(a.key)}: ${JSON.stringify(a.path)},`).join("\n");
  const sheetLines = sheets
    .map((s) => `  ${JSON.stringify(s.key)}: { url: ${JSON.stringify(s.path)}, frameWidth: ${s.frameWidth}, frameHeight: ${s.frameHeight} },`)
    .join("\n");
  return `export type Sheet = { url: string; frameWidth: number; frameHeight: number };

export const IMAGES = {${imageLines ? `\n${imageLines}\n` : ""}} as const satisfies Record<string, string>;

export const SPRITESHEETS = {${sheetLines ? `\n${sheetLines}\n` : ""}} as const satisfies Record<string, Sheet>;

export const MODELS = {${modelLines ? `\n${modelLines}\n` : ""}} as const satisfies Record<string, string>;

export type ImageKey = keyof typeof IMAGES;

export const IMAGE_ENTRIES = Object.entries(IMAGES as Record<string, string>);
export const SPRITESHEET_ENTRIES = Object.entries(SPRITESHEETS as Record<string, Sheet>);
export const MODEL_ENTRIES = Object.entries(MODELS as Record<string, string>);

export function hasImage(key: string): key is ImageKey {
  return key in IMAGES;
}
`;
}

export type GameText = Record<string, string>;

export function textTs(text: GameText) {
  const lines = Object.entries(text)
    .map(([key, value]) => `  ${key}: ${JSON.stringify(value)},`)
    .join("\n");
  return `export const TEXT = {\n${lines}\n} as const;\n`;
}
