# Atlas Packaging and Installation Guide

Last updated: July 9, 2026

This document is the authoritative reference for how Atlas is developed, packaged, and
installed. It covers the current developer install, the target packaged desktop and Android
runtimes, the local sidecar lifecycle, and the release/signing pipeline that must exist before
any public beta. It complements `prod-readiness-audit.md` (section 1) with concrete,
implementable steps.

Atlas is a **local-first, self-contained** application. The distribution goal is a user-run
desktop or phone package that runs all services on the user's own device. Atlas is **not** a
hosted SaaS and must never require an Atlas-owned callback relay or hosted inference service.

---

## 1. Repository layout relevant to packaging

```
apps/web        Next.js 15 UI (the shell rendered inside the native window / WebView)
apps/api        FastAPI backend (packaged as a local loopback sidecar)
packages/shared TS contracts shared by the UI and loaders
packages/config  shared defaults (DEFAULT_API_URL, markets, currency)
infra/          docker-compose for local Ollama + Postgres during development
.agents/        agent handoff prompts
docs/           architecture, PRDs, audits, this guide
```

There is **no packaging project yet** (`desktop/` and `android/` are not created). Creating them
is the first packaging deliverable — see sections 4 and 5.

---

## 2. Developer install (today)

Prerequisites: Node 22+, Python 3.11+, and (optionally) Ollama installed locally.

From the repo root:

```bash
# 1. Install JS workspaces (apps/web, packages/*)
npm install

# 2. Create and activate a Python venv, install API deps
python -m venv .venv
.venv\Scripts\activate            # Windows
# source .venv/bin/activate       # macOS / Linux
pip install -r apps/api/requirements.txt
```

Run the two services in separate terminals:

```bash
# Backend (loopback only)
python -m uvicorn app.main:app --reload --app-dir apps/api

# Frontend
npm run dev:web
```

Optional local runtime dependencies via Docker (development only — the packaged app must not
depend on Docker):

```bash
docker compose -f infra/docker-compose.yml up -d ollama postgres
```

Smoke tests once the backend is running:

```bash
curl http://localhost:8000/api/v1/health
curl http://localhost:8000/api/v1/app/features
curl http://localhost:8000/api/v1/nutrition/planner
curl http://localhost:8000/api/v1/endurance/dashboard
```

### Available workspace scripts (`package.json`)

| Script | Purpose |
| --- | --- |
| `npm run dev:web` | Next dev server |
| `npm run build:web` | Production web build |
| `npm run lint:web` | ESLint on the web app |
| `npm run test:api` | `pytest apps/api/tests` (38 tests today) |
| `npm run test:web` | lint + production build |
| `npm run test:e2e` | Playwright E2E via `e2e/run-e2e.mjs` |
| `npm run test:all` | api + web + e2e |
| `npm run security` | `npm audit`, `pip_audit`, `bandit` |
| `npm run release:check` | `test:all` + `security` (the release gate) |

---

## 3. Build hygiene (must-fix before packaging)

`next build` in this workspace can fail with `EINVAL: invalid argument, readlink` when a stale
`apps/web/.next` directory is present (documented in the audit). Treat build output as a
disposable artifact.

> **Windows + OneDrive note:** if the repo checkout lives inside a OneDrive-synced folder (as in
> this workspace), the `clean` step can intermittently fail with `EPERM: operation not permitted,
> unlink '...\.next\static\...'` because OneDrive's sync process transiently locks files inside
> `.next` while it uploads them. This is a filesystem race, not a code defect — retrying the build
> succeeds once OneDrive releases the handle. For reliable local development, either pause
> OneDrive sync for this folder, exclude `apps/web/.next` from sync, or clone the repo outside any
> synced directory. CI runners are unaffected since they do not run OneDrive.

Required build hygiene:

1. Add a `clean` step that removes `apps/web/.next` before every production build.
   - Add to `apps/web/package.json`: `"clean": "rimraf .next"` and `"build": "npm run clean && next build"`.
2. Ensure `apps/web/.next`, `**/__pycache__`, `**/*.pyc`, `apps/api/.local`, and `e2e/test-results`
   are all git-ignored and never committed.
3. Add a release **preflight** that fails loudly if any generated directory or cache is present
   in packaging inputs.
4. Run all packaging builds from a clean checkout in CI (see section 8).

> The repository is currently **not initialized as a git repo**. Initialize it (`git init`),
> add a `.gitignore` that covers the above, and make an initial commit before wiring CI.

---

## 4. Desktop packaging — Electron (implemented and packaged this iteration)

**Shell: Electron + `electron-builder` + `electron-updater`.** Chosen over Tauri specifically for
`electron-updater`'s maturity — regular, reliable auto-updates were a hard product requirement,
and Tauri v2's updater is comparatively newer. `electron-builder` publishes installers as
**GitHub Releases** on this repo (`dataoli22/project-atlas`); `electron-updater` checks there
automatically. No separate update-hosting infrastructure needed.

**A real, fully-packaged Windows installer now builds and runs end to end** — `Atlas Setup
0.1.0.exe`, ~128MB, produced by `npm run desktop:dist`. This was launched from the packaged
`win-unpacked` output (not dev mode) and verified: real window, real PyInstaller API binary (not
Python-from-source), dynamically allocated ports, and correct OS app-data persistence.

### Architecture (as built)

```
┌───────────────────────────────────────────────┐
│  Electron BrowserWindow                        │
│  ┌─────────────────────────────────────────┐  │
│  │  Next.js standalone server (child proc)  │  │  http://127.0.0.1:<dynamic>
│  └─────────────────────────────────────────┘  │
│            │ loopback HTTP                      │
│  ┌─────────────────────────────────────────┐  │
│  │  FastAPI sidecar (child process)         │  │  http://127.0.0.1:<dynamic>
│  │  dev: python -m uvicorn ...               │  │
│  │  packaged: resources/api-sidecar/atlas-api│  │
│  └─────────────────────────────────────────┘  │
│            │ loopback HTTP                      │
│  ┌─────────────────────────────────────────┐  │
│  │  Ollama (separate local install)         │  │  http://localhost:11434
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
```

The Electron **main process** (`desktop/electron/main.js`) owns the sidecar lifecycle: it spawns
both child processes on **dynamically allocated free ports**, polls each until healthy, then opens
the window pointed at the local Next server. Both children are killed on quit (including via
`taskkill /T /F` on Windows, so nested child processes don't leak). External links (support/doc
URLs) open in the OS browser via `setWindowOpenHandler`, never inside the app window.

### Dynamic ports — the real fix, not a config toggle

Ports are allocated dynamically (bind to port `0`, read back the OS-assigned port) rather than
fixed. The hard part wasn't the allocation itself — it was that **client components calling
`fetch` directly get `NEXT_PUBLIC_ATLAS_API_URL` inlined into the browser bundle at build time**,
which a runtime-chosen port can't satisfy. The fix: `preload.js` receives the resolved API URL via
`BrowserWindow`'s `webPreferences.additionalArguments` (the only way to hand launch-time data into
a preload script), reads it back off `process.argv`, and exposes it via
`contextBridge.exposeInMainWorld("atlasDesktop", { apiBaseUrl })`. `apps/web/lib/api.ts`'s
`resolveApiBaseUrl()` checks `window.atlasDesktop?.apiBaseUrl` first — a runtime property read,
not a `process.env.X` token, so it survives Next's build-time substitution correctly — falling
back to `NEXT_PUBLIC_ATLAS_API_URL ?? DEFAULT_API_URL` for the regular browser deployment. This
means the desktop build now uses the **same** `apps/web` build as everything else; no
desktop-specific build step is needed anymore.

### OS app-data user-data path

`app.getPath("userData")` is passed into the sidecar as `ATLAS_LOCAL_DB_PATH` /
`ATLAS_LOCAL_STATE_PATH` env vars (picked up automatically by `pydantic-settings`'s
`ATLAS_`-prefixed config in `apps/api/app/core/config.py`). **Found and fixed a real bug here**:
without an explicit `app.setName("Atlas")` call, Electron derives the user-data folder name from
package.json's npm `name` field (`@atlas/desktop`), landing state at
`AppData\Roaming\@atlas\desktop\` instead of a clean `AppData\Roaming\Atlas\` — caught by actually
launching the packaged build, triggering a real write (enabling the app lock), and checking where
the file landed on disk.

### FastAPI PyInstaller sidecar — built and verified

`apps/api/sidecar_entry.py` is the PyInstaller entrypoint (imports the ASGI app directly and calls
`uvicorn.run()` programmatically, since PyInstaller can't freeze the `python -m uvicorn module:app`
CLI-discovery flow). `desktop/scripts/build-api-sidecar.mjs` runs
`pyinstaller --onefile --name atlas-api` and copies the ~33MB binary into
`desktop/resources/api-sidecar/`, which `electron-builder`'s `extraResources` config bundles into
the packaged app. Verified working standalone (health check, nutrition/endurance endpoints,
SQLite-backed app-lock state all responded correctly with zero source tree present) and verified
running *inside* the packaged Electron app (`Get-Process` showed `atlas-api.exe` launched from
`resources/api-sidecar/`, not a Python interpreter).

Build it with: `pip install -r apps/api/requirements.txt -r apps/api/requirements-build.txt` then
`npm run desktop:build:api` (or let `npm run desktop:dist` do it automatically).

### What's built vs. still open

| Deliverable | Status |
| --- | --- |
| `desktop/` Electron project wrapping `apps/web` | **Done** |
| Next.js **standalone** output (`output: "standalone"` in `next.config.ts`) | **Done** |
| Sidecar lifecycle manager (start/health-check/kill, both processes, dynamic ports) | **Done** — verified via a real packaged installer, not just dev mode |
| FastAPI **PyInstaller** sidecar binary | **Done** — see above |
| Dynamic port allocation | **Done** — see above |
| OS app-data user-data path | **Done** — see above, including the `app.setName` fix |
| `electron-builder` config: Windows NSIS, macOS/Linux **zip**, GitHub Releases publish provider | **Done** for config; **Windows-verified only** — macOS/Linux zip targets are configured (`npm run dist:mac` / `dist:linux`) but never actually built or run on those OSes from this machine |
| `electron-updater` wired (`checkForUpdatesAndNotify` on packaged launch) | **Done**, but **unverified** — needs an actual published release to test against |
| Code signing | **Blocked on a real certificate.** `electron-builder` auto-detects the standard `CSC_LINK` (path/URL to a `.pfx`/`.p12`) and `CSC_KEY_PASSWORD` env vars — set them and it signs automatically, no config change needed. Nobody has provided a cert, so builds are unsigned today (confirmed in build output: `no signing info identified, signing is skipped`) and will trigger Windows SmartScreen warnings. Getting a cert (Windows EV/OV code-signing cert from a CA, or an Apple Developer ID for macOS) is a business/purchasing step, not an engineering one. |
| App icon / branding assets | **Not done** — `desktop/build/` is a placeholder; `electron-builder` falls back to its default icon (confirmed in build output) |
| `npm run desktop:dev`/`dist` npm-workspace quirks | **Hit and fixed**: `electron-builder` couldn't auto-detect the Electron version through hoisted workspace `node_modules` (fixed with an explicit `electronVersion` field); its internal "install production dependencies" step corrupted the hoisted `node_modules` tree entirely, deleting `electron-builder` itself mid-run (fixed with `"npmRebuild": false` — desktop has no native deps needing a rebuild) |

### Known environment quirk (not a code bug)

`ELECTRON_RUN_AS_NODE=1` in the environment forces **any** Electron binary invocation — including
`electron.exe` directly — to run as plain Node instead of launching the real Electron runtime,
producing `Cannot read properties of undefined (reading 'isPackaged')`. Some sandboxed dev/CI
environments set this globally to stop stray GUI processes from launching. If you hit this
locally, `unset ELECTRON_RUN_AS_NODE` (or ensure it isn't inherited) before running
`npm run desktop:dev`.

### Python resolution (dev mode only)

`resolvePythonExecutable()` tries, in order: `ATLAS_PYTHON_PATH` env var (explicit override — use
this if your venv isn't first on PATH), then platform default (`python` on Windows, `python3`
elsewhere). This exists because Windows commonly resolves a bare `python` to the Microsoft Store
app-execution-alias stub when no other interpreter is ahead of it on PATH, which prints an install
prompt instead of running Python — this was hit and worked around during real testing of this
feature, not a hypothetical. Packaged builds don't need this at all — they run the PyInstaller
binary directly, no Python interpreter required on the target machine.

### Commands

```bash
# Build the API sidecar binary (requires PyInstaller: see above)
npm run desktop:build:api

# Launch the Electron shell against the dev sidecar (builds web first)
npm run desktop:dev

# Produce a full Windows installer (builds web + API sidecar first)
npm run desktop:dist

# macOS / Linux zip targets - configured but never built/run on those OSes
npm run --workspace @atlas/desktop dist:mac
npm run --workspace @atlas/desktop dist:linux
```

Verified end-to-end on this machine, twice — once in dev mode and once against the fully packaged
`Atlas Setup 0.1.0.exe` installer's unpacked output: real Electron window opened (confirmed via
`Get-Process` showing `MainWindowTitle: "Project Atlas"`), both sidecars started on dynamically
allocated ports and passed their health checks, the window rendered the actual app UI (live HTTP
traffic to `/api/v1/app/lock`), and a real write correctly persisted to
`AppData\Roaming\Atlas\atlas.db`.

---

## 5. Android packaging (target)

Android is the longer-horizon target because of native health SDK bridges.

### Options

- **Preferred (long term):** native Android shell (Kotlin) with a local runtime and native
  Health Connect / Samsung Health SDK bridges. Secrets in Android Keystore. Sync payloads POST
  to the loopback local runtime only.
- **Short-term proof of concept:** WebView shell + a loopback local service (e.g. Chaquopy/embedded
  Python or a Kotlin reimplementation of the critical endpoints).

### Deliverables

1. `android/` shell project.
2. Local runtime lifecycle inside the app process.
3. Native permission + callback orchestration:
   - Health Connect permission request flow.
   - Samsung Health SDK consent flow.
   - Strava OAuth captured on-device (custom tab + app-scheme redirect, no hosted relay).
4. Android Keystore-backed secret storage.
5. Device sync payloads posted to the existing local bridge endpoints
   (`/api/v1/integrations/health-connect/*`, `/api/v1/integrations/samsung-health/*`).
6. Instrumentation test plan for permission + sync flows.

All connector flows must remain device-local: auth starts on device, callbacks are captured on
device, secrets stay on device, sync jobs run on device.

---

## 6. Local data + migrations for packaging

Persistence now lives in a SQLite file at `apps/api/.local/atlas.db`
(`app/features/shared/services/db.py`, `LocalStateDatabase`), replacing the previous raw JSON
file. It uses WAL mode, explicit transactions, and a `PRAGMA user_version`-driven migration list
rather than a full Alembic/ORM stack — the schema today is one versioned key-value table
(`app_state`) storing the same JSON-shaped payload `state.py` always produced. A one-time
migration imports the legacy `shared-state.json` on first launch if the database is still empty.

Secrets (currently just Strava OAuth tokens) are protected by
`app/features/shared/services/secure_storage.py`, which now picks the strongest available
OS-native store at runtime: **DPAPI** on Windows, **Keychain** via the `security` CLI on macOS,
**libsecret** via `secret-tool` on Linux, falling back to base64 only when none of those are
available or a native call fails. All three run without adding a pip dependency — Keychain and
libsecret shell out to their standard CLI tools the same way DPAPI uses ctypes directly. Android
Keystore is out of scope for this backend; it belongs in the native Android shell once that
packaging target exists (section 5).

Still required before packaging GA (details in `prod-readiness-audit.md` section 2 and the master
TODO):

- Move to normalized, Alembic-managed tables once real relational data arrives (connector sync
  history, planner generation history with foreign keys) — the current KV table is intentionally
  minimal and should not be over-engineered ahead of that need.
- Separate secret storage from general app state (secrets currently live inside the same
  `app_state` SQLite table as everything else, just with the payload protected).
- Add local **backup / export / import** flows.
- The updater must run migrations on first launch of a new version and never destroy user data —
  the `PRAGMA user_version` migration list already gives this for the KV schema; extend it as new
  migrations are added, and never edit a shipped migration function in place.

---

## 7. Configuration and ports

- Backend config lives in `apps/api/app/core/config.py` (`ATLAS_`-prefixed env vars, `.env` file).
- The UI reads `NEXT_PUBLIC_ATLAS_API_URL` (falls back to `@atlas/config` `DEFAULT_API_URL`).
- In packaged builds, the sidecar port is **dynamic**; the shell must inject the resolved
  loopback URL into the UI at launch.
- Bind the sidecar to `127.0.0.1` only. Never bind `0.0.0.0` in a packaged build.

---

## 8. CI/CD and release gates

No CI exists yet. Minimum pipeline:

1. `git init` + `.gitignore` hygiene (section 3).
2. CI on push/PR: `npm ci`, `npm run test:api`, `npm run test:web` (clean build),
   `npm run test:e2e`, `npm run security`.
3. Clean-room install test: fresh checkout → install → build → smoke test.
4. Packaged desktop smoke test (launch app, health-check sidecar, run one nutrition + one
   endurance request, quit cleanly).
5. Android instrumentation smoke test (once `android/` exists).
6. Signed release artifacts uploaded and checksummed.

### Definition of "installable"

A non-technical user can install Atlas locally **without any terminal setup**, the app starts
its own sidecar, detects or assists installing Ollama, and all data stays on device.

---

## 9. Packaging checklist (living)

- [x] `git init` + `.gitignore` covering `.next`, `__pycache__`, `.local`, `test-results`
- [x] `apps/web` clean-before-build step
- [x] SQLite persistence (`LocalStateDatabase`) with versioned migrations + legacy JSON import
- [ ] Release preflight that rejects stale generated artifacts
- [x] `desktop/` Electron project — verified via a real packaged Windows installer (`Atlas Setup
      0.1.0.exe`), not just dev mode
- [x] FastAPI PyInstaller sidecar — built, verified standalone and inside the packaged app
- [x] Sidecar lifecycle manager (start/health/kill, **dynamic** port allocation)
- [x] OS app-data user-data path wired via `ATLAS_LOCAL_DB_PATH` / `ATLAS_LOCAL_STATE_PATH` env vars
- [ ] Signed Windows + macOS installers — blocked on a real code-signing certificate; wiring
      (`CSC_LINK`/`CSC_KEY_PASSWORD`) is ready
- [x] Updater wired (`electron-updater` + GitHub Releases provider) — not yet exercised against a real published release
- [ ] Alembic migrations for normalized tables (once relational data is needed)
- [x] OS-native secret storage (DPAPI / Keychain / libsecret with base64 fallback); Android
      Keystore remains for the native Android shell
- [ ] Backup / export / import
- [ ] `android/` shell + native bridges + Keystore
- [x] CI pipeline (`.github/workflows/ci.yml`: api, web, security, e2e — all green)
- [~] Packaged smoke test — done manually on this machine twice (dev mode + real installer);
      not yet automated into CI
- [ ] Clean-room install test script
- [ ] App icon / branding assets
- [ ] macOS / Linux zip targets actually built and run (config exists, untested off Windows)
- [ ] Release gate: `npm run release:check` green + signed artifacts
