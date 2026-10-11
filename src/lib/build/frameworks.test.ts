import { describe, expect, it } from "vitest";
import { fill, frameworkFiles, packageJson, prepareFrameworkFiles, readMarker } from "./frameworks";

describe("fill", () => {
  it("escapes values for code and inserts them as-is in Markdown", () => {
    expect(fill('title: "{{name}}"', { name: 'Say "hi"' })).toBe('title: "Say \\"hi\\""');
    expect(fill("# {{name}}", { name: 'Say "hi"' }, true)).toBe('# Say "hi"');
    expect(fill("{{missing}}", {})).toBe("{{missing}}");
  });
});

describe("frameworkFiles", () => {
  it("assembles a Phaser game with its rules, docs and lint-gated build", () => {
    const files = frameworkFiles({ framework: "game2d", database: false, slug: "rabbit-run", vars: { name: "Rabbit Run", vision: "v", lang: "de", storage: "Nothing is stored." } });
    expect(files["game/scenes/play.ts"]).toContain("class PlayScene");
    expect(files["AGENTS.md"]).toContain("# Building Rabbit Run");
    expect(files["AGENTS.md"]).toContain("Nothing is stored.");
    expect(files["eslint-rules/no-comments.mjs"]).toContain("Comments are banned");
    expect(files["docs/skills/phaser/filters-and-postfx.md"]).toContain("AddEffectBloom");
    expect(files["app/layout.tsx"]).toContain('lang="de"');
    expect(JSON.parse(files["package.json"]).scripts.build).toBe("eslint . --max-warnings 0 && next build");
    expect(Object.keys(files).some((f) => f.endsWith(".test.ts"))).toBe(false);
  });

  it("assembles a Three.js game whose menus live in the HUD, styled by the palette", () => {
    const files = frameworkFiles({ framework: "game3d", database: false, slug: "orbit", vars: { name: "Orbit", vision: "v", lang: "en", storage: "Local." } });
    const pkg = JSON.parse(files["package.json"]);
    expect(pkg.dependencies).toMatchObject({ three: expect.any(String), postprocessing: expect.any(String) });
    expect(pkg.dependencies.phaser).toBeUndefined();
    expect(files["components/hud.tsx"]).toContain("useSyncExternalStore");
    expect(files["app/globals.css"]).toContain("--color-game-primary: var(--game-primary)");
    expect(files["app/palette.css"]).toContain("--game-text-muted:");
    expect(files["eslint.kind.mjs"]).toContain("components/hud.tsx");
    expect(files["game/probe.ts"]).toContain("__GAME__");
    expect(Object.keys(files).some((f) => f.startsWith("docs/skills/phaser"))).toBe(false);
  });

  it("adds the database layer and driver only when the app stores data", () => {
    const files = frameworkFiles({ framework: "web", database: true, slug: "club", vars: { name: "Club", storage: "Neon." } });
    expect(files["lib/db.ts"]).toContain("neon(process.env.DATABASE_URL!)");
    expect(JSON.parse(files["package.json"]).dependencies["@neondatabase/serverless"]).toBeDefined();
    expect(JSON.parse(packageJson({ slug: "x", framework: "web", database: false })).dependencies["@neondatabase/serverless"]).toBeUndefined();
  });
});

describe("prepareFrameworkFiles", () => {
  const starter = frameworkFiles({ framework: "starter", database: false, slug: "club", vars: { name: "Club", vision: "v", lang: "en" } });

  it("turns the starter into the framework once and records it", () => {
    const files = prepareFrameworkFiles({ before: starter, framework: "game2d", database: false, slug: "club", vars: { name: "Club", lang: "en" } });
    expect(files["game/main.ts"]).toContain("startGame");
    expect(readMarker(files)).toMatchObject({ framework: "game2d", database: false });
    expect(files["AGENTS.md"]).toContain("best score and settings live in `game/storage.ts`");
  });

  it("keeps the agents' code on later rounds and only adds the database when it becomes needed", () => {
    const first = prepareFrameworkFiles({ before: starter, framework: "web", database: false, slug: "club", vars: { name: "Club" } });
    const edited = { ...first, "app/page.tsx": "export default function Page() { return null; }" };
    const second = prepareFrameworkFiles({ before: edited, framework: "web", database: true, slug: "club", vars: { name: "Club" } });
    expect(second["app/page.tsx"]).toBe(edited["app/page.tsx"]);
    expect(second["lib/db.ts"]).toBeDefined();
    expect(JSON.parse(second["package.json"]).dependencies["@neondatabase/serverless"]).toBeDefined();
    expect(readMarker(second).database).toBe(true);
  });
});
