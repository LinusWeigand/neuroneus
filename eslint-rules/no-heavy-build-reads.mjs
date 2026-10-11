const isSchemaMember = (node, name) =>
  node?.type === "MemberExpression" && node.object.type === "Identifier" && node.object.name === "schema" && node.property.name === name;

const rule = {
  meta: {
    type: "problem",
    docs: { description: "Keep metered database traffic down: no full build rows, blobs only through blobs.ts." },
    messages: {
      fullRow:
        "Select only the columns you need from builds (see LIGHT in src/lib/build/engine.ts). Full build rows once used up the database's monthly transfer quota.",
      blobs: "Read and write build blobs only through src/lib/build/blobs.ts (loadBlob, saveBlobs), so they are loaded only by the step that needs them.",
    },
    schema: [{ type: "object", properties: { blobModule: { type: "string" } }, additionalProperties: false }],
  },
  create(context) {
    const blobModule = context.options[0]?.blobModule ?? "src/lib/build/blobs.ts";
    const inBlobModule = context.filename.replaceAll("\\", "/").endsWith(blobModule);
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression" || callee.property.name !== "from") return;
        const select = callee.object;
        const isBareSelect =
          select.type === "CallExpression" &&
          select.callee.type === "MemberExpression" &&
          select.callee.property.name === "select" &&
          select.arguments.length === 0;
        if (isBareSelect && isSchemaMember(node.arguments[0], "builds")) context.report({ node, messageId: "fullRow" });
      },
      MemberExpression(node) {
        if (!inBlobModule && isSchemaMember(node, "buildBlobs")) context.report({ node, messageId: "blobs" });
      },
    };
  },
};

export default rule;
