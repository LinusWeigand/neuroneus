import { z } from "zod";
import type { AgentDef } from "@/lib/agents";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import type { DecisionAnswer, DecisionCard, DecisionQuestion } from "@/lib/types";
import { RunInputError } from "./errors";

export const synthesisSchema = z.object({
  summary: z.string(),
  questions: z.array(
    z.object({
      header: z.string(),
      question: z.string(),
      options: z.array(
        z.object({
          label: z.string(),
          description: z.string(),
          recommended: z.boolean(),
          championedBy: z.array(z.string()),
        }),
      ),
    }),
  ),
});

export type RawCard = z.infer<typeof synthesisSchema>;

export function clip(s: string, n: number) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
}

export function normalizeCard(raw: RawCard, team: AgentDef[], ids?: string[]): DecisionCard | null {
  const teamIds = new Set(team.map((a) => a.id));
  const questions: DecisionQuestion[] = raw.questions
    .map((q, i) => {
      const options = q.options
        .filter((o) => o.label.trim())
        .slice(0, 3)
        .map((o) => ({
          label: clip(o.label, 60),
          description: clip(o.description, 200),
          recommended: o.recommended,
          championedBy: [...new Set(o.championedBy.filter((id) => teamIds.has(id)))],
        }));
      const recommended = Math.max(0, options.findIndex((o) => o.recommended));
      options.forEach((o, j) => (o.recommended = j === recommended));
      if (options.length) options.unshift(...options.splice(recommended, 1));
      return {
        id: ids?.[i] ?? `q${i + 1}`,
        header: clip(q.header, 16),
        question: clip(q.question, 240),
        options,
      };
    })
    .slice(0, ids ? ids.length : 3)
    .filter((q) => q.question && q.options.length >= 2);

  if (questions.length === 0) return null;
  return { type: "decision_card", status: "pending", summary: clip(raw.summary, 280), questions };
}

export function sanitizeAnswers(card: DecisionCard, answers: DecisionAnswer[]): DecisionAnswer[] {
  return card.questions.map((q) => {
    const choice = answers.find((x) => x.questionId === q.id)?.choice?.trim();
    if (!choice) throw new RunInputError("missingAnswer", q.header);
    const option = q.options.find((o) => o.label === choice);
    return {
      questionId: q.id,
      header: q.header,
      question: q.question,
      choice: clip(choice, 500),
      isCustom: !option,
      wasRecommended: Boolean(option?.recommended),
      value: option?.value,
    };
  });
}

export function kindCard(language: "German" | "English"): DecisionCard {
  const copy = DICTIONARIES[language === "German" ? "de" : "en"].spec.kindCard;
  return {
    type: "decision_card",
    status: "pending",
    summary: copy.summary,
    questions: [
      {
        id: "spec:kind",
        header: copy.header,
        question: copy.question,
        options: [
          { label: copy.app.label, value: "web_app", description: copy.app.description, recommended: false, championedBy: [] },
          { label: copy.game.label, value: "web_game", description: copy.game.description, recommended: false, championedBy: [] },
        ],
      },
    ],
  };
}
