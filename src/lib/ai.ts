import "server-only";
import { createAzure } from "@ai-sdk/azure";
import { availableModels, DEFAULT_MODEL } from "@/lib/models";

export function aiConfigured() {
  return Boolean((process.env.AZURE_RESOURCE_NAME || process.env.AZURE_BASE_URL) && process.env.AZURE_API_KEY);
}

let provider: ReturnType<typeof createAzure> | null = null;

function azure() {
  if (!aiConfigured()) {
    throw new Error(
      "Azure AI Foundry is not configured. Set AZURE_RESOURCE_NAME (or AZURE_BASE_URL) and AZURE_API_KEY.",
    );
  }
  provider ??= createAzure({
    resourceName: process.env.AZURE_BASE_URL ? undefined : process.env.AZURE_RESOURCE_NAME,
    baseURL: process.env.AZURE_BASE_URL || undefined,
    apiKey: process.env.AZURE_API_KEY,
  });
  return provider;
}

export function modelFor(deployment: string) {
  return azure()(deployment);
}

export const chatModelId = () => process.env.AZURE_CHAT_DEPLOYMENT || DEFAULT_MODEL;
export const structuredModelId = () => process.env.AZURE_STRUCTURED_DEPLOYMENT || DEFAULT_MODEL;
export const plannerModelId = () => process.env.AZURE_PLANNER_DEPLOYMENT || DEFAULT_MODEL;

function offered(choice: string | null | undefined) {
  return choice && availableModels().some((m) => m.id === choice) ? choice : null;
}

export function builderModelId(choice?: string | null, opts: { fixing?: boolean } = {}) {
  const picked = offered(choice);
  if (picked) return picked;
  if (opts.fixing) return process.env.AZURE_BUILDER_FIX_DEPLOYMENT || process.env.AZURE_BUILDER_DEPLOYMENT || DEFAULT_MODEL;
  return process.env.AZURE_BUILDER_DEPLOYMENT || DEFAULT_MODEL;
}

const EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
export type ReasoningEffort = (typeof EFFORTS)[number];

function configuredEffort(): ReasoningEffort {
  const value = process.env.AZURE_REASONING_EFFORT as ReasoningEffort | undefined;
  return value && EFFORTS.includes(value) ? value : "max";
}

function effortFor(deployment: string, effort: ReasoningEffort): ReasoningEffort | undefined {
  if (/^gpt-[34]/i.test(deployment)) return undefined;
  if (/^gpt-[6-9]/i.test(deployment)) return effort === "minimal" ? "low" : effort;
  return effort === "xhigh" || effort === "max" ? "high" : effort;
}

const REASONING_HEADROOM: Record<ReasoningEffort, number> = {
  none: 0,
  minimal: 2_000,
  low: 4_000,
  medium: 8_000,
  high: 16_000,
  xhigh: 24_000,
  max: 32_000,
};

export function callSettings(deployment: string, answerTokens: number, azure: Record<string, string> = {}) {
  const effort = effortFor(deployment, configuredEffort());
  return {
    maxOutputTokens: answerTokens + (effort ? REASONING_HEADROOM[effort] : 0),
    providerOptions: { azure: { store: false, ...(effort ? { reasoningEffort: effort } : {}), ...azure } },
  };
}
