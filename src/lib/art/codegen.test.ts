import { describe, expect, it } from "vitest";
import { assetsTs, fontExportName, fontsTs, paletteCss, paletteTs, textTs } from "./codegen";
import { GAME_STYLE_BY_ID, GAME_STYLES } from "./styles";

describe("game style catalog", () => {
  it("gives every style a full palette of six-digit hex colors and fonts", () => {
    for (const style of GAME_STYLES) {
      expect(Object.keys(style.palette).sort()).toEqual(
        ["accent", "background", "backgroundAlt", "danger", "outline", "primary", "secondary", "success", "surface", "text", "textMuted"],
      );
      for (const color of Object.values(style.palette)) expect(color).toMatch(/^#[0-9a-f]{6}$/);
      expect(style.fonts.display.weights.length).toBeGreaterThan(0);
    }
  });
});

describe("codegen", () => {
  const neon = GAME_STYLE_BY_ID["neon-synthwave"];

  it("maps Google font families to next/font export names", () => {
    expect(fontExportName("Press Start 2P")).toBe("Press_Start_2P");
    expect(fontExportName("Exo 2")).toBe("Exo_2");
  });

  it("imports a font once when display and body share it", () => {
    const code = fontsTs(GAME_STYLE_BY_ID["flat-geometric"]);
    expect(code).toContain('import { Outfit } from "next/font/google";');
    expect(code.match(/Outfit\(/g)).toHaveLength(2);
  });

  it("writes the palette, look and pixel-art switch as typed constants", () => {
    const code = paletteTs(neon);
    expect(code).toContain('  primary: "#3df5ff",');
    expect(code).toContain("export const PIXEL_ART = false;");
    expect(code).toContain("  bloom: 0.8,");
    expect(paletteCss(neon)).toContain("--game-background-alt: #1c1145;");
  });

  it("produces an asset manifest the game can load by key", () => {
    const code = assetsTs([{ key: "player", path: "/assets/art/player.png" }], [{ key: "coin", path: "/assets/k/coin.png", frameWidth: 16, frameHeight: 16 }]);
    expect(code).toContain('"player": "/assets/art/player.png",');
    expect(code).toContain('"coin": { url: "/assets/k/coin.png", frameWidth: 16, frameHeight: 16 },');
    expect(assetsTs([])).toContain("export const IMAGES = {} as const");
  });

  it("escapes in-game text", () => {
    expect(textTs({ title: 'Say "hi"' })).toContain('title: "Say \\"hi\\"",');
  });
});
