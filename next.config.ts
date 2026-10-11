import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@octokit/rest", "@octokit/auth-app", "pg", "getdesign", "sharp", "playwright-core"],
  outputFileTracingIncludes: {
    "/api/**": [
      "./node_modules/getdesign/templates/**/*",
      "./node_modules/getdesign/package.json",
      "./templates/**/*",
      "./eslint-rules/*.mjs",
    ],
  },
};

export default nextConfig;
