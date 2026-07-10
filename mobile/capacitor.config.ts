import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.projectatlas.mobile",
  appName: "Atlas Companion",
  webDir: "dist",
  // No devServer/remote URL by design - the companion app talks to a *paired desktop's* local
  // API over the LAN (user-entered IP:port during pairing), never to a bundled or remote server
  // of its own. See docs/feature-specs/mobile-architecture.md.
};

export default config;
