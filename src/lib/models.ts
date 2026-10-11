export type ModelId = string;

export type ModelOption = {
  id: ModelId;
  label: string;
  hint: "default" | "fast" | "strong" | "stronger" | "newest";
};

export const MODEL_CATALOG: ModelOption[] = [
  { id: "gpt-6-luna", label: "GPT-6 Luna", hint: "default" },
  { id: "gpt-5.4-mini", label: "GPT-5.4 mini", hint: "fast" },
  { id: "gpt-5.4", label: "GPT-5.4", hint: "strong" },
  { id: "gpt-5.5", label: "GPT-5.5", hint: "stronger" },
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna", hint: "newest" },
  { id: "gpt-5.6-sol", label: "GPT-5.6 Sol", hint: "newest" },
  { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", hint: "newest" },
];

export const DEFAULT_MODEL = "gpt-6-luna";

export function availableModels(env = process.env.AZURE_MODEL_DEPLOYMENTS): ModelOption[] {
  if (!env) return MODEL_CATALOG;
  return env
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => MODEL_CATALOG.find((m) => m.id === id) ?? { id, label: id, hint: "strong" as const });
}

export function modelLabel(id: string | undefined, models: ModelOption[] = MODEL_CATALOG) {
  if (!id) return null;
  return models.find((m) => m.id === id)?.label ?? id;
}
