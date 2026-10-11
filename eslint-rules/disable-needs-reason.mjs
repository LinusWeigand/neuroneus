const DIRECTIVE = /^\s*eslint-(disable|disable-line|disable-next-line|enable)\b/;
const EXPIRY = /\(until (\d{4}-\d{2}-\d{2})\)/;

const rule = {
  meta: {
    type: "problem",
    docs: { description: "Lint exceptions need a reason and an expiry date, and fail once expired." },
    messages: {
      missing: "Lint exceptions need a reason and an expiry: `eslint-disable-next-line <rule> -- <why> (until YYYY-MM-DD)`.",
      expired: "This lint exception expired on {{date}}. Fix the code or renew it with a human's approval.",
    },
    schema: [{ type: "object", properties: { today: { type: "string" } }, additionalProperties: false }],
  },
  create(context) {
    const today = context.options[0]?.today ?? new Date().toISOString().slice(0, 10);
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const match = DIRECTIVE.exec(comment.value);
          if (!match || match[1] === "enable") continue;
          const [, reason = ""] = comment.value.split(/\s--\s/);
          const expiry = EXPIRY.exec(reason);
          if (!reason.replace(EXPIRY, "").trim() || !expiry) context.report({ loc: comment.loc, messageId: "missing" });
          else if (expiry[1] < today) context.report({ loc: comment.loc, messageId: "expired", data: { date: expiry[1] } });
        }
      },
    };
  },
};

export default rule;
