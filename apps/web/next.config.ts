import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@atlas/config", "@atlas/shared"],
  // Standalone output bundles a minimal server.js + only the deps actually used, instead of the
  // full node_modules tree. That is what the Electron main process spawns as a child process -
  // see desktop/electron/main.js.
  output: "standalone"
};

export default nextConfig;
