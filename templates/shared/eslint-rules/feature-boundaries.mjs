import path from "node:path";

function featureOf(file) {
  const match = /(?:^|\/)features\/([^/]+)\//.exec(file.replaceAll("\\", "/"));
  return match ? match[1] : null;
}

const rule = {
  meta: {
    type: "problem",
    docs: { description: "A feature never reaches into another feature's files." },
    messages: {
      boundary: "features/{{own}} imports from features/{{other}}. Move the shared piece to components/ui or lib, or import the other feature's public index (features/{{other}}/index.ts).",
    },
    schema: [],
  },
  create(context) {
    const own = featureOf(context.filename);
    if (!own) return {};
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== "string") return;
        const target = source.startsWith("@/")
          ? source.slice(2) + "/"
          : source.startsWith(".")
            ? path.posix.join(path.posix.dirname(context.filename.replaceAll("\\", "/")), source) + "/"
            : null;
        const other = target ? featureOf(target) : null;
        if (!other || other === own) return;
        if (/features\/[^/]+\/(index)?\/?$/.test(target)) return;
        context.report({ node, messageId: "boundary", data: { own, other } });
      },
    };
  },
};

export default rule;
