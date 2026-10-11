export type Sheet = { url: string; frameWidth: number; frameHeight: number };

export const IMAGES = {} as const satisfies Record<string, string>;

export const SPRITESHEETS = {} as const satisfies Record<string, Sheet>;

export const MODELS = {} as const satisfies Record<string, string>;

export type ImageKey = keyof typeof IMAGES;

export const IMAGE_ENTRIES = Object.entries(IMAGES as Record<string, string>);
export const SPRITESHEET_ENTRIES = Object.entries(SPRITESHEETS as Record<string, Sheet>);
export const MODEL_ENTRIES = Object.entries(MODELS as Record<string, string>);

export function hasImage(key: string): key is ImageKey {
  return key in IMAGES;
}
