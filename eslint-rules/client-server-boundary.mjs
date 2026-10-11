import fs from "node:fs";
import path from "node:path";

const EXTENSIONS = ["", ".ts", ".tsx", ".mts", "/index.ts", "/index.tsx"];
const serverOnly = new Map();

function resolve(root, specifier) {
  const base = path.join(root, "src", specifier.slice(2));
  return EXTENSIONS.map((ext) => base + ext).find((file) => fs.existsSync(file) && fs.statSync(file).isFile());
}

function isServerOnly(file) {
  if (!serverOnly.has(file)) serverOnly.set(file, /^import\s+["']server-only["'];?/m.test(fs.readFileSync(file, "utf8")));
  return serverOnly.get(file);
}

const rule = {
  meta: {
    type: "problem",
    docs: { description: "Client components can't import server-only modules." },
    messages: {
      boundary:
        "\"{{specifier}}\" is server-only and this file is a client component. Pass the data in as props, or call an API route.",
    },
    schema: [],
  },
  create(context) {
    const body = context.sourceCode.ast.body;
    const isClient = body.some((s) => s.type === "ExpressionStatement" && s.directive === "use client");
    if (!isClient) return {};
    const root = context.cwd;
    return {
      ImportDeclaration(node) {
        if (node.importKind === "type") return;
        const specifier = node.source.value;
        if (specifier === "server-only") {
          context.report({ node, messageId: "boundary", data: { specifier } });
          return;
        }
        if (typeof specifier !== "string" || !specifier.startsWith("@/")) return;
        const file = resolve(root, specifier);
        if (file && isServerOnly(file)) context.report({ node, messageId: "boundary", data: { specifier } });
      },
    };
  },
};

export default rule;
