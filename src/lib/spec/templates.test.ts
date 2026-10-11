import { describe, expect, it } from "vitest";
import { EMPTY_SPEC, openSpecPoints, type ProjectSpec, specComplete, specProgress, specText, WEB_GAME_SPEC } from "./templates";

const answered = (keys: string[]): ProjectSpec["answers"] =>
  Object.fromEntries(keys.map((k) => [k, { value: `answer for ${k}`, source: "chat" as const }]));

describe("spec templates", () => {
  it("asks app-or-game before anything else", () => {
    expect(openSpecPoints(null)).toEqual(["kind"]);
    expect(openSpecPoints(EMPTY_SPEC)).toEqual(["kind"]);
  });

  it("lists open required points in priority order and skips optional ones", () => {
    const spec: ProjectSpec = { kind: "web_game", answers: answered(["pitch", "goal"]), needsDatabase: null };
    expect(openSpecPoints(spec)).toEqual([
      "core_loop",
      "controls",
      "mechanics",
      "progression",
      "feedback",
      "visual_style",
      "players_saving",
      "out_of_scope",
    ]);
  });

  it("treats blank answers as open", () => {
    const spec: ProjectSpec = { kind: "web_game", answers: { pitch: { value: "  ", source: "chat" } }, needsDatabase: null };
    expect(openSpecPoints(spec)[0]).toBe("pitch");
  });

  it("is complete once every required point is answered", () => {
    const required = WEB_GAME_SPEC.filter((i) => i.required).map((i) => i.key);
    const spec: ProjectSpec = { kind: "web_game", answers: answered(required), needsDatabase: false };
    expect(specComplete(spec)).toBe(true);
    expect(specProgress(spec)).toEqual({ answered: 10, total: 10 });
  });

  it("renders open points as (open) with the given labels", () => {
    const spec: ProjectSpec = { kind: "web_app", answers: answered(["problem"]), needsDatabase: null };
    const text = specText(spec, { problem: "Problem", users: "Users" });
    expect(text).toContain("Kind: web app");
    expect(text).toContain("- Problem: answer for problem");
    expect(text).toContain("- Users: (open)");
  });
});
