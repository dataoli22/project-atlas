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

## 4. Desktop packaging — Electron (implemented this iteration)

**Shell: Electron + `electron-builder` + `electron-updater`.** Chosen over Tauri specifically for
`electron-updater`'s maturity — regular, reliable auto-updates were a hard product requirement,
and Tauri v2's updater is comparatively newer. `electron-builder` publishes signed installers as
**GitHub Releases** on this repo (`dataoli22/project-atlas`); `electron-updater` checks there
automatically. No separate update-hosting infrastructure needed.

### Architecture (as built)

```
┌───────────────────────────────────────────────┐
│  Electron BrowserWindow                        │
│  ┌─────────────────────────────────────────┐  │
│  │  Next.js standalone server (child proc)  │  │  http://127.0.0.1:4173
│  └─────────────────────────────────────────┘  │
│            │ loopback HTTP                      │
│  ┌─────────────────────────────────────────┐  │
│  │  FastAPI sidecar (child process)         │  │  http://127.0.0.1:8756
│  └─────────────────────────────────────────┘  │
│            │ loopback HTTP                      │
│  ┌─────────────────────────────────────────┐  │
│  │  Ollama (separate local install)         │  │  http://localhost:11434
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
```

The Electron **main process** (`desktop/electron/main.js`) owns the sidecar lifecycle: it spawns
both child processes, polls each until healthy, then opens the window pointed at the local Next
server. Both children are killed on quit (including via `taskkill /T /F` on Windows, so nested
child processes don't leak). External links (support/doc URLs) open in the OS browser via
`setWindowOpenHandler`, never inside the app window.

### Fixed ports — a real constraint, not an oversight

Ports are currently **fixed** (API `8756`, web `4173`), not dynamically allocated. This is a
direct consequence of how Next.js handles `NEXT_PUBLIC_*` env vars: server-component data loaders
read `process.env.NEXT_PUBLIC_ATLAS_API_URL` at **runtime** (fine for dynamic ports), but **client
components** that call `fetch` directly (`app-lock-data.ts`'s `verifyAppLockPin`/`updateAppLock`,
similar patterns elsewhere) get that value **inlined into the browser bundle at build time** —
verified by grepping the built `.next/static/chunks` for the literal URL. A desktop-specific build
step (`npm run desktop:build:web`, sets `NEXT_PUBLIC_ATLAS_API_URL=http://127.0.0.1:8756` via
`cross-env`) bakes the fixed port in before Electron ever runs. Dynamic port allocation would need
a way to inject the resolved URL into an already-built client bundle at runtime (e.g. a small
pre-hydration config script tag) instead of relying on a build-time env var — tracked as a
follow-up, not yet implemented.

### What's built vs. still open

| Deliverable | Status |
| --- | --- |
| `desktop/` Electron project wrapping `apps/web` | **Done** |
| Next.js **standalone** output (`output: "standalone"` in `next.config.ts`) | **Done** — lean server.js + only-used deps, verified present after build |
| Sidecar lifecycle manager (start/health-check/kill, both processes) | **Done** — verified live: real Electron window opened, API + web both health-checked, window titled "Project Atlas" |
| `electron-builder` config: Windows NSIS target, GitHub Releases publish provider | **Done** (`desktop/package.json` `build` block) |
| `electron-updater` wired (`checkForUpdatesAndNotify` on packaged launch) | **Done**, but **unverified** — needs an actual signed, published release to test against; today it's wired but never exercised end-to-end |
| FastAPI **PyInstaller** sidecar binary (packaged mode) | **Not built.** `resolvePythonExecutable()` explicitly throws in packaged mode with a message pointing here — the desktop shell today only runs `apps/api` from source (dev mode), which is why `npm run desktop:dev` requires a working `python`/`python3` on PATH (or `ATLAS_PYTHON_PATH` override — see below) |
| Dynamic port allocation + collision handling | **Not done** — see the fixed-ports note above |
| User-data location (OS app-data dir, not fixed to `apps/api/.local`) | **Not done** — packaged builds still need to point `ATLAS_LOCAL_DB_PATH`/`ATLAS_LOCAL_STATE_PATH` at the OS app-data directory |
| Signed binaries | **Not done** — no code-signing certificate configured yet; unsigned builds will trigger SmartScreen/Gatekeeper warnings |
| App icon / branding assets | **Not done** — `desktop/build/` is a placeholder; `electron-builder` falls back to its default icon |
| macOS / Linux targets | **Not configured** — Windows-only for now (matches the only platform this was built and tested on); extending to `mac`/`linux` blocks in `electron-builder`'s config is mechanical but each needs to actually be built and smoke-tested on that OS (e.g. via CI matrix), not just declared |

### Known environment quirk (not a code bug)

`ELECTRON_RUN_AS_NODE=1` in the environment forces **any** Electron binary invocation — including
`electron.exe` directly — to run as plain Node instead of launching the real Electron runtime,
producing `Cannot read properties of undefined (reading 'isPackaged')`. Some sandboxed dev/CI
environments set this globally to stop stray GUI processes from launching. If you hit this
locally, `unset ELECTRON_RUN_AS_NODE` (or ensure it isn't inherited) before running
`npm run desktop:dev`.

### Python resolution

`resolvePythonExecutable()` tries, in order: `ATLAS_PYTHON_PATH` env var (explicit override — use
this if your venv isn't first on PATH), then platform default (`python` on Windows, `python3`
elsewhere). This exists because Windows commonly resolves a bare `python` to the Microsoft Store
app-execution-alias stub when no other interpreter is ahead of it on PATH, which prints an install
prompt instead of running Python — this was hit and worked around during real testing of this
feature, not a hypothetical.

### Commands

```bash
# One-time: build the web app with the fixed desktop API URL baked in
npm run desktop:build:web

# Launch the Electron shell against the dev sidecar (rebuilds web first)
npm run desktop:dev

# Produce a local installer for smoke testing (rebuilds web first)
npm run desktop:dist
```

`npm run desktop:dev` was verified end-to-end on this machine: real Electron window opened
(confirmed via `Get-Process` showing `MainWindowTitle: "Project Atlas"`), both sidecars started
and passed their health checks, and the window rendered the actual app UI (confirmed via live
HTTP traffic to `/api/v1/app/lock` from the loaded page).

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
- [x] `desktop/` Electron project (verified: real window launches, both sidecars health-check)
- [ ] FastAPI PyInstaller sidecar (packaged mode currently throws with a clear message — dev-only today)
- [x] Sidecar lifecycle manager (start/health/kill) — dynamic port allocation still open, see section 4
- [ ] OS app-data user-data path wired to `ATLAS_LOCAL_DB_PATH` / `ATLAS_LOCAL_STATE_PATH`
- [ ] Signed Windows + macOS installers
- [x] Updater wired (`electron-updater` + GitHub Releases provider) — not yet exercised against a real published release
- [ ] Alembic migrations for normalized tables (once relational data is needed)
- [x] OS-native secret storage (DPAPI / Keychain / libsecret with base64 fallback); Android
      Keystore remains for the native Android shell
- [ ] Backup / export / import
- [ ] `android/` shell + native bridges + Keystore
- [x] CI pipeline (`.github/workflows/ci.yml`: api, web, security, e2e — all green)
- [ ] Clean-room install test script + packaged smoke tests
- [ ] Release gate: `npm run release:check` green + signed artifacts
