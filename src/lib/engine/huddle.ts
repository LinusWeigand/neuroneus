import type { AgentDef } from "@/lib/agents";
import type { Mode } from "./prompts";

export const FALLBACK_FOCUS = "Add the one point from your area the others missed. Challenge anything you disagree with.";

export type Turn = { agent: AgentDef; focus: string };
export type PlannedTurn = { agentId: string; focus: string };
export type HuddleShape = { maxTurns: number; required: AgentDef[] };

export function huddleShape(mode: Exclude<Mode, "ack">, team: AgentDef[], mentioned: AgentDef[]): HuddleShape {
  if (mode === "open") return { maxTurns: team.length + (team.length >= 3 ? 1 : 0), required: team };
  if (mode === "direct") return { maxTurns: Math.min(team.length, mentioned.length + 1), required: mentioned };
  return { maxTurns: Math.min(3, team.length), required: [] };
}

export function ackTurn(team: AgentDef[], specJustCompleted: boolean): Turn {
  const lead = ["nova", "atlas"].map((id) => team.find((a) => a.id === id)).find((a): a is AgentDef => Boolean(a)) ?? team[0];
  return {
    agent: lead,
    focus: specJustCompleted
      ? "Confirm in one or two sentences that the spec is complete, the team starts building now, and what the human sees first."
      : "Confirm in one or two sentences what the human just settled and what the team does next.",
  };
}

export function arrangeTurns(args: {
  mode: Exclude<Mode, "ack">;
  team: AgentDef[];
  mentioned: AgentDef[];
  planned: PlannedTurn[];
  shape: HuddleShape;
}): Turn[] {
  const { mode, team, mentioned, planned } = args;
  const { maxTurns, required } = args.shape;
  const turns: Turn[] = [];
  const spoken = (agent: AgentDef) => turns.some((t) => t.agent.id === agent.id);
  const add = (agent: AgentDef | undefined, focus: string) => {
    if (!agent || turns.length >= maxTurns || turns.at(-1)?.agent.id === agent.id) return;
    if (turns.filter((t) => t.agent.id === agent.id).length >= 2) return;
    turns.push({ agent, focus: focus.trim() || FALLBACK_FOCUS });
  };
  if (mode === "direct") {
    for (const agent of mentioned) add(agent, planned.find((p) => p.agentId === agent.id)?.focus ?? FALLBACK_FOCUS);
  }
  for (const p of planned) {
    const agent = team.find((a) => a.id === p.agentId);
    const missing = required.filter((r) => r.id !== agent?.id && !spoken(r));
    if (agent && !required.includes(agent) && missing.length >= maxTurns - turns.length) continue;
    if (agent && mode === "open" && spoken(agent) && missing.length > 0) continue;
    add(agent, p.focus);
  }
  for (const agent of required) if (!spoken(agent)) add(agent, FALLBACK_FOCUS);
  if (turns.length === 0) add(team[0], FALLBACK_FOCUS);
  return turns;
}

export function parseMentions(content: string, team: AgentDef[]) {
  if (/@(all|team|everyone)\b/i.test(content)) return [];
  return team.filter((a) => new RegExp(`@${a.name}\\b`, "i").test(content));
}
