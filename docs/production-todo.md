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

- Backend tests: **38 passing** (`npm run test:api`).
- Web production build: fragile — must clean `apps/web/.next` first (`EINVAL readlink`).
- Repo is **not** a git repository yet.
- Data layer: single JSON file; secrets base64 fallback off-Windows.
- This iteration adds: nutrition refresh + 7-day calendar + meal prep hacks + video links, and
  endurance coach support links (see `nutrition-endurance-feature-spec.md`).

---

## 1. Foundation & hygiene — Shared shell agent · P0

- [ ] `git init`; add `.gitignore` (`.next/`, `__pycache__/`, `*.pyc`, `apps/api/.local/`,
      `e2e/test-results/`, `.venv/`, `node_modules/`); initial commit.
- [ ] `apps/web` clean-before-build (`rimraf .next` in `build`).
- [ ] Release preflight rejecting stale generated artifacts.
- [ ] CI pipeline: `npm ci` → `test:api` → `test:web` (clean) → `test:e2e` → `security`.
- [ ] Clean-room install test from fresh checkout.

## 2. Data, persistence, secrets — Shared shell agent · P0

- [ ] Replace JSON store (`state.py`) with **SQLite** + repository layer.
- [ ] **Alembic** migrations + versioned upgrade path preserved by the updater.
- [ ] OS-native secret storage abstraction (Credential Manager/DPAPI, Keychain, libsecret,
      Android Keystore) replacing base64 fallback in `secure_storage.py`.
- [ ] Separate secret storage from general app state.
- [ ] Local backup / export / import.
- [ ] Durable tables: connector sync history, planner generation history + refresh metadata.
- [ ] Transactional guarantees + corruption recovery.

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
