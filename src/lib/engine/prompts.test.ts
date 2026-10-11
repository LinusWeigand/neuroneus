import { describe, expect, it } from "vitest";
import type { MessageDTO } from "@/lib/types";
import { formatTranscript } from "./prompts";

const message = (seq: number, content: string, authorType: MessageDTO["authorType"] = "user"): MessageDTO => ({
  id: String(seq),
  seq,
  authorType,
  agentId: authorType === "agent" ? "nova" : null,
  kind: "chat",
  content,
  data: null,
  createdAt: new Date(0).toISOString(),
});

describe("formatTranscript", () => {
  it("names speakers by role", () => {
    const text = formatTranscript([message(1, "hello"), message(2, "scope it down", "agent")]);
    expect(text).toBe("Human: hello\n\nNova (Product Lead): scope it down");
  });

  it("keeps the newest messages within the budget and says something was left out", () => {
    const messages = Array.from({ length: 50 }, (_, i) => message(i, `message ${i} ${"x".repeat(80)}`));
    const text = formatTranscript(messages, 1000);
    expect(text.length).toBeLessThanOrEqual(1100);
    expect(text.startsWith("[earlier messages omitted]")).toBe(true);
    expect(text).toContain("message 49");
    expect(text).not.toContain("message 0 ");
  });
});
