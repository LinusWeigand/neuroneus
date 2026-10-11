import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CANVAS_COLOR } from "./brand";

describe("brand", () => {
  it("keeps the browser theme color in step with the canvas token in globals.css", () => {
    const css = fs.readFileSync(path.join(import.meta.dirname, "../app/globals.css"), "utf8");
    expect(css).toContain(`--color-canvas: ${CANVAS_COLOR};`);
  });
});
