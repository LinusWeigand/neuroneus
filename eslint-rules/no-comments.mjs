const KEPT = /^\s*(eslint-disable|eslint-enable|eslint\s|global\s|@ts-expect-error|prettier-ignore)/;
const TRIPLE_SLASH = /^\/\s*<reference\s/;

function lineBounds(text, start, end) {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const newline = text.indexOf("\n", end);
  const lineEnd = newline === -1 ? text.length : newline + 1;
  return { lineStart, lineEnd };
}

function removalRange(sourceCode, start, end) {
  const text = sourceCode.text;
  const { lineStart, lineEnd } = lineBounds(text, start, end);
  const before = text.slice(lineStart, start);
  const after = text.slice(end, lineEnd);
  if (!before.trim() && !after.trim()) return [lineStart, lineEnd];
  if (!after.trim()) return [start - (before.length - before.trimEnd().length), end];
  return [start, end];
}

const rule = {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Ban comments: say it in names, types, tests or a lint rule instead." },
    messages: {
      comment:
        "Comments are banned (AGENTS.md). Put the intent in a name, a type, a test or a lint rule. If an outside constraint truly can't be expressed in code, link the issue in AGENTS.md.",
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.type === "Shebang") continue;
          if (KEPT.test(comment.value) || (comment.type === "Line" && TRIPLE_SLASH.test(comment.value))) continue;
          const node = sourceCode.getNodeByRangeIndex(comment.range[0]);
          const container = node?.type === "JSXEmptyExpression" ? node.parent : node?.type === "JSXExpressionContainer" && node.expression.type === "JSXEmptyExpression" ? node : null;
          const [start, end] = container ? container.range : comment.range;
          context.report({
            loc: comment.loc,
            messageId: "comment",
            fix: (fixer) => fixer.removeRange(removalRange(sourceCode, start, end)),
          });
        }
      },
    };
  },
};

export default rule;
