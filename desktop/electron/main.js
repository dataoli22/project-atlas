// Electron main process: owns the sidecar lifecycle for Atlas's local-first desktop shell.
//
// On launch this spawns two child processes - the FastAPI backend and the Next.js standalone
// server - waits for both to report healthy, then opens a BrowserWindow pointed at the local
// Next server. Both processes are killed on quit. Nothing here talks to any Atlas-hosted
// service; everything is loopback-only local process orchestration.
//
// Ports are allocated dynamically (bind to port 0, read back the OS-assigned port) rather than
// fixed. The API port is handed to the renderer via preload.js's additionalArguments, since
// client components that call fetch directly would otherwise need NEXT_PUBLIC_ATLAS_API_URL
// baked into the bundle at build time - see apps/web/lib/api.ts's resolveApiBaseUrl().

const { app, BrowserWindow, dialog, shell } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const IS_PACKAGED = app.isPackaged;

// Without this, Electron derives app.getPath("userData") from package.json's npm "name" field
// (@atlas/desktop), landing local state in a scoped-package-shaped folder like
// AppData\Roaming\@atlas\desktop instead of a clean AppData\Roaming\Atlas - found by actually
// launching the packaged build and checking where it wrote the database.
app.setName("Atlas");

let apiProcess = null;
let webProcess = null;
let mainWindow = null;

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function resolvePythonExecutable() {
  // ATLAS_PYTHON_PATH lets a developer point at a specific interpreter (e.g. a venv) when the
  // platform's default "python"/"python3" resolves to something broken - on Windows this is
  // commonly the Microsoft Store app-execution-alias stub, which prints an install prompt
  // instead of running Python when no other interpreter is on PATH ahead of it.
  if (process.env.ATLAS_PYTHON_PATH) {
    return process.env.ATLAS_PYTHON_PATH;
  }
  return process.platform === "win32" ? "python" : "python3";
}

function resolvePackagedSidecarBinary() {
  const binaryName = process.platform === "win32" ? "atlas-api.exe" : "atlas-api";
  return path.join(process.resourcesPath, "api-sidecar", binaryName);
}

function spawnApiSidecar(apiPort, userDataDir) {
  // apps/api/app/core/config.py reads ATLAS_-prefixed env vars via pydantic-settings; pointing
  // these at Electron's per-OS user data directory (not the source tree's apps/api/.local)
  // keeps packaged-app state out of the (potentially read-only, or reinstall-wiped) install
  // location - the OS app-data directory is the correct place for a packaged app's local state.
  //
  // LAN pairing (the phone companion app) requires the sidecar to bind beyond loopback. This is
  // opt-in via ATLAS_ALLOW_LAN_PAIRING=1 set before launching Atlas - there is deliberately no
  // in-app toggle yet, since changing the bind address requires restarting the sidecar and a
  // proper "restart to apply" UX is a follow-up, not built here. Binding to 0.0.0.0 means any
  // device on the same local network can reach the API; the pairing code + device token flow
  // (see pairing.py) is the only thing gating access to it once bound this way, so anyone who
  // can intercept the pairing code during its 5-minute window could pair. This is stated plainly
  // rather than glossed over - it is a real tradeoff of opting into LAN pairing at all.
  const apiHost = process.env.ATLAS_ALLOW_LAN_PAIRING === "1" ? "0.0.0.0" : "127.0.0.1";
  const sharedEnv = {
    ...process.env,
    ATLAS_LOCAL_DB_PATH: path.join(userDataDir, "atlas.db"),
    ATLAS_LOCAL_STATE_PATH: path.join(userDataDir, "shared-state.json"),
    ATLAS_API_HOST: apiHost,
    ATLAS_API_PORT: String(apiPort),
  };

  const child = IS_PACKAGED
    ? spawn(resolvePackagedSidecarBinary(), ["--host", apiHost, "--port", String(apiPort)], {
        stdio: "inherit",
        env: sharedEnv,
      })
    : spawn(
        resolvePythonExecutable(),
        [
          "-m",
          "uvicorn",
          "app.main:app",
          "--host",
          apiHost,
          "--port",
          String(apiPort),
          "--app-dir",
          "apps/api",
        ],
        {
          // Run from REPO_ROOT with --app-dir (not cwd: apps/api) so relative-path fallbacks in
          // config.py resolve the same way they do for pytest and the documented dev flow. Using
          // cwd: apps/api instead double-nests local state paths - found and fixed by actually
          // running this and inspecting what got written to disk.
          cwd: REPO_ROOT,
          stdio: "inherit",
          env: sharedEnv,
        }
      );

  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`Atlas API sidecar exited with code ${code}`);
    }
  });
  return child;
}

function spawnWebServer(webPort) {
  const serverEntry = IS_PACKAGED
    ? path.join(process.resourcesPath, "web-standalone", "apps", "web", "server.js")
    : path.join(REPO_ROOT, "apps", "web", ".next", "standalone", "apps", "web", "server.js");

  const child = spawn(process.execPath, [serverEntry], {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: String(webPort),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      ELECTRON_RUN_AS_NODE: "1",
    },
  });
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`Atlas web server exited with code ${code}`);
    }
  });
  return child;
}

function waitForHealthy(url, { timeoutMs = 30_000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });
      request.on("error", retry);
      request.setTimeout(2000, () => {
        request.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`Timed out waiting for ${url} to become healthy`));
        return;
      }
      setTimeout(attempt, intervalMs);
    };

    attempt();
  });
}

function killChild(child) {
  if (!child || child.killed) {
    return;
  }
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  child.kill("SIGTERM");
}

async function createWindow(webUrl, apiBaseUrl) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // The only way to hand launch-time data (the dynamically resolved API port) into a
      // preload script - preload.js reads this back off process.argv.
      additionalArguments: [`--atlas-api-base-url=${apiBaseUrl}`],
    },
  });

  // Open external links (support/doc URLs) in the OS browser, never inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(webUrl);
}

async function startSidecarsAndShowWindow() {
  let apiPort;
  let webPort;

  try {
    [apiPort, webPort] = await Promise.all([findFreePort(), findFreePort()]);

    const userDataDir = app.getPath("userData");
    const apiHealthUrl = `http://127.0.0.1:${apiPort}/api/v1/health`;
    const webUrl = `http://127.0.0.1:${webPort}`;

    apiProcess = spawnApiSidecar(apiPort, userDataDir);
    webProcess = spawnWebServer(webPort);

    await Promise.all([waitForHealthy(apiHealthUrl), waitForHealthy(webUrl)]);
    await createWindow(webUrl, `http://127.0.0.1:${apiPort}`);

    if (IS_PACKAGED) {
      const { autoUpdater } = require("electron-updater");
      autoUpdater.checkForUpdatesAndNotify().catch((error) => {
        console.error("Atlas update check failed:", error);
      });
    }
  } catch (error) {
    dialog.showErrorBox(
      "Atlas failed to start",
      `${error.message}${
        apiPort && webPort ? `\n\nAllocated ports: API ${apiPort}, web ${webPort}.` : ""
      }`
    );
    app.quit();
  }
}

app.whenReady().then(startSidecarsAndShowWindow);

app.on("window-all-closed", () => {
  killChild(apiProcess);
  killChild(webProcess);
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  killChild(apiProcess);
  killChild(webProcess);
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    startSidecarsAndShowWindow();
  }
});
