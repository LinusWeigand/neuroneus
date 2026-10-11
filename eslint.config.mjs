import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import neuroneus from "./eslint-rules/index.mjs";

const UI = ["src/app/**/*.tsx", "src/components/**/*.tsx"];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "drizzle/**", ".claude/**", ".verify/**", "templates/**"]),
  {
    plugins: { neuroneus },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      "neuroneus/no-comments": "error",
      "neuroneus/disable-needs-reason": "error",
      "neuroneus/client-server-boundary": "error",
      "neuroneus/no-heavy-build-reads": "error",
      "neuroneus/model-calls-use-call-settings": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-expect-error": "allow-with-description", "ts-ignore": true, "ts-nocheck": true }],
    },
  },
  {
    files: UI,
    rules: {
      "neuroneus/no-hex-colors": "error",
      "neuroneus/no-jsx-text": "error",
    },
  },
]);
