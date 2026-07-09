# Project Atlas Prod Readiness Audit

Last updated: July 9, 2026

This document is the working audit for the current Atlas repository. It explains what is already present, what is still scaffolded, what must be implemented before production, how local packaging should work, how Ollama must stay on device, and how work should be handed off across the Atlas agents.

## Executive Summary

Atlas already has a meaningful local-first foundation:

- Monorepo with `apps/web`, `apps/api`, `packages/shared`, `packages/config`, and `packages/ui`
- FastAPI backend with typed routes for shared settings, AI runtime settings, chat, endurance, nutrition, and integration scaffolding
- Next.js frontend with shared shell routes for onboarding, settings, endurance, nutrition, shopping, cooking, timeline, and chat
- Local-first AI posture with Ollama as default and optional Groq override
- Replaceable integration contracts for Strava, Health Connect, and Samsung Health
- Shared agent prompts in `.agents/`
- Passing backend test suite

Atlas is not yet production-ready. The largest remaining gaps are:

- No packaged desktop or Android runtime yet
- No persistent production data layer, migrations, or account model
- Nutrition planner is still deterministic blueprint logic rather than a real refreshable planning engine
- Endurance scoring is still heuristic and not yet backed by robust normalization, sync jobs, or explainable scoring pipelines
- Secret handling is not yet production-grade across all target platforms
- Frontend production build is currently fragile in this workspace because stale generated output under `apps/web/.next` can break `next build`
- CI/CD, installer signing, observability, crash reporting, and offline sync reliability are still missing

## Verified Current State

### Repo shape

- `apps/api`: FastAPI application
- `apps/web`: Next.js 15 app shell
- `packages/shared`: TS contracts for frontend feature data
- `packages/config`: shared defaults such as API URL and market settings
- `packages/ui`: placeholder shared UI package
- `docs/`: architecture, PRDs, security notes, execution tracker
- `.agents/`: handoff prompts for shared shell, endurance, and nutrition work

### What is working now

- Shared feature registry and settings contracts
- Ollama/Groq settings save flow
- Local Ollama health check endpoint and UI
- Chat orchestration with feature-aware grounding and deterministic fallback
- Strava OAuth preparation, callback capture, token exchange scaffolding, and live sync path
- Health Connect and Samsung Health local device-sync bridge contracts
- Nutrition planner, shopping, substitutions, cooking, and product search contracts
- Endurance dashboard, timeline, and capability projections over stub or synced data

### Verification run on July 9, 2026

- `npm run test:api`: passed, `38` tests green
- `npm run build:web`: failed in this workspace because `next build` hit `EINVAL: invalid argument, readlink` while reading `apps/web/.next/export-marker.json`

Interpretation:

- The API baseline is healthy enough to evolve
- The web app still needs a cleaner production build discipline
- Build output directories must be treated as disposable artifacts and never relied on between runs

## Architecture Snapshot

### Backend

Primary implementation lives in:

- `apps/api/app/main.py`
- `apps/api/app/api/router.py`
- `apps/api/app/features/shared/*`
- `apps/api/app/features/endurance/*`
- `apps/api/app/features/nutrition/*`

Current backend posture:

- In-memory plus local JSON state for integration runtime details
- Minimal configuration through environment variables
- No database-backed persistence
- No background workers
- No auth beyond stub login
- No production observability, rate limiting, tracing, or structured audit logging

### Frontend

Primary implementation lives in:

- `apps/web/app/(shell)/*`
- `apps/web/components/*`
- `apps/web/lib/*`

Current frontend posture:

- Server-rendered route pages with modular loaders
- Graceful fallback to stub data when backend is unavailable
- Shared shell navigation and settings flows
- No packaged runtime shell yet
- No calendar planner UX
- No explicit seven-day refresh controls
- No user-facing support link surfaces for nutrition or endurance
- No offline cache or optimistic sync queue

### Shared contracts

Primary implementation lives in:

- `packages/shared/src/index.ts`
- `apps/api/app/features/shared/schemas/app.py`

Current posture:

- Good start on shared typed contracts
- Still missing production-grade versioning strategy
- Missing richer fields required for calendar refresh, meal prep hacks, support links, and refresh provenance

## Production Readiness Gaps

## 1. Platform Packaging And Installation

> **Superseded July 9, 2026** — see `docs/packaging-and-installation.md` section 4 for the
> current, authoritative state. Summary: a `desktop/` **Electron** shell now exists (not Tauri —
> see below), with a working sidecar lifecycle manager, verified live. The `Tauri v2`
> recommendation immediately below is the original, superseded choice, kept for history.

### Current state (original, superseded)

- Dev-only monorepo workflow
- `infra/docker-compose.yml` includes local Postgres and Ollama containers, but Atlas is not yet packaged as a desktop app or Android app
- No installer generation, updater, sidecar lifecycle management, or signed release pipeline

### Must implement (original, superseded)

- Choose desktop shell: `Tauri v2` is the recommended fit for a local-first app with a small native footprint
- Define backend packaging strategy:
  - Short-term: package FastAPI as a sidecar executable
  - Mid-term: move critical local runtime services into a Rust or Kotlin core where packaging is easier and safer
- Define Android packaging strategy:
  - Preferred long-term: native Android shell with local bridge/runtime code
  - Short-term proof-of-concept: WebView shell plus loopback local service
- Add one-command local installer flow for development previews
- Add signed release artifacts for Windows and Android before any public beta
- Add versioned migration path for local data between releases
- Add updater behavior that preserves user data, secrets, and downloaded Ollama model settings

### Packaging deliverables still missing

- Desktop shell project
- Android shell project
- Sidecar process lifecycle manager
- Local port allocation and collision handling
- Installer/uninstaller
- Auto-update strategy
- Signed binaries
- Release smoke test matrix

## 2. Local Data, Persistence, And Security

### Current state

- Shared runtime state persists to `apps/api/.local/shared-state.json`
- Strava tokens are protected with DPAPI on Windows, otherwise base64 fallback
- Shared profile, settings, and integration state are not yet backed by a production store

### Risks

- Base64 fallback is not acceptable for production secret storage
- Current JSON persistence will not scale to real user history, planner generations, sync events, or audit logs
- No schema migration support
- No transactional guarantees
- No corruption recovery story

### Must implement

- Replace ad hoc JSON persistence with a local production store
  - Recommended: `SQLite` for structured local state
  - Add migrations via Alembic or an equivalent migration tool
- Move secrets to OS-backed secure storage
  - Windows Credential Manager or DPAPI-backed vault abstraction
  - macOS Keychain
  - Linux Secret Service/libsecret
  - Android Keystore
- Separate secret storage from general app state
- Add local backup/export/import flows
- Add encrypted-at-rest strategy for high-sensitivity health history if required by product policy
- Add durable sync history tables for connectors
- Add planner generation history and refresh metadata tables

## 3. Authentication, Identity, And Permissions

### Current state

- Login is stubbed
- No multi-user model
- No real session handling
- No role model

### Must implement

- Decide whether Atlas is:
  - Single-user local-only
  - Multi-profile local
  - Account-optional with device profile only
- If single-user local-only, explicitly codify that and remove cloud-style auth ambiguity
- Add app lock options for shared devices
- Add permissions gates around destructive actions such as disconnecting integrations, deleting history, rotating secrets, and resetting plans

## 4. Ollama On-Device Wiring

> **Posture updated July 9, 2026** — see `docs/ollama-on-device-and-agents.md` for the current,
> authoritative version of this section. Summary: Atlas now prefers a cloud provider once
> configured (Groq free tier, or Ollama pointed at a cloud endpoint) for speed and capability,
> and automatically falls back to on-device Ollama if that call fails. Keys and prompts still
> never route through an Atlas-hosted relay either way. `local_only_mode` remains available as an
> opt-in hard guarantee that nothing leaves the device. The "Product requirement" line
> immediately below is the **original** requirement as first written and is kept for history; it
> no longer reflects current default behavior.

### Product requirement (original, superseded — see note above)

Ollama must remain device-local by default. Atlas should never route prompts through an Atlas-hosted service. If users enable Groq, requests may leave the device only to Groq directly from the local runtime.

### Current implementation

- Shared AI settings exist in backend and frontend
- Ollama base URL, chat model, embedding model, and optional key are configurable
- Runtime check calls `/api/version` and `/api/tags`
- Chat calls the local Ollama `/api/chat` endpoint
- Feature-aware agent runtime builds prompts and grounding before provider execution

### Current integration path

1. UI saves AI runtime settings
2. Backend stores settings locally
3. Shared chat route loads current settings
4. `agent_runtime.py` chooses feature scope and prompt profile
5. `chat.py` selects `OllamaProviderClient` unless Groq is enabled and selected
6. `provider_clients.py` calls local Ollama `POST /api/chat`

### Production wiring requirements

- Bind Ollama access to loopback by default
- Treat non-local Ollama base URLs as advanced mode and warn the user clearly
- Add first-run runtime detection:
  - Is Ollama installed?
  - Is the service running?
  - Is the configured model available?
  - Is the embedding model available?
- Add model bootstrap UX:
  - suggested default models
  - model download progress
  - disk usage display
  - cancel/retry support
- Add structured provider error handling:
  - service down
  - model missing
  - timeout
  - connection refused
  - loopback blocked by firewall
- Add local telemetry counters without sending health data off device
- Add token and latency budgeting per feature
- Add embedding pipeline only when retrieval or memory features are introduced
- Add a packaging-time decision:
  - require separate Ollama installation
  - or detect and assist with install on first launch

### Recommended install docs to surface in product

- Ollama download: `https://ollama.com/download`
- Ollama docs: `https://ollama.com/library`
- Ollama API docs: `https://github.com/ollama/ollama/blob/main/docs/api.md`

### Production UX still missing

- Install wizard for Ollama
- Auto-detection of running local daemon
- Pull-model button and progress UI
- Local model validation on save
- Fallback path when the selected model is not installed
- Device storage warning when models are large
- Clear "nothing leaves this device" copy in onboarding

## 5. Agent Integration Architecture

### Current agent model

- `shared-shell-agent.md`: owns shell, settings, runtime, guardrails, connectors
- `endurance-agent.md`: owns health/activity normalization and coaching outputs
- `nutrition-agent.md`: owns meal planning, shopping, substitutions, cooking

### Current code integration

- Agent prompt profiles are assembled in `apps/api/app/features/shared/services/ai.py`
- Feature grounding is assembled in `apps/api/app/features/shared/services/agent_runtime.py`
- Provider calls happen in `apps/api/app/features/shared/services/chat.py`

### Production requirements for agent orchestration

- Introduce explicit agent handoff contracts instead of implicit feature routing only
- Add structured request envelope:
  - user goal
  - active feature
  - approved cross-feature context
  - connector freshness timestamps
  - confidence level
  - response budget
- Add structured output schema per agent
- Add response provenance:
  - deterministic only
  - deterministic plus model wording
  - model-only suggestion
- Add guardrail test coverage for unsafe medical or nutrition advice
- Add prompt versioning with changelog
- Add local prompt packs so packaged builds can ship stable prompts offline

## 6. Endurance Feature Gaps

### Current state

- Dashboard, timeline, and capability views exist
- Multi-source sync payloads can feed the same surface
- Scoring is heuristic
- Supportive coaching copy exists

### Still missing for production

- Real readiness scoring methodology
- Training load model with explicit windowing and decay
- Connector freshness and coverage confidence
- Sleep, HR, HRV, resting HR, hydration, body weight normalization rules
- Conflict resolution across Strava, Health Connect, and Samsung Health
- Deduplication rules for sessions captured by multiple systems
- Calendarized training plan or coach follow-up surface
- Endurance support links surfaced directly in the UI
- Explicit escalation flows for medical red flags, overtraining risk, or injury language

### Support links that should be surfaced by the endurance coach

- Strava auth docs: `https://developers.strava.com/docs/authentication/`
- Health Connect docs: `https://developer.android.com/health-and-fitness/guides/health-connect`
- Samsung Health Android docs: `https://developer.samsung.com/health/android`
- YouTube search for recovery mobility routines: `https://www.youtube.com/results?search_query=runner+recovery+mobility+routine`
- YouTube search for strength for runners: `https://www.youtube.com/results?search_query=strength+training+for+runners`
- YouTube search for endurance base training: `https://www.youtube.com/results?search_query=endurance+base+training+for+beginners`

### Product work to add

- Add `supportLinks` to endurance responses
- Add "why this link is relevant" labels
- Add freshness timestamp for each support recommendation
- Separate support resources from medical advice

## 7. Nutrition Feature Gaps

### Current state

- Weekly planner returns deterministic market blueprints
- Shopping list, substitutions, and cooking plan are derived from the same blueprint
- Product search and barcode lookup contracts exist

### What is still missing

- No real optimizer
- No true refresh flow
- No persisted weekly plan history
- No meal-prep hacks in the contract
- No calendar view data model
- No YouTube video links
- No support links for the endurance-coach-adjacent behavior requested by product
- No pantry inventory or "already have this" logic
- No recipe source system
- No "why did the plan change" explanation

### Required nutrition contract additions

Add the following to shared backend and frontend schemas:

- `plan_id`
- `week_start_date`
- `week_end_date`
- `refresh_due_at`
- `last_refreshed_at`
- `refresh_interval_days`
- `refresh_reason`
- `calendar_days`
- `meal_prep_hacks`
- `video_links`
- `support_links`
- `swap_history`
- `planner_version`
- `data_freshness`

### Calendar view requirements

The planner should become a real seven-day calendar surface.

Required behavior:

- Show one card or row per day for exactly seven days
- Refresh the plan every seven days by default
- Allow manual refresh before day seven with an explanation of what changed
- Preserve the previous plan in history instead of overwriting silently
- Show whether a plan is:
  - current
  - refreshing
  - stale
  - failed to refresh
- Show carryover leftovers visually from one day to the next
- Show prep windows and batch-cook anchors on the calendar itself
- Support both mobile scrolling and desktop week grid

### Meal prep hacks to add

Each weekly plan should include practical execution helpers such as:

- batch-cook grains once, reuse across 2-3 meals
- pre-chop repeat vegetables after shopping day
- stage breakfast jars or snack boxes for 3 days at a time
- freeze one fallback meal on the main batch day
- plan one "low-energy night" dinner that uses leftovers or pantry staples
- mark ingredients that appear in 3 or more meals as first-pass prep items

Implementation requirement:

- Add a typed `mealPrepHacks` array to the planner response
- Each entry should have:
  - `title`
  - `detail`
  - `appliesToDays`
  - `estimatedTimeSavedMinutes`
  - `difficulty`

### YouTube links to include in the nutrition experience

Add a resource strip or support panel with links such as:

- Beginner weekly meal prep search: `https://www.youtube.com/results?search_query=beginner+weekly+meal+prep`
- Budget meal prep search: `https://www.youtube.com/results?search_query=budget+healthy+meal+prep`
- High protein meal prep search: `https://www.youtube.com/results?search_query=high+protein+meal+prep+for+the+week`
- Meal prep containers and storage search: `https://www.youtube.com/results?search_query=meal+prep+storage+tips`
- Indian budget meal prep search: `https://www.youtube.com/results?search_query=indian+budget+meal+prep`

Implementation requirement:

- Add a typed `videoLinks` array to planner or cooking responses
- Each entry should have:
  - `title`
  - `url`
  - `topic`
  - `marketScope`
  - `whyRecommended`

### Same requirement for endurance coach support links

The endurance views should expose support resources in the same way:

- recovery and mobility routines
- beginner endurance base guidance
- strength support for endurance athletes
- connector setup help for Strava, Health Connect, and Samsung Health

Add typed `supportLinks` to endurance responses with:

- `title`
- `url`
- `topic`
- `whyRecommended`
- `resourceType`

## 8. Connector Runtime And Native Bridges

### Current state

- Connector routes and UI exist
- Strava is the most advanced
- Health Connect and Samsung Health accept local sync payloads but do not yet own real packaged-app bridges

### Still missing

- Desktop callback capture in packaged shell
- Android permission request and callback orchestration
- Native SDK bridges
- Sync retry queue
- Backoff behavior
- Token refresh scheduler
- Device permission revocation handling
- More complete sync payload mapping

### Production requirement

All connector flows must remain device-local:

- auth starts on device
- callbacks are captured on device
- secrets stay on device
- sync jobs run on device
- Atlas does not require a hosted callback relay

## 9. Frontend Production Hardening

### Current state

- Good shell structure and feature route decomposition
- Heavy reliance on fallback data, which is useful for development

### Still missing

- Real loading, empty, stale, and retry states per route
- Error boundaries and route-level recovery
- Accessibility audit
- Responsive QA across desktop and phone form factors
- Production-safe cache strategy
- Calendar UI for weekly nutrition refresh
- Support link surfaces
- Version/build metadata display
- Cleanup strategy for generated artifacts before build

### Required build hygiene

- Add a clean build step that removes stale `.next`
- Run builds in a clean workspace in CI
- Ensure generated directories are never committed
- Add a preflight that fails clearly when generated files or caches are present in release packaging inputs

## 10. Backend Production Hardening

### Still missing

- Structured logging
- Request IDs
- Tracing
- Metrics
- Health endpoints for dependencies
- Startup validation for runtime configuration
- Proper timeout policies
- Retry policies for external providers
- Database migrations
- Versioned API compatibility policy
- OpenAPI review and API docs hardening

## 11. Quality, Testing, And CI/CD

### Current state

- Backend tests are strong relative to repo maturity
- Web build and E2E exist but need stronger production discipline

### Still missing

- CI pipeline
- clean-room install test
- packaged desktop smoke tests
- Android instrumentation test plan
- snapshot/contract tests for frontend shared loaders
- prompt regression tests
- connector replay tests with fixture payloads
- persistence migration tests
- offline mode tests
- upgrade and rollback tests

### Minimum release gates

- install from clean checkout succeeds
- backend tests green
- web production build green
- security checks green or risk-accepted
- packaged desktop app smoke test green
- connector fallback modes verified
- local Ollama health check and model validation green

## 12. Documentation Still Needed Beyond This File

This document should not be the only source of truth. The repo still needs:

- end-user install guide for desktop
- end-user install guide for Android
- first-run Ollama setup guide
- integration troubleshooting guide
- data retention and privacy guide
- recovery and restore guide
- local backup/export guide
- agent prompt/version maintenance guide

## Implementation Sequence To Reach Production

Recommended order:

1. Stabilize data model and shared contracts.
2. Add SQLite plus migrations and secure secret storage abstraction.
3. Add planner refresh metadata, calendar model, meal prep hacks, video links, and endurance support links to shared schemas.
4. Build packaged desktop shell with loopback runtime lifecycle management.
5. Replace manual connector flows with packaged callback and native consent flows.
6. Replace nutrition blueprints with a true weekly plan engine and persisted plan history.
7. Replace endurance heuristic scoring with normalized, explainable scoring.
8. Add CI/CD, signing, observability, crash handling, and release gates.
9. Build Android package and native bridges.

## Agent Handoff Instructions

These instructions are for future coding agents working in this repo.

### Shared shell agent handoff

Own:

- packaging shell
- local runtime lifecycle
- settings contracts
- secret storage abstraction
- AI runtime UX
- connector UX states
- refresh orchestration

Do not break:

- local-first default posture
- loopback-only runtime expectation
- shared schema compatibility with current feature pages

Start with:

- `apps/api/app/features/shared/schemas/app.py`
- `apps/api/app/features/shared/services/state.py`
- `apps/api/app/features/shared/services/ai.py`
- `apps/web/components/ai-runtime-settings-form.tsx`
- `apps/web/components/integration-connect-form.tsx`

First production tasks:

- add persistent store
- add secure storage abstraction
- add plan refresh metadata contracts
- add build hygiene and packaging scaffolding

### Nutrition agent handoff

Own:

- planner engine
- shopping derivation
- substitutions
- meal prep hacks
- video link recommendations
- seven-day refresh logic
- weekly calendar view data

Do not break:

- localization and currency support
- fallback contract compatibility
- low-friction, low-cost execution bias

Start with:

- `apps/api/app/features/nutrition/schemas.py`
- `apps/api/app/features/nutrition/service.py`
- `apps/web/lib/nutrition-data.ts`
- `apps/web/app/(shell)/planner/page.tsx`
- `apps/web/app/(shell)/cooking/page.tsx`
- `apps/web/app/(shell)/shopping/page.tsx`

First production tasks:

- extend schemas with refresh and resource metadata
- add seven-day calendar response model
- add meal prep hacks and YouTube support links
- persist plan generations and allow manual refresh

### Endurance agent handoff

Own:

- data normalization
- readiness and capability scoring
- connector confidence
- support links
- coaching explanation layer

Do not break:

- shared connector contracts
- local-first sync assumptions
- deterministic-first reasoning before model prompts

Start with:

- `apps/api/app/features/endurance/schemas.py`
- `apps/api/app/features/endurance/service.py`
- `apps/api/app/features/shared/services/agent_runtime.py`
- `apps/web/app/(shell)/dashboard/page.tsx`
- `apps/web/app/(shell)/timeline/page.tsx`
- `apps/web/app/(shell)/capability/page.tsx`

First production tasks:

- add support links to endurance responses
- improve multi-source deduplication
- add confidence/freshness metadata
- replace heuristics with explainable scoring rules

## Packaging And Install Runbook Draft

### Development install today

From repo root:

```bash
npm install
python -m venv .venv
.venv\Scripts\activate
pip install -r apps/api/requirements.txt
```

Run web:

```bash
npm run dev:web
```

Run API:

```bash
python -m uvicorn app.main:app --reload --app-dir apps/api
```

Optional local runtime dependencies:

```bash
docker compose -f infra/docker-compose.yml up -d ollama postgres
```

### Packaging target draft

Desktop:

- package the web UI inside a native shell
- run the API as a local sidecar
- store user data in OS app-data directory
- point frontend to local loopback API only
- detect or install Ollama during onboarding

Android:

- package a native shell
- request Health Connect and Samsung Health permissions locally
- keep secrets in Android Keystore
- post device sync payloads to local runtime only

## Definition Of Production Ready For This Repo

Atlas should be considered production-ready only when all of the following are true:

- a non-technical user can install it locally without terminal setup
- Ollama remains local by default and is easy to validate
- endurance and nutrition both persist real user state locally
- nutrition plans refresh every seven days and expose calendar, prep hacks, and resource links
- endurance views expose support links and confidence-aware coaching
- connectors work through native local flows
- secrets are protected with platform-native storage
- builds, tests, audits, and installers pass in CI
- release artifacts are signed and recoverable

