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

const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
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

// Desktop-only preferences (currently just the LAN pairing toggle) live in a plain JSON file in
// userData rather than in the API's own SQLite state, because the main process needs to read
// this *before* it decides what host to bind the sidecar to - the sidecar itself can't be the
// source of truth for a setting that determines how the sidecar gets launched. Read/write via
// IPC from the renderer (see preload.js's atlasDesktop.lanPairing and
// pairing-settings-form.tsx's desktop-only toggle).
function desktopPrefsPath() {
  return path.join(app.getPath("userData"), "desktop-prefs.json");
}

function readDesktopPrefs() {
  try {
    return JSON.parse(fs.readFileSync(desktopPrefsPath(), "utf-8"));
  } catch {
    return {};
  }
}

function writeDesktopPrefs(patch) {
  const current = readDesktopPrefs();
  const next = { ...current, ...patch };
  fs.mkdirSync(path.dirname(desktopPrefsPath()), { recursive: true });
  fs.writeFileSync(desktopPrefsPath(), JSON.stringify(next, null, 2), "utf-8");
  return next;
}

function resolveAllowLanPairing() {
  const stored = readDesktopPrefs().allowLanPairing;
  if (typeof stored === "boolean") {
    return stored;
  }
  // First run (no persisted preference yet): fall back to the env var for anyone who was
  // already using the pre-toggle opt-in.
  return process.env.ATLAS_ALLOW_LAN_PAIRING === "1";
}

ipcMain.handle("atlas:get-lan-pairing", () => resolveAllowLanPairing());
ipcMain.handle("atlas:set-lan-pairing", (_event, enabled) => {
  writeDesktopPrefs({ allowLanPairing: Boolean(enabled) });
  return true;
});
ipcMain.handle("atlas:restart-app", () => {
  app.relaunch();
  app.exit(0);
});

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
  // LAN pairing (the phone companion app) requires the sidecar to bind beyond loopback. Gated by
  // the persisted desktop-prefs.json toggle (settable from Settings -> Phone pairing, see
  // preload.js/pairing-settings-form.tsx), falling back to ATLAS_ALLOW_LAN_PAIRING=1 on first
  // run. Changing the bind address requires restarting the sidecar - the settings UI shows a
  // "Restart Atlas to apply" prompt after the toggle changes rather than silently requiring the
  // user to figure that out. Binding to 0.0.0.0 means any device on the same local network can
  // reach the API; the pairing code + device token flow (see pairing.py) is the only thing
  // gating access to it once bound this way, so anyone who can intercept the pairing code during
  // its 5-minute window (now also bounded to a handful of guesses - see MAX_PAIRING_ATTEMPTS in
  // pairing.py) could pair. This is stated plainly rather than glossed over - it is a real
  // tradeoff of opting into LAN pairing at all.
  const apiHost = resolveAllowLanPairing() ? "0.0.0.0" : "127.0.0.1";
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

// electron-updater checks the GitHub Release matching the running app's version for a
// `latest.yml` manifest (produced by `electron-builder --publish` - a plain `--win` build does
// NOT generate or upload it, so a release built without --publish leaves auto-update with
// nothing to compare against). See docs/build-and-run/packaging-and-installation.md for the
// publish flow. Update behavior here: silently check on launch and every 4 hours after,
// download in the background if a newer version is found, then ask the user to restart once the
// download finishes rather than installing without asking - a background download can finish
// while the user is mid-task, and force-quitting would lose that context.
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

// Mirrored to the renderer so the in-app Settings -> Updates page has something real to show,
// not just a native OS dialog the user might miss. See preload.js's atlasDesktop.updates and
// components/updates-panel.tsx.
let updateStatus = { state: "idle", currentVersion: app.getVersion() };
let autoUpdaterRef = null;

function setUpdateStatus(patch) {
  updateStatus = { ...updateStatus, ...patch, currentVersion: app.getVersion() };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("atlas:update-status", updateStatus);
  }
}

function initializeAutoUpdates() {
  const { autoUpdater } = require("electron-updater");
  autoUpdaterRef = autoUpdater;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    setUpdateStatus({ state: "checking", error: null });
  });

  autoUpdater.on("update-available", (info) => {
    setUpdateStatus({ state: "downloading", latestVersion: info.version, progressPercent: 0 });
  });

  autoUpdater.on("update-not-available", (info) => {
    setUpdateStatus({ state: "up-to-date", latestVersion: info.version, lastCheckedAt: new Date().toISOString() });
  });

  autoUpdater.on("download-progress", (progress) => {
    setUpdateStatus({ state: "downloading", progressPercent: Math.round(progress.percent) });
  });

  autoUpdater.on("update-downloaded", (info) => {
    setUpdateStatus({ state: "downloaded", latestVersion: info.version });
    dialog
      .showMessageBox({
        type: "info",
        buttons: ["Restart now", "Later"],
        defaultId: 0,
        cancelId: 1,
        title: "Atlas update ready",
        message: `Atlas ${info.version} has downloaded and is ready to install.`,
        detail: "Restart now to apply it, or it will install automatically the next time you quit Atlas."
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  autoUpdater.on("error", (error) => {
    console.error("Atlas update check failed:", error);
    setUpdateStatus({ state: "error", error: String(error?.message ?? error) });
  });

  autoUpdater.checkForUpdates().catch((error) => {
    console.error("Atlas update check failed:", error);
  });

  setInterval(() => {
    autoUpdater.checkForUpdates().catch((error) => {
      console.error("Atlas update check failed:", error);
    });
  }, UPDATE_CHECK_INTERVAL_MS);
}

ipcMain.handle("atlas:get-update-status", () => updateStatus);
ipcMain.handle("atlas:check-for-updates", async () => {
  if (!IS_PACKAGED) {
    return { state: "unsupported", currentVersion: app.getVersion() };
  }
  if (!autoUpdaterRef) {
    return updateStatus;
  }
  try {
    await autoUpdaterRef.checkForUpdates();
  } catch (error) {
    console.error("Atlas manual update check failed:", error);
  }
  return updateStatus;
});
ipcMain.handle("atlas:install-update", () => {
  if (autoUpdaterRef && updateStatus.state === "downloaded") {
    autoUpdaterRef.quitAndInstall();
  }
});

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
      initializeAutoUpdates();
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
