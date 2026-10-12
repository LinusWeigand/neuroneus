import { describe, expect, it } from "vitest";
import { reviewFacts, type Capture } from "./review";

const capture: Capture = {
  url: "https://lantern-drift-abc.vercel.app",
  status: 200,
  shots: [],
  probe: { scene: "play", score: 40, lives: 2, over: false, fps: 5 },
  errors: [],
  game: true,
};

describe("reviewFacts", () => {
  it("keeps the frame rate of the software-rendered preview away from the reviewer", () => {
    const facts = reviewFacts(capture);
    expect(facts).toContain('"score":40');
    expect(facts).not.toContain("fps");
    expect(facts).toContain("Never judge frame rate");
  });

  it("describes the pages and phone view for a web app", () => {
    const facts = reviewFacts({ ...capture, game: false, probe: null, errors: ["TypeError: x is undefined"] });
    expect(facts).toContain("phone (390 px)");
    expect(facts).toContain("TypeError: x is undefined");
  });
});
