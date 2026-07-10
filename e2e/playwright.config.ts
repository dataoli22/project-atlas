import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const repoRoot = resolve(__dirname, "..");
const webAppRoot = resolve(repoRoot, "apps/web");

export default defineConfig({
  testDir: "./web",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "./playwright-report" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        // apps/web builds with output: "standalone" (see next.config.ts), which next start warns
        // is unsupported - run the standalone server.js directly instead. Standalone output does
        // NOT include .next/static next to server.js (the real packaged app gets that from
        // electron-builder's extraResources copy at package time, see desktop/package.json) -
        // copy it first or every page serves with zero CSS applied. Matches the same copy
        // run-e2e.mjs does for the `npm run test:e2e` path; this covers direct
        // `npx playwright test -c e2e/playwright.config.ts` invocations too.
        command: `node ../e2e/copy-standalone-static.mjs && node .next/standalone/apps/web/server.js`,
        cwd: webAppRoot,
        url: baseURL,
        env: { PORT: String(port), HOSTNAME: "127.0.0.1" },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
