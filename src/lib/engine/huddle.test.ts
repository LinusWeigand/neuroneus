import { describe, expect, it } from "vitest";
import { AGENT_BY_ID, type AgentDef } from "@/lib/agents";
import { ackTurn, arrangeTurns, FALLBACK_FOCUS, huddleShape, parseMentions } from "./huddle";

const team: AgentDef[] = ["nova", "atlas", "iris", "forge"].map((id) => AGENT_BY_ID[id]);
const ids = (turns: { agent: AgentDef }[]) => turns.map((t) => t.agent.id);

describe("arrangeTurns", () => {
  it("lets everyone speak in an open huddle even when the plan forgets someone", () => {
    const shape = huddleShape("open", team, []);
    const turns = arrangeTurns({
      mode: "open",
      team,
      mentioned: [],
      planned: [
        { agentId: "atlas", focus: "storage" },
        { agentId: "nova", focus: "scope" },
      ],
      shape,
    });
    expect(new Set(ids(turns))).toEqual(new Set(["nova", "atlas", "iris", "forge"]));
    expect(turns.length).toBeLessThanOrEqual(shape.maxTurns);
    expect(turns.find((t) => t.agent.id === "iris")?.focus).toBe(FALLBACK_FOCUS);
  });

  it("never lets an agent speak twice in a row and caps the huddle", () => {
    const shape = huddleShape("spec", team, []);
    const turns = arrangeTurns({
      mode: "spec",
      team,
      mentioned: [],
      planned: [
        { agentId: "nova", focus: "a" },
        { agentId: "nova", focus: "b" },
        { agentId: "atlas", focus: "c" },
        { agentId: "iris", focus: "d" },
        { agentId: "forge", focus: "e" },
      ],
      shape,
    });
    expect(ids(turns)).toEqual(["nova", "atlas", "iris"]);
  });

  it("puts mentioned agents first in a direct huddle", () => {
    const mentioned = [AGENT_BY_ID.forge];
    const turns = arrangeTurns({
      mode: "direct",
      team,
      mentioned,
      planned: [{ agentId: "nova", focus: "x" }, { agentId: "forge", focus: "answer the question" }],
      shape: huddleShape("direct", team, mentioned),
    });
    expect(ids(turns)).toEqual(["forge", "nova"]);
    expect(turns[0].focus).toBe("answer the question");
  });

  it("ignores ids that aren't on the team and falls back to the roster", () => {
    const turns = arrangeTurns({
      mode: "spec",
      team,
      mentioned: [],
      planned: [{ agentId: "ghost", focus: "x" }],
      shape: huddleShape("spec", team, []),
    });
    expect(ids(turns)).toEqual(["nova"]);
  });
});

describe("ackTurn", () => {
  it("gives the product lead the confirmation when present", () => {
    expect(ackTurn(team, true).agent.id).toBe("nova");
    expect(ackTurn([AGENT_BY_ID.forge, AGENT_BY_ID.kernel], false).agent.id).toBe("forge");
  });
});

describe("parseMentions", () => {
  it("finds mentioned teammates case-insensitively and treats @all as nobody in particular", () => {
    expect(parseMentions("@iris what do you think? also @FORGE", team).map((a) => a.id)).toEqual(["iris", "forge"]);
    expect(parseMentions("@all please weigh in", team)).toEqual([]);
  });
});
