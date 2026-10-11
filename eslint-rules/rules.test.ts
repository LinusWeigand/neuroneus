import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import { describe, it } from "vitest";
import rules from "./index.mjs";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

tester.run("no-comments", rules.rules["no-comments"], {
  valid: [
    "const a = 1;",
    "// eslint-disable-next-line no-console -- debug output (until 2099-01-01)\nconsole.log(1);",
    "// @ts-expect-error the vendor types miss this field\nconst b = 2;",
    '/// <reference types="node" />\nconst c = 3;',
  ],
  invalid: [
    {
      code: "// Exactly one recommended option, always listed first.\nconst a = 1;",
      output: "const a = 1;",
      errors: [{ messageId: "comment" }],
    },
    {
      code: "type P = {\n  /** The live app, deployed to Vercel. */\n  appUrl: string;\n};",
      output: "type P = {\n  appUrl: string;\n};",
      errors: [{ messageId: "comment" }],
    },
    { code: "const a = 1; // the answer", output: "const a = 1;", errors: [{ messageId: "comment" }] },
    {
      code: "const el = (\n  <div>\n    {/* while the team works */}\n    <p />\n  </div>\n);",
      output: "const el = (\n  <div>\n    <p />\n  </div>\n);",
      errors: [{ messageId: "comment" }],
    },
    { code: "f(a /* first */, b);", output: "f(a , b);", errors: [{ messageId: "comment" }] },
  ],
});

tester.run("disable-needs-reason", rules.rules["disable-needs-reason"], {
  valid: [
    { code: "// eslint-disable-next-line no-console -- prints the run id (until 2026-12-31)\nconsole.log(1);", options: [{ today: "2026-10-11" }] },
  ],
  invalid: [
    { code: "// eslint-disable-next-line no-console\nconsole.log(1);", options: [{ today: "2026-10-11" }], errors: [{ messageId: "missing" }] },
    { code: "// eslint-disable-next-line no-console -- debug\nconsole.log(1);", options: [{ today: "2026-10-11" }], errors: [{ messageId: "missing" }] },
    {
      code: "// eslint-disable-next-line no-console -- prints the run id (until 2026-01-31)\nconsole.log(1);",
      options: [{ today: "2026-10-11" }],
      errors: [{ messageId: "expired" }],
    },
  ],
});

tester.run("no-hex-colors", rules.rules["no-hex-colors"], {
  valid: ['const a = <div className="bg-canvas text-ink" />;', 'const issue = "see #12";', "const anchor = '#section';"],
  invalid: [
    { code: 'const a = <div style={{ color: "#0c0a09" }} />;', errors: [{ messageId: "hex" }] },
    { code: 'const a = <div className="bg-[#f5f5f5]" />;', errors: [{ messageId: "hex" }] },
    { code: "const shadow = `0 0 0 1px #fff`;", errors: [{ messageId: "hex" }] },
  ],
});

tester.run("no-jsx-text", rules.rules["no-jsx-text"], {
  valid: ["const a = <span>{t.app.open}</span>;", "const e = <p>{\" \"}</p>;", "const b = <span aria-hidden>↗</span>;", "const c = <span>· {count}</span>;"],
  invalid: [
    { code: "const a = <h2>Decisions</h2>;", errors: [{ messageId: "text" }] },
    { code: 'const b = <button aria-label="Close">x</button>;', errors: [{ messageId: "text" }, { messageId: "text" }] },
    { code: 'const c = <input placeholder="Schreib dem Team" />;', errors: [{ messageId: "text" }] },
    { code: 'const d = <p>{"Something else…"}</p>;', errors: [{ messageId: "text" }] },
  ],
});

tester.run("client-server-boundary", rules.rules["client-server-boundary"], {
  valid: [
    '"use client";\nimport { AGENT_BY_ID } from "@/lib/agents";',
    '"use client";\nimport type { ProjectRow } from "@/lib/db/schema";',
    'import { db } from "@/lib/db";',
  ],
  invalid: [
    { code: '"use client";\nimport { db } from "@/lib/db";', errors: [{ messageId: "boundary" }] },
    { code: '"use client";\nimport { builderModelId } from "@/lib/ai";', errors: [{ messageId: "boundary" }] },
  ],
});

tester.run("no-heavy-build-reads", rules.rules["no-heavy-build-reads"], {
  valid: [
    "db.select(LIGHT).from(schema.builds);",
    "db.select().from(schema.projects);",
    { code: "db.select({ data: schema.buildBlobs.data }).from(schema.buildBlobs);", filename: "/repo/src/lib/build/blobs.ts" },
  ],
  invalid: [
    {
      code: "const [row] = await db.select().from(schema.builds).where(eq(schema.builds.projectId, projectId));",
      errors: [{ messageId: "fullRow" }],
    },
    { code: "await db.delete(schema.buildBlobs);", filename: "/repo/src/lib/build/engine.ts", errors: [{ messageId: "blobs" }] },
  ],
});

tester.run("model-calls-use-call-settings", rules.rules["model-calls-use-call-settings"], {
  valid: ["generateText({ model, prompt, ...callSettings(id, 600) });"],
  invalid: [
    {
      code: 'streamText({ model, prompt, reasoning: "low", maxOutputTokens: 300, providerOptions: { azure: { store: false } } });',
      errors: [{ messageId: "missing" }, { messageId: "owned" }, { messageId: "owned" }, { messageId: "owned" }],
    },
    { code: "generateText({ model, prompt });", errors: [{ messageId: "missing" }] },
  ],
});
