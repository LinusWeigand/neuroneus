import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import app from "./eslint-rules/index.mjs";
import kind from "./eslint.kind.mjs";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts", "eslint-rules/**"]),
  {
    plugins: { app },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      "app/no-comments": "error",
      "app/disable-needs-reason": "error",
      "app/no-hex-colors": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-expect-error": "allow-with-description", "ts-ignore": true }],
    },
  },
  ...kind,
]);
