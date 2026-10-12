import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { BUNDLE_PATH, readTemplateBundle } from "./template-bundle";

describe("templates.bundle.json", () => {
  it("matches templates/ on disk (run `pnpm templates:bundle` after editing a template)", () => {
    const bundled = JSON.parse(fs.readFileSync(BUNDLE_PATH, "utf8"));
    expect(bundled).toEqual(readTemplateBundle(process.cwd()));
  });
});
