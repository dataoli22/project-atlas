// Electron main process: owns the sidecar lifecycle for Atlas's local-first desktop shell.
//
// On launch this spawns two child processes - the FastAPI backend and the Next.js standalone
// server - waits for both to report healthy, then opens a BrowserWindow pointed at the local
// Next server. Both processes are killed on quit. Nothing here talks to any Atlas-hosted
// service; everything is loopback-only local process orchestration.
//
// Ports are currently FIXED (not dynamically allocated) because the web build bakes
// NEXT_PUBLIC_ATLAS_API_URL into the client bundle at build time, which the desktop build step
// (see package.json's `build:web:desktop`) sets to match API_PORT below. Dynamic port
// allocation + collision handling is tracked as a follow-up in docs/production-todo.md section 9
// - it needs a way to inject the resolved API URL into the already-built client bundle at
// runtime (e.g. a small pre-hydration config script) rather than relying on a build-time env var.

const { app, BrowserWindow, dialog, shell } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");
const http = require("node:http");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const API_PORT = 8756;
const WEB_PORT = 4173;
const API_HEALTH_URL = `http://127.0.0.1:${API_PORT}/api/v1/health`;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
const IS_PACKAGED = app.isPackaged;

let apiProcess = null;
let webProcess = null;
let mainWindow = null;

function resolvePythonExecutable() {
  // Packaged builds should point at a PyInstaller-built sidecar binary instead of a system/venv
  // Python interpreter - not built yet (tracked in docs/packaging-and-installation.md section 4).
  // For now this only supports running from source, which is the honest state of this scaffold.
  if (IS_PACKAGED) {
    throw new Error(
      "Packaged Python sidecar is not built yet. See docs/packaging-and-installation.md section 4 " +
        "(FastAPI PyInstaller sidecar) - this desktop shell currently only runs against apps/api from source."
    );
  }

  // ATLAS_PYTHON_PATH lets a developer point at a specific interpreter (e.g. a venv) when the
  // platform's default "python"/"python3" resolves to something broken - on Windows this is
  // commonly the Microsoft Store app-execution-alias stub, which prints an install prompt
  // instead of running Python when no other interpreter is on PATH ahead of it.
  if (process.env.ATLAS_PYTHON_PATH) {
    return process.env.ATLAS_PYTHON_PATH;
  }

  return process.platform === "win32" ? "python" : "python3";
}

function spawnApiSidecar() {
  const pythonExecutable = resolvePythonExecutable();
  // Run from REPO_ROOT with --app-dir (not cwd: apps/api) so relative paths in
  // apps/api/app/core/config.py (e.g. local_db_path="apps/api/.local/atlas.db") resolve the same
  // way they do for pytest and the documented `python -m uvicorn ... --app-dir apps/api` dev
  // flow. Using cwd: apps/api instead double-nests those paths to apps/api/apps/api/.local/... -
  // found and fixed by actually running this and inspecting what got written to disk.
  const child = spawn(
    pythonExecutable,
    [
      "-m",
      "uvicorn",
      "app.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(API_PORT),
      "--app-dir",
      "apps/api",
    ],
    {
      cwd: REPO_ROOT,
      stdio: "inherit",
      env: { ...process.env },
    }
  );
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`Atlas API sidecar exited with code ${code}`);
    }
  });
  return child;
}

function spawnWebServer() {
  const serverEntry = IS_PACKAGED
    ? path.join(process.resourcesPath, "web-standalone", "apps", "web", "server.js")
    : path.join(REPO_ROOT, "apps", "web", ".next", "standalone", "apps", "web", "server.js");

  const child = spawn(process.execPath, [serverEntry], {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: String(WEB_PORT),
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

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open external links (support/doc URLs) in the OS browser, never inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(WEB_URL);
}

async function startSidecarsAndShowWindow() {
  try {
    apiProcess = spawnApiSidecar();
    webProcess = spawnWebServer();

    await Promise.all([waitForHealthy(API_HEALTH_URL), waitForHealthy(WEB_URL)]);
    await createWindow();

    if (IS_PACKAGED) {
      const { autoUpdater } = require("electron-updater");
      autoUpdater.checkForUpdatesAndNotify().catch((error) => {
        console.error("Atlas update check failed:", error);
      });
    }
  } catch (error) {
    dialog.showErrorBox(
      "Atlas failed to start",
      `${error.message}\n\nCheck that nothing else is using ports ${API_PORT}/${WEB_PORT}.`
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
