import type { ProjectSpec } from "@/lib/spec/templates";
import type { Framework } from "./frameworks";

const THREE_D = /(^|[^a-z0-9])3[- ]?d([^a-z0-9]|$)|three[- ]dimensional|dreidimensional|first[- ]person|third[- ]person|ego[- ]?perspektive|verfolgerperspektive/i;

export function wants3d(spec: ProjectSpec) {
  const text = ["pitch", "visual_style", "core_loop", "controls", "mechanics"].map((k) => spec.answers[k]?.value ?? "").join(" ");
  return THREE_D.test(text);
}

export function chooseFramework(spec: ProjectSpec, name = ""): Framework {
  if (spec.kind !== "web_game") return "web";
  return wants3d(spec) || THREE_D.test(name) ? "game3d" : "game2d";
}
