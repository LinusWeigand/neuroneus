import { describe, expect, it } from "vitest";
import { AGENT_BY_ID } from "@/lib/agents";
import type { DecisionCard } from "@/lib/types";
import { kindCard, normalizeCard, sanitizeAnswers } from "./card";
import { RunInputError } from "./errors";

const team = [AGENT_BY_ID.nova, AGENT_BY_ID.atlas];

describe("normalizeCard", () => {
  it("keeps exactly one recommended option and lists it first", () => {
    const card = normalizeCard(
      {
        summary: "Pick sharing",
        questions: [
          {
            header: "Sharing",
            question: "How do flatmates join?",
            options: [
              { label: "Email invite", description: "Slower", recommended: false, championedBy: ["atlas"] },
              { label: "Share link", description: "Fast", recommended: true, championedBy: ["nova", "ghost"] },
              { label: "QR code", description: "In person", recommended: true, championedBy: [] },
            ],
          },
        ],
      },
      team,
    );
    expect(card?.questions[0].options.map((o) => [o.label, o.recommended])).toEqual([
      ["Share link", true],
      ["Email invite", false],
      ["QR code", false],
    ]);
    expect(card?.questions[0].options[0].championedBy).toEqual(["nova"]);
  });

  it("drops questions without two real options and returns null when nothing is left", () => {
    expect(
      normalizeCard(
        { summary: "x", questions: [{ header: "H", question: "Q?", options: [{ label: "Only", description: "", recommended: true, championedBy: [] }] }] },
        team,
      ),
    ).toBeNull();
  });

  it("pins spec questions to their spec point ids", () => {
    const card = normalizeCard(
      {
        summary: "s",
        questions: [
          { header: "Goal", question: "Win how?", options: [{ label: "A", description: "", recommended: true, championedBy: [] }, { label: "B", description: "", recommended: false, championedBy: [] }] },
          { header: "Extra", question: "Unasked?", options: [{ label: "A", description: "", recommended: true, championedBy: [] }, { label: "B", description: "", recommended: false, championedBy: [] }] },
        ],
      },
      team,
      ["spec:goal"],
    );
    expect(card?.questions.map((q) => q.id)).toEqual(["spec:goal"]);
  });

  it("clips long text to the card's limits", () => {
    const card = normalizeCard(
      {
        summary: "s",
        questions: [{ header: "A very long header indeed", question: "Q?", options: [{ label: "x".repeat(100), description: "", recommended: true, championedBy: [] }, { label: "B", description: "", recommended: false, championedBy: [] }] }],
      },
      team,
    );
    expect(card?.questions[0].header.length).toBeLessThanOrEqual(16);
    expect(card?.questions[0].options[0].label.length).toBe(60);
  });
});

describe("sanitizeAnswers", () => {
  const card: DecisionCard = {
    type: "decision_card",
    status: "pending",
    summary: "s",
    questions: [
      { id: "q1", header: "Sharing", question: "How?", options: [{ label: "Link", description: "", recommended: true, championedBy: [] }, { label: "Email", description: "", recommended: false, championedBy: [] }] },
    ],
  };

  it("marks picked options and the human's own answers", () => {
    expect(sanitizeAnswers(card, [{ questionId: "q1", header: "", question: "", choice: "Link", isCustom: false, wasRecommended: false }])[0]).toMatchObject({ isCustom: false, wasRecommended: true });
    expect(sanitizeAnswers(card, [{ questionId: "q1", header: "", question: "", choice: "Carrier pigeon", isCustom: false, wasRecommended: false }])[0]).toMatchObject({ isCustom: true, wasRecommended: false });
  });

  it("refuses a card with an unanswered question", () => {
    expect(() => sanitizeAnswers(card, [])).toThrow(RunInputError);
  });
});

describe("kindCard", () => {
  it("asks in the human's language and carries machine values", () => {
    const de = kindCard("German");
    expect(de.questions[0].question).toBe("Ist das eine Web-App oder ein Web-Spiel?");
    expect(de.questions[0].options.map((o) => o.value)).toEqual(["web_app", "web_game"]);
    expect(kindCard("English").questions[0].header).toBe("App or game");
  });
});
