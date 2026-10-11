import { afterEach, describe, expect, it, vi } from "vitest";
import { builderModelId, callSettings } from "./ai";

afterEach(() => vi.unstubAllEnvs());

describe("callSettings", () => {
  it("runs GPT-6 at maximum reasoning by default with room for the reasoning", () => {
    expect(callSettings("gpt-6-luna", 600)).toEqual({
      maxOutputTokens: 32_600,
      providerOptions: { azure: { store: false, reasoningEffort: "max" } },
    });
  });

  it("sends no reasoning setting to models that don't reason", () => {
    expect(callSettings("gpt-4.1-nano", 300)).toEqual({ maxOutputTokens: 300, providerOptions: { azure: { store: false } } });
  });

  it("caps older reasoning models at the highest effort they accept", () => {
    expect(callSettings("gpt-5.4", 100).providerOptions.azure).toMatchObject({ reasoningEffort: "high" });
  });

  it("follows AZURE_REASONING_EFFORT and passes extra Azure options through", () => {
    vi.stubEnv("AZURE_REASONING_EFFORT", "low");
    expect(callSettings("gpt-6-luna", 100, { promptCacheKey: "k" })).toEqual({
      maxOutputTokens: 4_100,
      providerOptions: { azure: { store: false, reasoningEffort: "low", promptCacheKey: "k" } },
    });
  });
});

describe("builderModelId", () => {
  it("prefers the project's choice and ignores models we don't offer", () => {
    expect(builderModelId("gpt-5.5")).toBe("gpt-5.5");
    expect(builderModelId("gpt-9")).toBe("gpt-6-luna");
  });
});
