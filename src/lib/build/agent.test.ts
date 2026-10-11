import type { ModelMessage } from "ai";
import { describe, expect, it } from "vitest";
import { codeMap, compact } from "./agent";

const call = (id: string, toolName: string, input: Record<string, unknown>): ModelMessage => ({
  role: "assistant",
  content: [{ type: "tool-call", toolCallId: id, toolName, input }],
});
const result = (id: string, toolName: string, value: string): ModelMessage => ({
  role: "tool",
  content: [{ type: "tool-result", toolCallId: id, toolName, output: { type: "text", value } }],
});
const output = (m: ModelMessage) => (m.role === "tool" ? JSON.stringify(m.content[0]) : "");

describe("compact", () => {
  const big = "x".repeat(5000);
  const conversation: ModelMessage[] = [
    { role: "user", content: "go" },
    call("1", "read_files", { paths: ["app/page.tsx"] }),
    result("1", "read_files", big),
    call("2", "edit_file", { path: "app/page.tsx", find: "a", replace: "b" }),
    result("2", "edit_file", "ok"),
    call("3", "read_file", { path: "lib/x.ts" }),
    result("3", "read_file", big),
    call("4", "write_file", { path: "c.ts", content: big }),
    result("4", "write_file", "Wrote"),
    ...Array.from({ length: 4 }, (_, i) => [call(`s${i}`, "search", { query: "q" }), result(`s${i}`, "search", "none")]).flat(),
  ];

  it("leaves short conversations untouched, so the prompt cache keeps working", () => {
    expect(compact(conversation)).toBe(conversation);
  });

  it("drops file contents that went stale and the payload of written files", () => {
    const compacted = compact(conversation, true);
    expect(output(compacted[2])).toContain("changed or read again later");
    expect(output(compacted[6])).toContain(big);
    const write = compacted[7];
    expect(write.role === "assistant" && Array.isArray(write.content) && write.content[0].type === "tool-call" && write.content[0].input).toEqual({
      path: "c.ts",
      content: "[5000 characters written; read the file to see them]",
    });
    expect(JSON.stringify(compacted).length).toBeLessThan(JSON.stringify(conversation).length / 2);
  });
});

describe("codeMap", () => {
  it("lists every file with its size and what code files export", () => {
    const map = codeMap({
      "app/page.tsx": "export default function Home() {}\n",
      "lib/score.ts": "export const MAX = 3;\nexport function add() {}\nexport type Score = number;\n",
      "README.md": "# hi",
    });
    expect(map.split("\n")).toEqual([
      "README.md (4)",
      "app/page.tsx (34) — default Home",
      "lib/score.ts (75) — MAX, add, Score",
    ]);
  });
});
