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

- Backend tests: **61 passing** (`npm run test:api`).
- Web production build: fixed with a clean-before-build step; green in CI and locally.
- Repo is a git repository, pushed to `https://github.com/dataoli22/project-atlas` (private).
- CI is live at `.github/workflows/ci.yml` (api / web / security / e2e), all green.
- Data layer: **SQLite-backed** (`LocalStateDatabase`), replacing the raw JSON file, with a
  one-time legacy-JSON import path.
- Secrets: **OS-native storage** (DPAPI / Keychain / libsecret) with base64 fallback, replacing
  the previous Windows-only DPAPI-or-base64 split.
- Remaining P0 in section 2: separate secret storage from general app state, local
  backup/export/import, Alembic migrations once relational tables are needed.
- This iteration added: nutrition refresh + 7-day calendar + meal prep hacks + video links, and
  endurance coach support links (see `nutrition-endurance-feature-spec.md`).

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

## 3. Authentication & permissions — Shared shell agent · P1

- [ ] Decide identity model (recommend: single-user local, explicitly codified).
- [ ] Remove cloud-style auth ambiguity from the stub login.
- [ ] Optional app lock for shared devices.
- [ ] Permission gates on destructive actions (disconnect, delete history, rotate secrets, reset
      plans).

## 4. Ollama on-device — Shared shell agent · P0/P1

(Details: `ollama-on-device-and-agents.md` section 5.)

- [ ] P0: bind loopback by default; warn on non-local base URL in the settings UI.
- [ ] P0: first-run detection wizard (installed? running? chat model? embed model?).
- [ ] P1: model bootstrap UX (pull button + progress + disk usage + cancel/retry).
- [ ] P1: validate selected model on save; clear fallback when missing.
- [ ] P1: consistent structured provider errors in chat (not only settings).
- [ ] P1: on-device token + latency telemetry and per-feature budgeting.
- [ ] P0: onboarding "nothing leaves this device" copy; label Groq as the only egress path.
- [ ] P2: embedding pipeline (only when retrieval/memory features arrive).

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

## 9. Packaging & installers — Shared shell agent · P0/P1

(Details: `packaging-and-installation.md`.)

- [ ] `desktop/` Tauri v2 project wrapping `apps/web`.
- [ ] FastAPI PyInstaller sidecar + lifecycle manager (dynamic port, health, restart, clean stop).
- [ ] OS app-data user-data path via `ATLAS_LOCAL_STATE_PATH`.
- [ ] Signed Windows + macOS installers + updater preserving user data/secrets/model settings.
- [ ] `android/` shell + native bridges + Keystore (P1/P2).
- [ ] Packaged smoke test matrix.

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
