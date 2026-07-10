import { cpSync } from "node:fs";
import { resolve } from "node:path";

// Next's standalone output does NOT include the static asset chunks (JS/CSS under .next/static)
// next to server.js - the real packaged Electron app gets those from electron-builder's
// `extraResources` copy at package time (see desktop/package.json). Nothing in the e2e harness
// runs that packaging step, so both entry points that start the standalone server directly
// (run-e2e.mjs and playwright.config.ts's webServer) need this same copy first, or every page
// renders with zero CSS applied - which silently passed for a long time because earlier e2e
// specs only asserted visible text, never layout/style-dependent behavior.
const webAppRoot = resolve(import.meta.dirname, "..", "apps", "web");

cpSync(
  resolve(webAppRoot, ".next", "static"),
  resolve(webAppRoot, ".next", "standalone", "apps", "web", ".next", "static"),
  { recursive: true }
);
