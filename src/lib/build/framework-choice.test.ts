import { describe, expect, it } from "vitest";
import type { ProjectSpec } from "@/lib/spec/templates";
import { chooseFramework } from "./framework-choice";

const game = (answers: Record<string, string>): ProjectSpec => ({
  kind: "web_game",
  answers: Object.fromEntries(Object.entries(answers).map(([k, value]) => [k, { value, source: "chat" as const }])),
  needsDatabase: false,
});

describe("chooseFramework", () => {
  it("builds web apps on the web framework", () => {
    expect(chooseFramework({ kind: "web_app", answers: {}, needsDatabase: false })).toBe("web");
  });

  it("builds 2D games on Phaser unless the spec asks for 3D", () => {
    expect(chooseFramework(game({ pitch: "Ein Arcade-Spiel, Pixel-Art von oben" }))).toBe("game2d");
    expect(chooseFramework(game({ visual_style: "Low-poly 3D, Verfolgerperspektive" }))).toBe("game3d");
    expect(chooseFramework(game({ pitch: "A racing game" }), "3D Car Race Game")).toBe("game3d");
    expect(chooseFramework(game({ visual_style: "side view, 32px sprites" }))).toBe("game2d");
  });
});
