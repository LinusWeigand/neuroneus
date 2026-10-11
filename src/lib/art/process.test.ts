import { describe, expect, it } from "vitest";
import { magentaAlpha } from "./process";

describe("magentaAlpha", () => {
  it("removes the magenta background and its darker shadow", () => {
    expect(magentaAlpha(255, 0, 255)).toBe(0);
    expect(magentaAlpha(230, 20, 220)).toBe(0);
    expect(magentaAlpha(160, 0, 140)).toBe(0);
  });

  it("keeps the subject, including pinks and purples that aren't the key color", () => {
    expect(magentaAlpha(244, 182, 200)).toBe(255);
    expect(magentaAlpha(61, 245, 255)).toBe(255);
    expect(magentaAlpha(255, 255, 255)).toBe(255);
    expect(magentaAlpha(30, 10, 40)).toBe(255);
  });

  it("softens the edge between subject and background", () => {
    const edge = magentaAlpha(200, 90, 200);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
  });
});
