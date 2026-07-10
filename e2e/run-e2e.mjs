import { rmSync } from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const isWindows = process.platform === "win32";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: isWindows,
      ...options
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function waitForServer(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const ready = await new Promise((resolve) => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve(response.statusCode ? response.statusCode < 500 : false);
      });

      request.on("error", () => resolve(false));
      request.setTimeout(2_000, () => {
        request.destroy();
        resolve(false);
      });
    });

    if (ready) {
      return;
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function stopServer(child) {
  if (!child || child.killed) {
    return;
  }

  if (isWindows) {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      shell: true,
      detached: true
    }).unref();
    await delay(1_000);
    return;
  }

  child.kill("SIGTERM");
  await delay(1_000);
}

let server;

try {
  rmSync("apps/web/.next", { recursive: true, force: true });
  await run("npm", ["run", "build:web"]);

  // apps/web builds with output: "standalone" (see next.config.ts - needed for lean Electron
  // packaging), which next start warns is unsupported. Run the standalone server.js directly
  // instead, matching how desktop/electron/main.js spawns it. See copy-standalone-static.mjs for
  // why the static asset copy below is required first.
  await run("node", ["e2e/copy-standalone-static.mjs"]);

  server = spawn("node", [".next/standalone/apps/web/server.js"], {
    cwd: "apps/web",
    stdio: "inherit",
    shell: isWindows,
    env: { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1" }
  });

  await waitForServer(baseURL);
  await run("npx", ["playwright", "test", "-c", "e2e/playwright.config.ts"], {
    env: {
      ...process.env,
      PLAYWRIGHT_BASE_URL: baseURL
    }
  });
} finally {
  await stopServer(server);
}
