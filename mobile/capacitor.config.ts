import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.projectatlas.mobile",
  appName: "Atlas Companion",
  webDir: "dist",
  // No devServer/remote URL by design - the companion app talks to a *paired desktop's* local
  // API over the LAN (user-entered IP:port during pairing), never to a bundled or remote server
  // of its own. See docs/feature-specs/mobile-architecture.md.
  server: {
    // Capacitor's Android default (https://localhost) makes every LAN pairing fetch() a
    // mixed-content request - Chromium blocks it outright regardless of the OS-level
    // network_security_config cleartext setting (AndroidManifest.xml/network_security_config.xml),
    // which only governs the platform network stack, not the WebView's own content-security
    // policy. Serving the app itself over http://localhost keeps the LAN request same-scheme, per
    // Capacitor's documented approach for local-network HTTP companion apps.
    androidScheme: "http"
  }
};

export default config;
