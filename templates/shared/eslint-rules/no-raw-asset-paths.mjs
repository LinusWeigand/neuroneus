const ASSET_PATH = /^\/?assets\//;

const rule = {
  meta: {
    type: "problem",
    docs: { description: "Assets are loaded by key from game/assets.ts, the generated manifest." },
    messages: { path: "Load assets by key from game/assets.ts (ASSETS) instead of a file path. The manifest lists every asset in public/assets." },
    schema: [],
  },
  create(context) {
    const check = (node, value) => {
      if (typeof value === "string" && ASSET_PATH.test(value)) context.report({ node, messageId: "path" });
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
