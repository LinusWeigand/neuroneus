import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.NN_STANDALONE ? "standalone" : undefined,
  serverExternalPackages: ["@octokit/rest", "@octokit/auth-app", "pg", "getdesign", "sharp", "playwright-core"],
  outputFileTracingIncludes: {
    "/api/**": [
      "./node_modules/getdesign/templates/**/*",
      "./node_modules/getdesign/package.json",
    ],
    "/**": ["./node_modules/playwright-core/browsers.json", "./node_modules/playwright-core/package.json"],
  },
  outputFileTracingExcludes: {
    "/**": ["./templates/**/*"],
  },
};

export default nextConfig;
