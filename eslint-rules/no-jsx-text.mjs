const LETTER = /\p{L}/u;
const VISIBLE_ATTRIBUTES = new Set(["aria-label", "title", "placeholder", "alt", "label", "aria-description"]);

const rule = {
  meta: {
    type: "problem",
    docs: { description: "Visible copy comes from the dictionaries, so both languages stay complete." },
    messages: { text: "Visible copy lives in src/lib/i18n/dictionaries.ts (English and German). Use t.<key> from useI18n() or getT()." },
    schema: [],
  },
  create(context) {
    return {
      JSXText(node) {
        if (LETTER.test(node.value)) context.report({ node, messageId: "text" });
      },
      JSXExpressionContainer(node) {
        const value = node.expression;
        if (node.parent.type === "JSXAttribute") return;
        if (value.type === "Literal" && typeof value.value === "string" && LETTER.test(value.value)) {
          context.report({ node, messageId: "text" });
        }
      },
      JSXAttribute(node) {
        const name = typeof node.name.name === "string" ? node.name.name : "";
        if (!VISIBLE_ATTRIBUTES.has(name) || !node.value) return;
        if (node.value.type === "Literal" && typeof node.value.value === "string" && LETTER.test(node.value.value)) {
          context.report({ node, messageId: "text" });
        }
      },
    };
  },
};

export default rule;
