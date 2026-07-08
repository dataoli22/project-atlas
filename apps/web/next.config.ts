import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@atlas/config", "@atlas/shared"]
};

export default nextConfig;
