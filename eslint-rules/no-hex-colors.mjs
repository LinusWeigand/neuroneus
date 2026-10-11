const HEX = /(^|[^\w&])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![\w-])/;

const rule = {
  meta: {
    type: "problem",
    docs: { description: "Colors come from design tokens, never inline hex." },
    messages: { hex: "Use a design token (Tailwind theme color or CSS variable from globals.css), never an inline hex color." },
    schema: [],
  },
  create(context) {
    const check = (node, text) => {
      if (typeof text === "string" && HEX.test(text)) context.report({ node, messageId: "hex" });
    };
    return {
      Literal(node) {
        check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked);
      },
    };
  },
};

export default rule;
