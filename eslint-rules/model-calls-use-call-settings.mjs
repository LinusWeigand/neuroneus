const MODEL_CALLS = new Set(["generateText", "streamText", "generateObject", "streamObject"]);
const OWNED = new Set(["reasoning", "providerOptions", "maxOutputTokens"]);

const rule = {
  meta: {
    type: "problem",
    docs: { description: "Every model call goes through callSettings() in src/lib/ai.ts." },
    messages: {
      missing:
        "Spread ...callSettings(model, answerTokens) into model calls: it sets the reasoning effort, leaves room for reasoning tokens and keeps Azure from storing generations.",
      owned: "\"{{key}}\" is set by callSettings(); pass extra Azure options as its third argument instead.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "Identifier" || !MODEL_CALLS.has(node.callee.name)) return;
        const options = node.arguments[0];
        if (options?.type !== "ObjectExpression") return;
        const spreadsSettings = options.properties.some(
          (p) => p.type === "SpreadElement" && p.argument.type === "CallExpression" && p.argument.callee.name === "callSettings",
        );
        if (!spreadsSettings) context.report({ node, messageId: "missing" });
        for (const p of options.properties) {
          if (p.type === "Property" && p.key.type === "Identifier" && OWNED.has(p.key.name)) {
            context.report({ node: p, messageId: "owned", data: { key: p.key.name } });
          }
        }
      },
    };
  },
};

export default rule;
