// Builds the FastAPI sidecar into a standalone binary with PyInstaller and copies it into
// desktop/resources/api-sidecar/, where electron-builder's extraResources config picks it up
// for packaged builds (see desktop/package.json's build.extraResources and
// desktop/electron/main.js's resolvePackagedSidecarBinary()).
//
// Requires PyInstaller: pip install -r apps/api/requirements.txt -r apps/api/requirements-build.txt

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const API_DIR = resolve(REPO_ROOT, "apps", "api");
const RESOURCES_DIR = resolve(REPO_ROOT, "desktop", "resources", "api-sidecar");
const PYTHON = process.env.ATLAS_PYTHON_PATH ?? (process.platform === "win32" ? "python" : "python3");
const BINARY_NAME = process.platform === "win32" ? "atlas-api.exe" : "atlas-api";

console.log(`[desktop] Building API sidecar with PyInstaller (python: ${PYTHON})`);

// PyInstaller's dependency analysis actually imports sidecar_entry.py (and transitively
// app.main, which constructs the SharedStateStore singleton) to discover dynamic dependencies -
// it is not purely static analysis. That import runs with the *build* process's cwd, so running
// this with cwd: apps/api - like the app itself does NOT expect (see main.js's REPO_ROOT +
// --app-dir convention) - silently wrote a stray apps/api/apps/api/.local/atlas.db during the
// build, found by inspecting what showed up in `git status` after a build. Using REPO_ROOT as
// cwd with absolute --distpath/--workpath keeps the build process's incidental import consistent
// with every other way this app is ever run.
const distPath = resolve(REPO_ROOT, "apps", "api", "dist");
const workPath = resolve(REPO_ROOT, "apps", "api", "build");
const entryScript = resolve(API_DIR, "sidecar_entry.py");

const result = spawnSync(
  PYTHON,
  [
    "-m",
    "PyInstaller",
    "--onefile",
    "--name",
    "atlas-api",
    "--distpath",
    distPath,
    "--workpath",
    workPath,
    // PyInstaller writes its auto-generated .spec file to cwd by default - with cwd: REPO_ROOT
    // that would litter the repo root instead of staying colocated with sidecar_entry.py.
    "--specpath",
    API_DIR,
    entryScript,
  ],
  { cwd: REPO_ROOT, stdio: "inherit", shell: process.platform === "win32" }
);

if (result.status !== 0) {
  console.error("[desktop] PyInstaller build failed.");
  process.exit(result.status ?? 1);
}

const builtBinary = resolve(distPath, BINARY_NAME);
if (!existsSync(builtBinary)) {
  console.error(`[desktop] Expected PyInstaller output not found at ${builtBinary}`);
  process.exit(1);
}

rmSync(RESOURCES_DIR, { recursive: true, force: true });
mkdirSync(RESOURCES_DIR, { recursive: true });
copyFileSync(builtBinary, resolve(RESOURCES_DIR, BINARY_NAME));

console.log(`[desktop] API sidecar ready at ${resolve(RESOURCES_DIR, BINARY_NAME)}`);
