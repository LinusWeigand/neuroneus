export type LibraryFile = { path: string; sha1: string; size: number; width?: number; height?: number };
export type LibraryPack = { name: string; dimension: "2d" | "3d"; license: string; files: LibraryFile[]; sheets: string[] };
export type LibraryIndex = { updatedAt: string; packs: Record<string, LibraryPack> };

export type KenneyPack = { slug: string; name: string; dimension: "2d" | "3d"; include: RegExp; exclude?: RegExp; strip?: RegExp };

export const KENNEY_PACKS: KenneyPack[] = [
  { slug: "particle-pack", name: "Particle Pack", dimension: "2d", include: /^PNG \(Transparent\)\/.*\.png$/i, strip: /^PNG \(Transparent\)\// },
  { slug: "input-prompts", name: "Input Prompts", dimension: "2d", include: /^(Keyboard & Mouse|Touch)\/Default\/.*\.png$/i, exclude: /outline/i },
  { slug: "ui-pack", name: "UI Pack", dimension: "2d", include: /^PNG\/.*\/Default\/.*\.png$/i, strip: /^PNG\// },
  { slug: "pixel-platformer", name: "Pixel Platformer", dimension: "2d", include: /^(Tiles|Tilemap)\/.*\.png$/i },
  { slug: "tiny-dungeon", name: "Tiny Dungeon", dimension: "2d", include: /^(Tiles|Tilemap)\/.*\.png$/i },
  { slug: "tiny-town", name: "Tiny Town", dimension: "2d", include: /^(Tiles|Tilemap)\/.*\.png$/i },
  { slug: "animal-pack", name: "Animal Pack", dimension: "2d", include: /^PNG\/Round(\s\(outline\))?\/.*\.png$/i, strip: /^PNG\// },
  { slug: "space-shooter-remastered", name: "Space Shooter Remastered", dimension: "2d", include: /^PNG\/.*\.png$/i, strip: /^PNG\// },
  { slug: "racing-pack", name: "Racing Pack", dimension: "2d", include: /^PNG\/.*\.png$/i, strip: /^PNG\// },
  { slug: "car-kit", name: "Car Kit", dimension: "3d", include: /^Models\/(GLB|GLTF) format\/.*\.(glb|png)$/i, strip: /^Models\/(GLB|GLTF) format\// },
  { slug: "racing-kit", name: "Racing Kit", dimension: "3d", include: /^Models\/(GLB|GLTF) format\/.*\.(glb|png)$/i, strip: /^Models\/(GLB|GLTF) format\// },
  { slug: "nature-kit", name: "Nature Kit", dimension: "3d", include: /^Models\/(GLB|GLTF) format\/.*\.(glb|png)$/i, strip: /^Models\/(GLB|GLTF) format\// },
  { slug: "platformer-kit", name: "Platformer Kit", dimension: "3d", include: /^Models\/(GLB|GLTF) format\/.*\.(glb|png)$/i, strip: /^Models\/(GLB|GLTF) format\// },
  { slug: "cube-pets", name: "Cube Pets (animals)", dimension: "3d", include: /^Models\/GLB format\/.*\.(glb|png)$/i, strip: /^Models\/GLB format\// },
  { slug: "blocky-characters", name: "Blocky Characters (people)", dimension: "3d", include: /^Models\/GLB format\/.*\.(glb|png)$/i, strip: /^Models\/GLB format\// },
  { slug: "food-kit", name: "Food Kit (fruit, vegetables, sweets, dishes)", dimension: "3d", include: /^Models\/GLB format\/.*\.(glb|png)$/i, strip: /^Models\/GLB format\// },
];

export const LIBRARY_INDEX_PATH = "kenney/index.json";
