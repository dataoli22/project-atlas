# Atlas Production TODO (Master TDL + Agent Handoff)

Last updated: July 9, 2026

This is the single, prioritized backlog to take Atlas from its current scaffold-plus-real-slices
state to a production-ready, installable, local-first application. It consolidates
`prod-readiness-audit.md`, `packaging-and-installation.md`, `ollama-on-device-and-agents.md`, and
`nutrition-endurance-feature-spec.md` into an actionable checklist with explicit ownership.

Legend: **[ ]** todo · **[~]** in progress · **[x]** done · **P0** blocking GA · **P1** important ·
**P2** later.

---

## 0. Current status snapshot

- Backend tests: **89 passing** (`npm run test:api`).
- Web production build: fixed with a clean-before-build step; green in CI and locally.
- Repo is a git repository, pushed to `https://github.com/dataoli22/project-atlas` (private).
- CI is live at `.github/workflows/ci.yml` (api / web / security / e2e), all green.
- Data layer: **SQLite-backed** (`LocalStateDatabase`), replacing the raw JSON file, with a
  one-time legacy-JSON import path.
- Secrets: **OS-native storage** (DPAPI / Keychain / libsecret) with base64 fallback, replacing
  the previous Windows-only DPAPI-or-base64 split.
- Identity/permissions: **single-user local model codified**, cloud-style login stub removed,
  optional local **app lock** (PIN) shipped end-to-end (backend + settings UI + shell gate), and
  a confirmation gate on the one existing destructive action (integration disconnect).
- AI runtime: **cloud-first with automatic on-device Ollama fallback** (`local_only_mode` default
  flipped `true` → `false`), a real first-run detection wizard, a model pull button, structured
  provider error classification in chat, and a fixed model-tag-matching bug — all verified live
  against a real running Ollama instance, not just mocks. See section 4 and
  `ollama-on-device-and-agents.md`.
- Remaining P0 in section 2: separate secret storage from general app state, local
  backup/export/import, Alembic migrations once relational tables are needed.
- Packaging: a `desktop/` **Electron** shell now exists (product decision, supersedes the
  originally recommended Tauri v2 — `electron-updater` + GitHub Releases was chosen for
  auto-update maturity). Sidecar lifecycle verified live (real window, both processes
  health-checked). Still open: PyInstaller sidecar binary for packaged mode, dynamic ports,
  signing, branding, macOS/Linux targets. See section 9 and `packaging-and-installation.md`.
- This iteration also added: nutrition refresh + 7-day calendar + meal prep hacks + video links,
  and endurance coach support links (see `nutrition-endurance-feature-spec.md`).

### CI security scan triage (July 9, 2026)

- **Bandit** (12 Low / 7 Medium, 0 High): all false positives — B105 "hardcoded password"
  flags trigger on dict keys named `access_token`/`refresh_token` whose *value* is `None`, not
  real secrets. No action needed; consider a `.bandit` skip config for B105 in this file if noise
  becomes a problem.
- **npm audit** (1 moderate): PostCSS XSS via Next's transitive `postcss` dependency
  (GHSA-qx2v-qp2m-jg93). The only fix path is a breaking Next major-version bump — not applied
  without dedicated testing. Tracked as a P1 dependency upgrade.
- **pip-audit** (1 low): `pytest` 8.4.2 → fixed in 9.0.3. **Fixed** — bumped
  `apps/api/requirements.txt` to `pytest>=9,<10` and verified all 44 tests still pass.

---

## 1. Foundation & hygiene — Shared shell agent · P0 — DONE (except preflight + clean-room test)

- [x] `git init`; `.gitignore` covers `.next/`, `__pycache__/`, `*.pyc`, `apps/api/.local/`,
      `e2e/test-results/`, `.pytest_cache/`, `.venv/`, `node_modules/`, `*.log`; initial commit
      pushed to `https://github.com/dataoli22/project-atlas` (private, `main`).
- [x] `apps/web` clean-before-build (`rimraf .next` in `build`); verified with two consecutive
      clean builds.
- [x] CI pipeline added at `.github/workflows/ci.yml`: `api` (pytest), `web` (lint + clean build),
      `security` (npm audit / pip-audit / bandit, non-blocking), `e2e` (Playwright).
- [ ] Release preflight rejecting stale generated artifacts.
- [ ] Clean-room install test from fresh checkout (CI now provides this per-push; a documented
      manual clean-room script is still outstanding).

> Note: this workspace's checkout lives under OneDrive, which can transiently `EPERM`-lock
> `.next` files during sync. Retrying the build succeeds; see `packaging-and-installation.md`
> section 3 for the full explanation. CI runners are unaffected.

## 2. Data, persistence, secrets — Shared shell agent · P0

- [x] Replace JSON store (`state.py`) with **SQLite**: `apps/api/app/features/shared/services/db.py`
      (`LocalStateDatabase`) — a small versioned key-value table (`app_state`) with WAL mode and
      `PRAGMA user_version`-driven migrations, rather than a full ORM/Alembic stack, since the
      state shape is still a single JSON-shaped blob per feature area. Wired into `state.py`'s
      existing `_load_persisted_state` / `_persist_state_unlocked` choke points, so all 15
      mutating call sites were untouched. One-time JSON→SQLite import runs on first launch when
      the DB is empty and a legacy `shared-state.json` exists (never overwrites newer DB state).
      Verified manually: round-trip across process restart, legacy JSON import, and via 9 new
      tests in `apps/api/tests/test_local_state_database.py` (53 total passing). Persistence
      stays fully disabled under `PYTEST_CURRENT_TEST`, matching prior behavior exactly.
- [ ] **Alembic** migrations — deferred. The current schema is one KV table; reach for
      Alembic-managed relational tables when a real normalized schema (e.g. connector sync
      history, planner generation history with foreign keys) is introduced. Revisit alongside the
      "durable tables" item below.
- [x] OS-native secret storage abstraction: `apps/api/app/features/shared/services/secure_storage.py`
      now supports **DPAPI** (Windows, unchanged, ctypes-only), **Keychain** (macOS, via the
      `security` CLI) and **libsecret** (Linux, via the `secret-tool` CLI) — no new pip
      dependencies, matching the existing ctypes-only DPAPI approach. `build_local_secret_protector()`
      detects the platform and tool availability (`shutil.which`) and picks the strongest
      available scheme, falling back to base64 per-secret if a native call fails. Android Keystore
      is intentionally **not** implemented here — it belongs in the native Android app, not this
      Python service (tracked in `packaging-and-installation.md` section 5).
      Architectural note: DPAPI is a true encrypt/decrypt-a-blob API, but Keychain/libsecret are
      OS-managed secret *stores* — you save a secret under a stable name and look it up later, you
      don't carry ciphertext yourself. So `protect`/`unprotect` now take a required `key`
      identifier (e.g. `"strava_access_token"`); DPAPI/base64 ignore it, Keychain/libsecret use it
      as the vault entry name.
      Verified: real DPAPI protect/unprotect round-trip and a full Strava-token round-trip through
      DPAPI + SQLite across a process restart, both manually on this Windows box (only platform
      testable here). Keychain/libsecret are covered by 6 new tests against mocked `subprocess.run`
      calls (round-trip + CLI-failure fallback), so the logic is verified on any CI runner even
      without the real OS vault present. 61 tests total passing (was 53).
- [ ] Separate secret storage from general app state.
- [ ] Local backup / export / import.
- [ ] Durable tables: connector sync history, planner generation history + refresh metadata
      (would motivate moving off the single KV table above).
- [x] Transactional guarantees + corruption recovery: SQLite WAL mode + explicit
      commit/rollback in `LocalStateDatabase._transaction`; a corrupt DB file raises loudly at
      startup instead of silently discarding state (covered by
      `test_corrupt_db_file_raises_rather_than_silently_losing_data`).

## 3. Authentication & permissions — Shared shell agent · P1 — DONE

- [x] Decided identity model: **single-user, local-only, explicitly codified.** Atlas has no
      accounts, no server-side session, and no password auth. `GET /api/v1/me` remains as the
      honest "local device identity" concept (matches `UserSummary`, unchanged).
- [x] Removed cloud-style auth ambiguity: deleted `POST /api/v1/auth/login` and the
      `LoginRequest`/`LoginResponse` schemas (a password-accepting endpoint that returned a fake
      `"atlas-dev-token"` and was never called by the frontend). `apps/api/README.md` updated.
- [x] Optional app lock for shared devices: `apps/api/app/features/shared/services/app_lock.py`
      (PBKDF2-HMAC-SHA256, 200k iterations, per-install random salt, `hmac.compare_digest`
      constant-time verify — stdlib only, no new dependency) plus `AppLockSettings` /
      `AppLockUpdateRequest` / `AppLockVerifyRequest` schemas, three new endpoints
      (`GET/PUT /app/lock`, `POST /app/lock/verify`), and `SharedStateStore` methods persisted
      through the existing SQLite-backed `_persist_state_unlocked` payload. Deliberately
      **verify-only** (unlike the OAuth-token secret storage): there is no PIN recovery by
      design, matching a local-first single-user app — the only reset path is disabling the lock
      via direct local database access.
      Frontend: `apps/web/components/app-lock-gate.tsx` (client component wrapping the shell
      layout — blocks rendering until the correct PIN is verified against the local backend,
      unlock state cached in `sessionStorage` only) and
      `apps/web/components/app-lock-settings-form.tsx` (enable/change/disable PIN) wired into
      `apps/(shell)/layout.tsx` and `/settings`. `getAppLockSettingsData()` fails **open** to
      "disabled" if the backend is unreachable at layout render (a local-first app with no
      running backend has nothing to protect yet), but `verifyAppLockPin()` fails **closed** — a
      network error never auto-unlocks. Verified manually end-to-end against a running server:
      SSR correctly renders the PIN screen when a lock is set, correct/incorrect PINs behave as
      expected, and disabling requires the current PIN. Note: this is a device-level UX deterrent
      for shared computers, not real authentication — the backend has no session/token concept,
      loopback access to the API itself is still unauthenticated (acceptable for a
      single-user local app, but worth remembering if the loopback port is ever exposed beyond
      localhost).
- [x] Permission gates on destructive actions: `disconnect_integration` now requires an explicit
      `{"confirm": true}` request body (a body-less or `confirm: false` request now 400s,
      covered by `test_disconnect_requires_explicit_confirmation`); the frontend disconnect
      button now shows a native confirm dialog before sending the confirmed request. "Delete
      history" and "rotate secrets" have no endpoints yet — add the same `confirm: true` gate
      pattern when those features are built, don't invent new destructive endpoints just to gate
      them. Nutrition plan refresh was deliberately **not** gated the same way since it already
      preserves prior state in swap history rather than destroying it (see section 6a).
      Full suite: 72 tests passing (was 61).

## 4. Ollama on-device / cloud-first AI runtime — Shared shell agent · P0/P1 — MOSTLY DONE

(Details: `ollama-on-device-and-agents.md`, fully rewritten this iteration — read it, not just
this summary.)

> **Posture pivot**: Atlas now prefers a cloud provider once configured (Groq free tier, or
> Ollama pointed at a cloud endpoint) for speed/capability, with automatic on-device Ollama
> fallback on failure. `local_only_mode` default flipped `true` → `false`; it remains available
> as an opt-in hard on-device guarantee. Keys/prompts still never route through an Atlas-hosted
> relay either way — only which provider is *preferred* changed, not where routing happens.
> `README.md`, `docs/prod-readiness-audit.md` section 4 (pointer + history note), and `.env.example`
> updated to match.

- [x] P0: warn on non-local base URL in the settings UI (`isLocalBaseUrl` banner in
      `ai-runtime-settings-form.tsx`). Sidecar-itself-binds-loopback-only is still open, tracked
      under packaging (section 9) since it only applies once a packaged sidecar exists.
- [x] P0: first-run detection wizard — installed (PATH-detected, local-target-only) / running /
      chat model / embed model, each with remediation copy, rendered as a numbered checklist in
      settings. Fixed a real bug found via live testing: Ollama's `/api/tags` returns
      fully-qualified names (`model:latest`) while configured names are often bare, causing
      false "not installed" results — `_normalize_model_tag` fixes this.
- [~] P1: model bootstrap UX — pull button implemented (`POST /settings/ai/pull`, blocking
      `stream:false`, real success/failure result); live percentage progress, disk usage, and
      cancel/retry are explicitly deferred (would need an NDJSON streaming proxy).
- [x] P1: validate selected model — the first-run wizard is the validation surface; chat's
      automatic local-Ollama fallback is the "clear fallback when missing" behavior.
- [x] P1: consistent structured provider errors in chat — `ChatResponse.provider_error_kind`
      (`service_down | model_missing | timeout | connection_refused | auth_rejected | other`),
      displayed as a distinct panel in the Ask Atlas UI, not just a free-text warning.
- [ ] P1: on-device token + latency telemetry and per-feature budgeting — not started.
- [x] P0: onboarding copy — "Where your data goes" section explains the cloud-first-with-local-
      fallback posture honestly (superseded the original "nothing leaves this device" framing,
      which is no longer accurate as the *default*; `local_only_mode` still delivers that
      guarantee when enabled).
- [ ] P2: embedding pipeline (only when retrieval/memory features arrive) — not started, correctly
      still deferred.
- [x] **New this iteration, not originally listed**: real end-to-end verification against a live
      Ollama 0.31.1 instance (not just mocks) — caught and fixed the tag-normalization bug above,
      and the OllamaProviderClient timeout being too tight for real local hardware (was 20s,
      observed ~25s for a 3-word reply from a 7B model on CPU; now 120s). Also added a genuine
      provider attempt chain in `chat.py` (`_build_provider_attempts`) with dedicated tests
      (`test_chat_falls_back_to_local_ollama_when_cloud_ollama_fails`, etc.) and two new backend
      test files (`test_ollama_runtime.py`, `test_ai_runtime_router.py`).

## 5. Agent orchestration — Shared shell agent · P1

- [ ] Explicit handoff contract: structured request envelope (goal, feature, approved
      cross-feature context, connector freshness, confidence, response budget).
- [ ] Structured, validated output schema per agent.
- [ ] Response provenance (`deterministic-only` / `+model wording` / `model-only`).
- [ ] Guardrail tests for unsafe medical/nutrition advice.
- [ ] Prompt versioning + changelog; local prompt packs for offline packaged builds.

## 6. Nutrition — Nutrition agent

### 6a. This iteration · P1 (see feature spec Part A) — DONE
- [x] Shared TS contracts for refresh/calendar/prep-hacks/videos (`packages/shared/src/index.ts`).
- [x] Backend schemas + service: `calendar_days` (7), `meal_prep_hacks`, `video_links`, `refresh`
      metadata, `swap_history`.
- [x] `POST /nutrition/planner/refresh` with persisted swap history + 7-day due date.
- [x] Frontend: 7-day calendar view, plan status banner, refresh control (server action),
      prep-hacks panel, video resource strip; prep hacks on cooking page.
- [x] Tests for calendar count, refresh metadata, refresh endpoint, staleness, localization.

### 6b. Later · P1/P2
- [ ] Replace deterministic blueprints with a true weekly **optimizer** (recipe library + price
      layer) behind the same contracts.
- [ ] Pantry inventory / "already have this" logic.
- [ ] Recipe source system + "why did the plan change" explanation from real deltas.
- [ ] Browser-search provider for fallback links (then Playwright/browser-use behind the interface).

## 7. Endurance — Endurance agent

### 7a. This iteration · P1 (see feature spec Part B) — DONE
- [x] Shared TS contracts for `EnduranceSupportLink` + `supportLinks` on dashboard/insights.
- [x] Backend schemas + service: `support_links` (contextual connector-setup) in stub + live paths.
- [x] Frontend: coach support resources panel on dashboard + capability pages, non-medical note.
- [x] Tests: support links present + valid; connector-setup link when a connector is disconnected.

### 7b. Later · P1/P2
- [ ] Real readiness scoring; training-load model with windowing + decay.
- [ ] Connector freshness + coverage confidence surfaced in scores.
- [ ] Sleep/HR/HRV/resting-HR/hydration/body-weight normalization rules.
- [ ] Cross-source conflict resolution + session deduplication.
- [ ] Calendarized training plan / coach follow-up surface.
- [ ] Explicit escalation flow for medical red flags / overtraining / injury language.

## 8. Connectors & native bridges — Shared shell + Endurance agents · P1

- [ ] Desktop callback capture in the packaged shell (no manual code entry).
- [ ] Android permission + callback orchestration; native Health Connect / Samsung Health SDK
      bridges posting to existing local bridge endpoints.
- [ ] Sync retry queue + backoff; token refresh scheduler; permission revocation handling.
- [ ] Richer sync payload mapping for all three connectors.

## 9. Packaging & installers — Shared shell agent · P0/P1 — DESKTOP SHELL STARTED

(Details: `packaging-and-installation.md` section 4 — read it, not just this summary.)

> **Shell choice changed from the originally recommended Tauri v2 to Electron** (explicit
> product decision: `electron-updater` + GitHub Releases is more mature for the "regular app
> updates" requirement than Tauri v2's newer updater). `docs/prod-readiness-audit.md`'s original
> Tauri recommendation is now superseded — see the note there.

- [x] `desktop/` **Electron** project wrapping `apps/web` — verified live: real window launched
      (title "Project Atlas"), both sidecars spawned and passed health checks.
- [x] Sidecar lifecycle manager: start both child processes (FastAPI + Next.js standalone
      server), poll health, kill on quit (including nested children via `taskkill /T /F` on
      Windows). **Fixed ports** (API `8756`, web `4173`), not dynamic — see the packaging doc for
      why (client-component `NEXT_PUBLIC_*` values are baked into the browser bundle at build
      time, so a desktop-specific build step bakes in the fixed port).
- [ ] FastAPI **PyInstaller sidecar binary** — not built. Packaged-mode Python resolution
      explicitly throws with a message pointing here; the desktop shell currently only runs
      `apps/api` from source (dev mode).
- [ ] Dynamic port allocation + collision handling.
- [ ] OS app-data user-data path via `ATLAS_LOCAL_STATE_PATH` / `ATLAS_LOCAL_DB_PATH` — packaged
      builds still write to `apps/api/.local` by default, not a real OS app-data directory.
- [x] `electron-updater` wired (GitHub Releases provider, `checkForUpdatesAndNotify` on packaged
      launch) — **not yet verified against a real published release**, only that it's wired.
- [ ] Signed Windows + macOS installers — no code-signing certificate configured; unsigned builds
      trigger SmartScreen/Gatekeeper warnings.
- [ ] App icon / branding assets (`desktop/build/` is a placeholder).
- [ ] macOS / Linux `electron-builder` targets — Windows-only for now, matching the only platform
      this was actually built and tested on.
- [ ] `android/` shell + native bridges + Keystore (P1/P2) — Electron is desktop-only; Android
      remains a separate native track, unaffected by this section's work.
- [ ] Packaged smoke test matrix (beyond the one manual `npm run desktop:dev` verification done
      here).

## 10. Frontend hardening — Shared shell + feature agents · P1

- [ ] Real loading / empty / stale / retry states per route.
- [ ] Error boundaries + route-level recovery.
- [ ] Accessibility audit; responsive QA (desktop + phone).
- [ ] Production-safe cache strategy; version/build metadata display.
- [ ] Upgrade Next.js past the `postcss` XSS advisory (GHSA-qx2v-qp2m-jg93); `npm audit fix
      --force` currently proposes a breaking major bump — needs its own scoped upgrade + full
      regression pass (lint, build, e2e) before landing.

## 11. Backend hardening — Shared shell agent · P1

- [ ] Structured logging + request IDs + tracing + metrics.
- [ ] Dependency health endpoints; startup config validation.
- [ ] Timeout + retry policies for external providers.
- [ ] Versioned API compatibility policy; OpenAPI review.

## 12. Quality, testing, CI/CD · P0/P1

- [ ] Frontend shared-loader contract/snapshot tests.
- [ ] Prompt regression tests; connector replay tests with fixtures.
- [ ] Persistence migration tests; offline-mode tests; upgrade/rollback tests.
- [ ] Release gates (all must pass): clean-checkout install, `test:api`, clean web build,
      `security`, packaged desktop smoke, connector fallback modes, Ollama health + model check.

## 13. Documentation still needed · P1

- [ ] End-user desktop install guide; Android install guide.
- [ ] First-run Ollama setup guide (user-facing).
- [ ] Integration troubleshooting guide; data retention & privacy guide.
- [ ] Recovery/restore guide; backup/export guide; agent prompt/version maintenance guide.

---

## Implementation sequence (recommended)

1. Foundation & hygiene (git, clean build, CI) — section 1.
2. SQLite + migrations + secure storage — section 2.
3. This iteration's nutrition + endurance features — sections 6a, 7a. ← **in progress now**
4. Packaged desktop shell + sidecar lifecycle — section 9.
5. Packaged callback + native consent flows — section 8.
6. Real nutrition optimizer + persisted history — section 6b.
7. Explainable endurance scoring — section 7b.
8. CI/CD, signing, observability, crash handling, release gates — sections 11, 12.
9. Android package + native bridges — sections 8, 9.

---

## Agent handoff instructions

These describe ownership boundaries for coding agents. **Do not break** the local-first default,
loopback-only runtime, deterministic-first reasoning, or existing shared-schema compatibility.

### Shared shell agent
Owns packaging shell, local runtime lifecycle, settings contracts, secret storage, AI runtime UX,
connector UX states, refresh orchestration, persistence, CI/build hygiene.
Start files: `apps/api/app/features/shared/schemas/app.py`, `.../services/state.py`,
`.../services/ai.py`, `apps/web/components/ai-runtime-settings-form.tsx`,
`apps/web/components/integration-connect-form.tsx`.
First tasks: sections 1, 2, 4, 9.

### Nutrition agent
Owns planner engine, shopping derivation, substitutions, meal prep hacks, video links, seven-day
refresh logic, weekly calendar data. Do not break localization/currency, fallback compatibility,
or the low-cost/low-friction bias. Do **not** edit `packages/shared/src/index.ts` (owned by the
integrator) or `agent_runtime.py`.
Start files: `apps/api/app/features/nutrition/{schemas,service,router}.py`,
`apps/web/lib/nutrition-data.ts`, `apps/web/app/(shell)/{planner,cooking,shopping}/page.tsx`.
First tasks: section 6a.

### Endurance agent
Owns data normalization, readiness/capability scoring, connector confidence, support links,
coaching explanation layer. Do not break shared connector contracts, local-first sync assumptions,
or deterministic-first reasoning. Do **not** edit `packages/shared/src/index.ts` or
`agent_runtime.py`.
Start files: `apps/api/app/features/endurance/{schemas,service}.py`,
`apps/web/lib/endurance-data.ts`, `apps/web/app/(shell)/{dashboard,timeline,capability}/page.tsx`.
First tasks: section 7a.

### Coordination rule
`packages/shared/src/index.ts` and `apps/api/app/features/shared/services/agent_runtime.py` are
**shared/integrator-owned** files. Feature agents rely on their contracts but do not edit them
concurrently, to avoid merge conflicts. All new response fields must be additive and match
snake_case (Python) ↔ camelCase (TS) exactly.
