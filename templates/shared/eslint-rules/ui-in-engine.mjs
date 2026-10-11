const rule = {
  meta: {
    type: "problem",
    docs: { description: "Game screens, menus and HUD are built in the engine, not with React or HTML." },
    messages: {
      jsx: "Build menus, HUD and screens in the engine with game/ui.ts (in-game text, buttons and panels), not with React or HTML. React only mounts the game.",
    },
    schema: [],
  },
  create(context) {
    let reported = false;
    return {
      JSXElement(node) {
        if (reported) return;
        reported = true;
        context.report({ node, messageId: "jsx" });
      },
    };
  },
};

export default rule;
