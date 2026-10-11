export type Dimension = "2d" | "3d";

export type PaletteRole =
  | "background"
  | "backgroundAlt"
  | "surface"
  | "primary"
  | "secondary"
  | "accent"
  | "danger"
  | "success"
  | "text"
  | "textMuted"
  | "outline";

export type GoogleFont = { family: string; weights: string[] };

export type Look = {
  bloom: number;
  bloomThreshold: number;
  vignette: number;
  saturation: number;
  contrast: number;
  outline: number;
  corner: number;
  shadow: number;
};

export type GameStyle = {
  id: string;
  name: string;
  dimension: Dimension;
  fits: string;
  palette: Record<PaletteRole, string>;
  fonts: { display: GoogleFont; body: GoogleFont };
  pixelArt: boolean;
  look: Look;
  artPrompt: string;
  rules: string[];
  kenney: string[];
  sprites: "flux" | "kenney";
};

export const GAME_STYLES: GameStyle[] = [
  {
    id: "neon-synthwave",
    name: "Neon synthwave",
    dimension: "2d",
    fits: "arcade, shooters, runners, rhythm and space games with a night-time, high-energy mood",
    palette: {
      background: "#0b0820",
      backgroundAlt: "#1c1145",
      surface: "#251a5c",
      primary: "#3df5ff",
      secondary: "#ff3df2",
      accent: "#ffd23d",
      danger: "#ff4d6d",
      success: "#5dffa8",
      text: "#f4f1ff",
      textMuted: "#a99ed6",
      outline: "#05030f",
    },
    fonts: { display: { family: "Orbitron", weights: ["500", "800"] }, body: { family: "Exo 2", weights: ["400", "600"] } },
    pixelArt: false,
    look: { bloom: 0.8, bloomThreshold: 0.55, vignette: 0.35, saturation: 1.15, contrast: 1.05, outline: 4, corner: 18, shadow: 0.35 },
    artPrompt:
      "synthwave neon art style, crisp vector shapes with glowing edges, deep purple night sky, cyan and magenta light, perspective grid, high contrast, clean silhouettes",
    rules: [
      "Bright things glow: gameplay objects use primary, secondary and accent so the bloom picks them up; backgrounds stay dark.",
      "Silhouettes over detail: every object must read at a glance against the dark background.",
      "Motion leaves light: trails behind fast objects, sparks on impact.",
    ],
    kenney: ["particle-pack", "input-prompts"],
    sprites: "flux",
  },
  {
    id: "retro-pixel",
    name: "Retro pixel art",
    dimension: "2d",
    fits: "platformers, RPGs, dungeon crawlers, retro arcade and anything with a 16-bit nostalgia",
    palette: {
      background: "#1a1c2c",
      backgroundAlt: "#29366f",
      surface: "#333c57",
      primary: "#41a6f6",
      secondary: "#38b764",
      accent: "#ffcd75",
      danger: "#b13e53",
      success: "#a7f070",
      text: "#f4f4f4",
      textMuted: "#94b0c2",
      outline: "#1a1c2c",
    },
    fonts: { display: { family: "Press Start 2P", weights: ["400"] }, body: { family: "Silkscreen", weights: ["400"] } },
    pixelArt: true,
    look: { bloom: 0.15, bloomThreshold: 0.8, vignette: 0.25, saturation: 1.05, contrast: 1.05, outline: 0, corner: 0, shadow: 0.4 },
    artPrompt:
      "16-bit pixel art, limited palette (Sweetie 16), crisp pixels without anti-aliasing, readable sprites with dark outlines, SNES era video game",
    rules: [
      "Integer scaling only: sprites and tiles keep their pixel grid (scale 2x, 3x, 4x).",
      "Use the 16-color palette for everything, including UI and particles.",
      "Square corners, chunky shapes, no smooth gradients in UI.",
    ],
    kenney: ["pixel-platformer", "tiny-dungeon", "tiny-town", "particle-pack", "input-prompts"],
    sprites: "kenney",
  },
  {
    id: "cozy-cartoon",
    name: "Cozy cartoon",
    dimension: "2d",
    fits: "kids games, casual and cute games, animals, farming, matching and gentle puzzle games",
    palette: {
      background: "#bde8ff",
      backgroundAlt: "#e8f7ff",
      surface: "#fff6e5",
      primary: "#ff8a4c",
      secondary: "#7bd389",
      accent: "#ffd23f",
      danger: "#ef476f",
      success: "#06d6a0",
      text: "#3d2c4e",
      textMuted: "#7a6a8a",
      outline: "#3d2c4e",
    },
    fonts: { display: { family: "Fredoka", weights: ["500", "700"] }, body: { family: "Nunito", weights: ["400", "700"] } },
    pixelArt: false,
    look: { bloom: 0, bloomThreshold: 1, vignette: 0.12, saturation: 1.1, contrast: 1, outline: 5, corner: 24, shadow: 0.25 },
    artPrompt:
      "cute flat cartoon illustration, soft rounded shapes, thick dark outlines, bright friendly pastel colors, gentle soft shading, children's picture book style",
    rules: [
      "Round everything: no sharp corners on characters, buttons or panels.",
      "Thick dark outlines on characters and UI, the same color everywhere (outline).",
      "Squash and stretch on every jump, landing and pickup.",
    ],
    kenney: ["animal-pack", "ui-pack", "particle-pack", "input-prompts"],
    sprites: "flux",
  },
  {
    id: "flat-geometric",
    name: "Flat geometric",
    dimension: "2d",
    fits: "puzzle, zen, hyper-casual, word and number games that want a calm modern look",
    palette: {
      background: "#f2efe9",
      backgroundAlt: "#ffffff",
      surface: "#ffffff",
      primary: "#2f6bff",
      secondary: "#ff6b4a",
      accent: "#ffb627",
      danger: "#e63946",
      success: "#2a9d8f",
      text: "#1d1d29",
      textMuted: "#6b6b80",
      outline: "#1d1d29",
    },
    fonts: { display: { family: "Outfit", weights: ["600", "800"] }, body: { family: "Outfit", weights: ["400", "500"] } },
    pixelArt: false,
    look: { bloom: 0, bloomThreshold: 1, vignette: 0.08, saturation: 1, contrast: 1, outline: 0, corner: 14, shadow: 0.12 },
    artPrompt:
      "minimal flat geometric illustration, simple bold shapes, two-tone with one accent color, soft long shadows, Swiss design, clean and calm",
    rules: [
      "Few colors per screen: background, one main color, one accent.",
      "Generous spacing; nothing touches the screen edge.",
      "Motion is smooth and eased; no screen shake stronger than light.",
    ],
    kenney: ["particle-pack", "input-prompts"],
    sprites: "flux",
  },
  {
    id: "ink-paper",
    name: "Ink on paper",
    dimension: "2d",
    fits: "story, word, drawing and thoughtful puzzle games with a handmade feel",
    palette: {
      background: "#f6efe0",
      backgroundAlt: "#fbf7ee",
      surface: "#fffaf0",
      primary: "#2b4c7e",
      secondary: "#c0392b",
      accent: "#e1a73b",
      danger: "#a8322d",
      success: "#4d7c4a",
      text: "#2a2420",
      textMuted: "#7d6e60",
      outline: "#2a2420",
    },
    fonts: { display: { family: "Caveat Brush", weights: ["400"] }, body: { family: "Patrick Hand", weights: ["400"] } },
    pixelArt: false,
    look: { bloom: 0, bloomThreshold: 1, vignette: 0.3, saturation: 0.95, contrast: 1.05, outline: 3, corner: 8, shadow: 0.15 },
    artPrompt:
      "hand-drawn ink illustration on warm paper, loose confident pen lines, watercolor washes in muted blue red and ochre, sketchbook style",
    rules: [
      "Everything looks drawn: wobbly lines are fine, perfect geometry is not.",
      "Warm paper background everywhere; color is used sparingly as washes.",
    ],
    kenney: ["particle-pack", "input-prompts"],
    sprites: "flux",
  },
  {
    id: "space-sci-fi",
    name: "Space sci-fi",
    dimension: "2d",
    fits: "space shooters, asteroid and station games with a sleek sci-fi feel",
    palette: {
      background: "#05070f",
      backgroundAlt: "#0e1730",
      surface: "#16213e",
      primary: "#4cc9f0",
      secondary: "#f77f00",
      accent: "#fcbf49",
      danger: "#e63946",
      success: "#80ed99",
      text: "#e8f1ff",
      textMuted: "#8aa2c8",
      outline: "#02030a",
    },
    fonts: { display: { family: "Rajdhani", weights: ["600", "700"] }, body: { family: "Rajdhani", weights: ["400", "500"] } },
    pixelArt: false,
    look: { bloom: 0.6, bloomThreshold: 0.6, vignette: 0.4, saturation: 1.05, contrast: 1.08, outline: 2, corner: 6, shadow: 0.4 },
    artPrompt:
      "sleek sci-fi space art, detailed metallic spaceships with orange and blue engine glow, deep space with nebula and distant stars, cinematic lighting",
    rules: ["Engines and weapons glow; hulls stay metallic and readable.", "Angular UI with thin lines and small corner radius."],
    kenney: ["space-shooter-remastered", "particle-pack", "input-prompts"],
    sprites: "flux",
  },
  {
    id: "low-poly-3d",
    name: "Low-poly 3D",
    dimension: "3d",
    fits: "3D racing, flying, exploration and adventure games",
    palette: {
      background: "#ffcf9a",
      backgroundAlt: "#ff8e72",
      surface: "#2d2342",
      primary: "#ff6b6b",
      secondary: "#4ecdc4",
      accent: "#ffe66d",
      danger: "#e63946",
      success: "#7bd389",
      text: "#ffffff",
      textMuted: "#ffe2c6",
      outline: "#2d2342",
    },
    fonts: { display: { family: "Russo One", weights: ["400"] }, body: { family: "Nunito", weights: ["400", "700"] } },
    pixelArt: false,
    look: { bloom: 0.35, bloomThreshold: 0.75, vignette: 0.3, saturation: 1.1, contrast: 1.05, outline: 0, corner: 12, shadow: 0.3 },
    artPrompt:
      "low-poly 3D render, flat-shaded facets, warm sunset lighting, soft fog, simple geometric landscapes, stylized and colorful",
    rules: ["Flat shading, no textures on terrain; color carries the mood.", "Warm key light, cool fill, distance fog in the sky color."],
    kenney: ["car-kit", "racing-kit", "nature-kit", "particle-pack"],
    sprites: "kenney",
  },
  {
    id: "toy-3d",
    name: "Toy box 3D",
    dimension: "3d",
    fits: "3D kids games, toy cars, platformers and playful arcade in 3D",
    palette: {
      background: "#8fd3ff",
      backgroundAlt: "#d6f0ff",
      surface: "#ffffff",
      primary: "#ff5d5d",
      secondary: "#3d9df3",
      accent: "#ffcc29",
      danger: "#e63946",
      success: "#4cc36b",
      text: "#ffffff",
      textMuted: "#e9f6ff",
      outline: "#24344d",
    },
    fonts: { display: { family: "Baloo 2", weights: ["700", "800"] }, body: { family: "Nunito", weights: ["400", "700"] } },
    pixelArt: false,
    look: { bloom: 0.15, bloomThreshold: 0.85, vignette: 0.15, saturation: 1.15, contrast: 1, outline: 4, corner: 22, shadow: 0.3 },
    artPrompt: "glossy toy-like 3D render, chunky rounded plastic shapes, bright primary colors, soft studio lighting, miniature diorama",
    rules: ["Chunky, rounded, glossy: everything looks like a toy.", "Soft shadows under every object so it sits on the ground."],
    kenney: ["car-kit", "platformer-kit", "particle-pack"],
    sprites: "kenney",
  },
];

export const GAME_STYLE_BY_ID: Record<string, GameStyle> = Object.fromEntries(GAME_STYLES.map((s) => [s.id, s]));
