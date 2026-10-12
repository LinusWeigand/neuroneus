import { describe, expect, it } from "vitest";
import { KENNEY_PACKS } from "./library";
import { GAME_STYLES } from "./styles";

describe("GAME_STYLES", () => {
  it("only names library packs that exist", () => {
    const known = new Set(KENNEY_PACKS.map((p) => p.slug));
    for (const style of GAME_STYLES) expect(style.kenney.filter((p) => !known.has(p))).toEqual([]);
  });

  it("gives every 3D style characters and animals to cast as the player", () => {
    for (const style of GAME_STYLES.filter((s) => s.dimension === "3d")) expect(style.kenney).toEqual(expect.arrayContaining(["cube-pets", "blocky-characters"]));
  });
});
