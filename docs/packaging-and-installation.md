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

## 4. Desktop packaging (target)

**Recommended shell: Tauri v2.** It fits a local-first app with a small native footprint, gives
signed installers for Windows/macOS/Linux, and has a mature sidecar model.

### Architecture

```
┌─────────────────────────────────────────────┐
│  Tauri window                                │
│  ┌───────────────────────────────────────┐  │
│  │  Next.js UI (static export or bundled) │  │
│  └───────────────────────────────────────┘  │
│            │ loopback HTTP (127.0.0.1:<port>)│
│  ┌───────────────────────────────────────┐  │
│  │  FastAPI sidecar (PyInstaller binary)  │  │
│  └───────────────────────────────────────┘  │
│            │ loopback HTTP                    │
│  ┌───────────────────────────────────────┐  │
│  │  Ollama (separate local install)       │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Deliverables

1. **`desktop/` Tauri project** wrapping `apps/web`.
   - For the UI, prefer a static/standalone Next build served by the sidecar, or Tauri's
     bundled asset server. Point the UI at `http://127.0.0.1:<allocated-port>` via
     `NEXT_PUBLIC_ATLAS_API_URL`.
2. **FastAPI sidecar binary.**
   - Short term: package `apps/api` with **PyInstaller** into a single executable and register
     it as a Tauri sidecar.
   - Mid term: move the most critical local runtime pieces into Rust/Kotlin where packaging and
     signing are safer.
3. **Sidecar lifecycle manager** (Tauri Rust side):
   - Start the sidecar on app launch, health-check `/api/v1/health` before showing the UI.
   - Allocate a free loopback port dynamically; handle port collisions.
   - Restart on crash with backoff; surface a clear error if it cannot start.
   - Terminate the sidecar cleanly on app exit (no orphaned processes).
4. **User-data location**: store all state in the OS app-data directory
   (`%APPDATA%/Atlas`, `~/Library/Application Support/Atlas`, `~/.local/share/Atlas`).
   Point `ATLAS_LOCAL_STATE_PATH` (see `apps/api/app/core/config.py:local_state_path`) there —
   never inside the app bundle.
5. **Installer + updater**: Tauri's NSIS/MSI (Windows), DMG (macOS), AppImage/deb (Linux) with
   the built-in updater. The updater must preserve user data, secrets, and Ollama model settings.
6. **Signed binaries** for Windows and macOS before any public beta.

### One-command dev preview

Add `npm run desktop:dev` that launches the Tauri shell against the dev sidecar, and
`npm run desktop:build` that produces a local installer for smoke testing.

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

Current persistence is a single JSON file (`apps/api/.local/shared-state.json`) written by
`apps/api/app/features/shared/services/state.py`. This does not survive to production.

Required before packaging GA (details in `prod-readiness-audit.md` section 2 and the master TODO):

- Replace JSON with **SQLite** for structured local state.
- Add **Alembic** migrations with a versioned upgrade path across releases.
- Separate **secret storage** into OS-native vaults (Credential Manager/DPAPI, Keychain,
  libsecret, Android Keystore) rather than the current base64 fallback in `secure_storage.py`.
- Add local **backup / export / import** flows.
- The updater must run migrations on first launch of a new version and never destroy user data.

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

- [ ] `git init` + `.gitignore` covering `.next`, `__pycache__`, `.local`, `test-results`
- [ ] `apps/web` clean-before-build step
- [ ] Release preflight that rejects stale generated artifacts
- [ ] `desktop/` Tauri v2 project
- [ ] FastAPI PyInstaller sidecar
- [ ] Sidecar lifecycle manager (start/health/restart/stop, dynamic port)
- [ ] OS app-data user-data path wired to `ATLAS_LOCAL_STATE_PATH`
- [ ] Signed Windows + macOS installers + updater
- [ ] SQLite + Alembic migrations
- [ ] OS-native secret storage
- [ ] Backup / export / import
- [ ] `android/` shell + native bridges + Keystore
- [ ] CI pipeline + clean-room install test + packaged smoke tests
- [ ] Release gate: `npm run release:check` green + signed artifacts
