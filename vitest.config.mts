import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "test/empty.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "eslint-rules/**/*.test.ts", "eslint-rules/**/*.test.mjs", "scripts/**/*.test.ts"],
    environment: "node",
  },
});
