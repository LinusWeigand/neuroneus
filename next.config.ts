import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@octokit/rest", "@octokit/auth-app", "pg", "getdesign"],
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/getdesign/templates/**/*", "./node_modules/getdesign/package.json"],
  },
};

export default nextConfig;
