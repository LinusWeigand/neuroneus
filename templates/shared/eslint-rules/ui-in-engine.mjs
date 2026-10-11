const ENGINE = "in the engine with game/ui.ts (in-game text, buttons and panels), not with React or HTML. React only mounts the game";

const rule = {
  meta: {
    type: "problem",
    docs: { description: "Game screens, menus and HUD live in one place." },
    messages: { jsx: "Build menus, HUD and screens {{place}}." },
    schema: [{ type: "object", properties: { place: { type: "string" } }, additionalProperties: false }],
  },
  create(context) {
    const place = context.options[0]?.place ?? ENGINE;
    let reported = false;
    return {
      JSXElement(node) {
        if (reported) return;
        reported = true;
        context.report({ node, messageId: "jsx", data: { place } });
      },
    };
  },
};

export default rule;
