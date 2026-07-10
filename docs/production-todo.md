# Atlas Production TODO (Master TDL + Agent Handoff)

Last updated: July 10, 2026

Prioritized backlog to take Atlas to a production-ready, installable, local-first application.
**This file tracks status and open items — it does not duplicate the full narrative for
completed work.** Detailed "what was built, how it was verified" writeups live in the dedicated
docs linked per section (and in git commit messages); read those for depth, this file for status.

Legend: **[ ]** todo · **[~]** in progress · **[x]** done · **P0** blocking GA · **P1** important ·
**P2** later.

---

## 0. Current status snapshot

- Backend tests: **105 passing** (`npm run test:api`). CI green
  (`.github/workflows/ci.yml`: api / web / security / e2e).
- Repo: `https://github.com/dataoli22/project-atlas` (private, `main`).
- Done and verified live this cycle (not just written — see dedicated docs for how each was
  verified): SQLite persistence, OS-native secret storage, single-user identity + app lock,
  cloud-first AI runtime with local fallback, a real Windows Electron installer (PyInstaller
  sidecar, dynamic ports, OS app-data paths), an Android/mobile companion app scaffold with
  backend pairing infrastructure, and a hardening pass (pairing brute-force protection, in-app
  LAN-pairing toggle, mobile sync retry/backoff).
- CI security scan triage: Bandit findings are false positives (B105 fires on dict keys named
  `access_token`/`refresh_token` whose *value* is `None`). `npm audit`'s PostCSS/XSS finding
  needs a breaking Next.js major-version bump — tracked in section 10, not applied yet.
  `pip-audit`'s pytest advisory was fixed (bumped to `pytest>=9,<10`).

---

## 1. Foundation & hygiene — P0 — DONE (except preflight + clean-room script)

- [x] git/CI/build hygiene: `.gitignore` coverage, clean-before-build step, CI pipeline live.
- [ ] Release preflight rejecting stale generated artifacts.
- [ ] Documented manual clean-room install script (CI provides this per-push, but no standalone
      script exists yet).

> Note: a checkout under OneDrive can transiently `EPERM`-lock `.next` files during sync; retrying
> the build succeeds. See `packaging-and-installation.md` section 3. CI runners are unaffected.

## 2. Data, persistence, secrets — P0 — MOSTLY DONE

- [x] SQLite-backed persistence (`apps/api/app/features/shared/services/db.py`) replacing raw
      JSON, with legacy-JSON one-time import, WAL mode, and corruption recovery.
- [x] OS-native secret storage (`secure_storage.py`): DPAPI (Windows), Keychain (macOS),
      libsecret (Linux), base64 fallback — no new pip dependencies.
- [x] Local backup / export / import (`GET/POST /api/v1/backup/export|import`,
      `SharedStateStore.export_backup`/`import_backup`) — round-trips the full local SQLite
      `app_state` table, secrets stay in their already-OS-protected form (never plaintext in the
      backup file). Found and fixed a real bug while building this: profile, localization, AI
      settings, and the Ollama/Groq API keys were updated in memory and "persisted" but never
      actually written into the persisted payload (`_persist_state_unlocked` silently omitted
      them) — they now round-trip across restarts, with a regression test
      (`test_backup.py::test_profile_localization_ai_settings_and_api_keys_survive_reload`).
- [x] Durable tables: `connector_sync_history` (capped at 50 rows/source) and
      `planner_generation_history` (capped at 20 rows), added via SQLite migration 002 in `db.py`,
      wired into `sync_integration()` and `record_nutrition_refresh()`. Exposed via
      `GET /api/v1/history/sync` and `GET /api/v1/history/planner`.
- [~] Alembic: scaffolded (`apps/api/alembic/`, `alembic.ini`), deliberately **not wired into app
      startup or replacing `db.py`'s existing migrations** — see `alembic/README.atlas.md` for
      the full reasoning. `db.py`'s `PRAGMA user_version` system stays authoritative for
      `app_state`/`connector_sync_history`/`planner_generation_history`; this scaffold is revision
      zero (a verified-working no-op — ran `alembic upgrade head` against a real SQLite file,
      confirmed only `alembic_version` was created and stamped, confirmed idempotent on re-run)
      for whichever future migration first needs a real relational table with foreign keys
      (nutrition recipe library, endurance biometric normalization) that the KV-table approach
      can't express. `env.py` resolves the DB path from the same `ATLAS_LOCAL_DB_PATH` setting
      `db.py` already uses, so there's one source of truth, not two configs that could drift.
- [ ] Separate secret storage from general app state (secrets currently live in the same
      `app_state` table, just protected).

## 3. Authentication & permissions — P1 — DONE

- [x] Single-user, local-only identity model explicitly codified; cloud-style login stub removed.
- [x] Optional app lock (PIN) for shared devices — PBKDF2, verify-only, no recovery by design.
- [x] Permission gate on the one existing destructive action (integration disconnect requires
      explicit confirmation). Apply the same `confirm: true` pattern when "delete history" /
      "rotate secrets" endpoints are eventually built — don't invent them just to gate them.

## 4. AI runtime (Ollama + cloud-first) — P0/P1 — MOSTLY DONE

(Details: `docs/ollama-on-device-and-agents.md`.)

- [x] Cloud-first with automatic on-device Ollama fallback (`local_only_mode` default now
      `false`, still available as an opt-in hard on-device guarantee).
- [x] First-run detection wizard, non-local base-URL warning, model pull button, structured
      provider error classification in chat, tag-normalization bug fix, provider attempt chain.
- [~] Model bootstrap UX: pull button works; live percentage progress/disk usage/cancel need an
      NDJSON streaming proxy — deferred.
- [ ] On-device token/latency telemetry and per-feature budgeting.
- [ ] Embedding pipeline (P2 — only needed when retrieval/memory features arrive).

## 5. Agent orchestration — P1 — NOT STARTED

- [ ] Explicit handoff contract (structured request envelope: goal, feature, approved
      cross-feature context, connector freshness, confidence, response budget).
- [ ] Structured, validated output schema per agent.
- [ ] Response provenance (`deterministic-only` / `+model wording` / `model-only`).
- [ ] Guardrail tests for unsafe medical/nutrition advice.
- [ ] Prompt versioning + changelog; local prompt packs for offline packaged builds.

## 6. Nutrition — P1

(Details: `docs/nutrition-endurance-feature-spec.md` Part A.)

- [x] **6a done**: seven-day calendar, meal prep hacks, curated video links, refresh/provenance
      metadata, `POST /nutrition/planner/refresh` with persisted swap history.
- [x] **6b started — browser-search fallback**: `BraveSearchProvider` (`nutrition/data_sources.py`)
      implements the previously-unwired `NutritionSearchFallbackProvider` interface against the
      real Brave Search API. Entirely opt-in and on-device by design (per explicit product
      decision): the API key is entered in Settings → On-device AI and connector runtime → Nutrition
      search fallback (`SearchSettingsForm`), sent directly from this device to Brave over HTTPS,
      never through an Atlas-hosted relay, same guarantee as the Ollama/Groq keys. With no key
      configured, `get_default_nutrition_data_source_service()` registers zero fallbacks and
      OpenFoodFacts alone still works exactly as before. New `SearchSettings`/`SearchSettingsUpdate`
      schemas, state persistence (same protect/unprotect pattern as the other provider keys),
      `GET/PUT /api/v1/settings/search`. 11 new backend tests + a live build/render check.
- [x] **6b — pantry inventory / "already have this" landed**: `SharedStateStore.get/add/remove_pantry_item`
      (persisted alongside the existing nutrition runtime), `GET/POST /api/v1/nutrition/pantry` +
      `DELETE /api/v1/nutrition/pantry/{name}`. Shopping list generation
      (`get_nutrition_shopping_list`) now flags matching items `already_in_pantry` (substring
      match in either direction — a pantry entry of "onion" matches a shopping item named
      "Yellow onions", since real pantry entries and blueprint ingredient names are rarely worded
      identically) and computes a real "still need to buy" total that excludes matched items,
      alongside `pantry_matched_count`/`pantry_savings`. Matched items stay visible in the list
      (flagged, not hidden) so the user can see what was skipped and why. `PantryManagerForm` on
      the shopping page (add/remove items, live). 9 new backend tests; verified live end-to-end
      (added a real item via curl, confirmed the shopping list correctly flagged and excluded it,
      cleaned up after).
- [ ] **6b remaining**: replace deterministic blueprints with a real optimizer (grounded in the
      already-integrated OpenFoodFacts data, not fabricated recipe content — explicit product
      decision); recipe source system with a real "why did the plan change" explanation.

## 7. Endurance — P1

(Details: `docs/nutrition-endurance-feature-spec.md` Part B.)

- [x] **7a done**: non-medical coach support links (recovery, strength, base training,
      contextual connector setup) on dashboard + capability pages.
- [~] **7b started**: cross-source dedup landed (`_dedupe_cross_source_sessions` in
      `endurance/service.py`) — previously a session synced from both Strava and Health Connect
      (Samsung Health also writes into Health Connect on modern devices, compounding it) was
      counted twice, inflating total volume/distance and the capability score derived from them.
      Sessions are deduped by a 5-minute start-time + duration bucket (exact-timestamp equality
      would miss the same workout logged with slightly different precision by different
      connectors), keeping the first source in priority order (Strava > Health Connect > Samsung
      Health, since Strava's activity data is richer). 4 new unit tests; the existing
      `test_endurance_multi_source.py` 5-sessions/3-sources assertion still passes unchanged,
      confirming genuinely distinct sessions aren't over-collapsed.
      Connector freshness/confidence now landed too: `EnduranceCapabilitySnapshot.confidence`
      (`high`/`medium`/`low`) + `confidence_note`, computed in `_capability_confidence()` from
      each connected source's `last_sync_at` (freshest of the sources actually feeding the score
      wins) — a score built from a week-old sync now visibly says so instead of looking as
      current as one from an hour ago. Injectable `now` parameter, 5 new unit tests covering
      fresh/medium/stale/multi-source/no-data cases. Surfaced in the capability page as a badge.
      Windowing/decay now landed too: `_recency_weight()` weights each session's contribution to
      the capability score by age — full weight within a day, linear decay out to
      `CAPABILITY_WINDOW_DAYS` (14), then a small floor weight (never zero) beyond that — so a
      session from three weeks ago no longer counts identically to one from this morning. Same
      injectable `now` pattern as confidence. Raw displayed duration/distance stay unweighted
      (still literal totals); only the derived score itself is windowed. 6 new unit tests,
      including one proving equal-volume recent vs. old sessions produce different scores.
      Biometric normalization now landed too: `_normalized_recovery_score()` replaces the ad hoc
      `45 + hydration/200 + sleep*2` arithmetic with real normalization against general wellness
      targets (~35ml/kg/day hydration, personalized to the user's own recorded body weight when
      available via `_hydration_target_ml()`, else a 2500ml adult default; 7-9h sleep as a
      full-credit band, degrading outside it) — explicitly general wellness heuristics, not
      medical guidance, same non-medical framing as the rest of the endurance coach. 13 new unit
      tests. **Still open**: calendarized training plan (not started), escalation flow for
      medical red flags (not started — this one especially needs product/legal input on wording
      before writing code, not just engineering).

## 8. Connectors & mobile — P1 — SCAFFOLDED + HARDENED

(Details: `docs/mobile-architecture.md` — covers why mobile is architecturally different from
desktop, and the hard iOS blocker.)

> Companion mode: the phone has no backend of its own (FastAPI can't run on iOS; an Android-only
> embedding wouldn't reach iOS). It collects Health Connect/HealthKit data and syncs it to a
> paired desktop over the local network. Mobile UI is a small dedicated Vite+React app
> (`mobile/`), not a reuse of `apps/web`.

- [x] Backend pairing (`pairing.py`): code generation + LAN detection, device-token issuance
      (PBKDF2-hashed), paired-device list/revoke. Device-token auth on the two device-sync
      endpoints, backward-compatible with existing no-auth loopback callers.
- [x] **Hardened**: pairing code brute-force protection (`MAX_PAIRING_ATTEMPTS = 5`, code
      invalidated outright, constant-time comparison).
- [x] **Hardened**: real in-app LAN-pairing toggle (Settings → Phone pairing) replacing the
      env-var-only version, with a "Restart Atlas to apply" prompt.
- [x] Desktop pairing UI; `mobile/` Capacitor scaffold (Vite+React+TypeScript), Android platform
      added via `npx cap add android`, pair + sync screens, builds clean.
- [x] **Hardened**: mobile sync retry with backoff on network/5xx failures, not on 4xx.
- [x] Native Health Connect SDK plugin (`HealthConnectPlugin.kt`) written and registered in
      `MainActivity.java`. **Now Android Studio is set up locally, `./gradlew assembleDebug`
      succeeds** — a real debug APK builds and the plugin compiles/links cleanly. Fixed along the
      way: pinned `connect-client` to `1.1.0-alpha07` (newer alphas need `compileSdk 35`, which
      this project doesn't target yet), added explicit `jvmTarget = "17"` (Kotlin/Java compiler
      mismatch), added `override` to `requestPermissions` (collided with Capacitor's base
      `Plugin` method of the same name). `minSdkVersion` bumped to 26 (required by the SDK).
- [ ] **APK not yet installed/run on a device or emulator** — permission grant/deny/partial-grant
      flows and a real end-to-end sync against a paired desktop still need real hardware. See
      `mobile-architecture.md` section 3.
- [~] Samsung Health SDK bridge for mobile: documented interface (`mobile/src/samsung-health-plugin.ts`)
      and `syncSamsungHealthData()` (`desktop-api.ts`) wired into the sync screen alongside
      Health Connect, mirroring the same pattern. **Native implementation is blocked differently
      than Health Connect/HealthKit were** — Health Connect and HealthKit only needed device/SDK
      access (now unblocked for Health Connect); the Samsung Health SDK additionally requires
      enrolling in and being approved for the Samsung Health Partner Program before it will even
      authenticate, which is a business/legal step, not engineering. On modern Samsung devices
      much of this data (steps, sleep, heart rate, workouts) already flows into Health Connect,
      which the Health Connect plugin already covers — the fields unique to Samsung Health
      (`stressLevel`/`energyScore`) are the main reason to still pursue partner approval later.
- [x] iOS: Capacitor scaffold committed (`mobile/ios/`, via `npx cap add ios`); ships as a
      self-compiled build (free Apple ID / Personal Team, 7-day resign) rather than through the
      App Store — see `mobile-architecture.md` section 4 for the full build/sideload flow.
- [ ] iOS: `HealthKitPlugin.swift` implementation (`mobile/src/healthkit-plugin.ts` documents the
      interface; needs a Mac + Xcode + physical iPhone to write and test — HealthKit mostly
      doesn't work in the Simulator).
- [x] Permission revocation: disconnecting Strava now calls Strava's real
      `/oauth/deauthorize` endpoint (`StravaOAuthClient.deauthorize`) with the stored access
      token before clearing local state — previously "disconnect" only cleared Atlas's local
      runtime, leaving the token valid on Strava's servers until it naturally expired. If the
      revocation call fails (network, Strava outage), local disconnect still succeeds and the
      response notice says so explicitly, rather than blocking the user from disconnecting
      locally. Health Connect/Samsung Health have no equivalent server-side revocation to call —
      those permissions are OS-level and can only be revoked from the device's own settings;
      Atlas already clears its local `permission_granted`/`sdk_consent_granted` flags on
      disconnect, which is the most it can do from the backend.
- [x] Token refresh scheduler: `core/scheduler.py` runs a periodic background maintenance loop
      (started in `main.py`'s FastAPI lifespan, 15-minute interval) that proactively refreshes
      the Strava token when it's within 15 minutes of expiry, instead of only refreshing
      reactively the next time a user happens to trigger a sync. A failed tick is logged and
      retried on the next interval — no separate durable retry queue needed for a single-user
      local app; "try again next tick" is the retry policy. Disabled under pytest (same
      `PYTEST_CURRENT_TEST` gate the persistence layer uses) so it never leaks a background task
      across test runs. Verified against a live uvicorn instance (clean startup/shutdown), not
      just unit tests.
- [ ] Richer sync payload mapping for all three connectors.
- [ ] App icon/branding; Play Store listing and release process (Android only — iOS is
      self-compiled, no App Store distribution planned).
- [x] Rate limiting on `/api/v1/pairing/start`: a sliding-window cap (20 calls/60s, not a
      per-call cooldown, so legitimate back-to-back re-starts from a human aren't blocked) — 429
      once exceeded. See `PairingRateLimitedError` in `state.py`.

## 9. Packaging & installers — P0/P1 — WINDOWS INSTALLER WORKING

(Details: `docs/packaging-and-installation.md`.)

> Shell: Electron (not the originally-recommended Tauri v2 — `electron-updater` + GitHub Releases
> chosen for auto-update maturity).

- [x] `desktop/` Electron project — real installer (`Atlas Setup 0.1.0.exe`, ~128MB) built and
      verified running from its packaged output, not just dev mode.
- [x] Sidecar lifecycle manager with **dynamically allocated** ports (API URL injected into the
      renderer via `preload.js`, so no fixed-port build is needed).
- [x] FastAPI **PyInstaller sidecar binary** (`apps/api/sidecar_entry.py` +
      `desktop/scripts/build-api-sidecar.mjs`) — verified standalone and inside the packaged app.
- [x] OS app-data user-data path (`app.getPath("userData")` → `ATLAS_LOCAL_DB_PATH`/
      `ATLAS_LOCAL_STATE_PATH`), including an `app.setName("Atlas")` fix for a clean folder name.
- [x] `electron-updater` wired (GitHub Releases) — not yet exercised against a real release.
- [x] macOS/Linux **zip** targets configured (no native installers for those platforms, per
      product decision) — config-only, never built on those OSes.
- [ ] Signed installers — **blocked on a real code-signing certificate** (business decision, not
      engineering; `CSC_LINK`/`CSC_KEY_PASSWORD` env vars are all `electron-builder` needs once a
      cert exists).
- [ ] App icon / branding assets (default Electron icon in use).
- [~] Packaged smoke test — done manually twice; not yet automated into CI.

## 10. Frontend hardening — P1 — PARTIAL

- [x] Error boundaries + route-level recovery: `app/error.tsx` (catches errors anywhere below
      root layout, including `(shell)/layout.tsx`'s own fetch) and `app/not-found.tsx`, both with
      a friendly panel and a "Try again"/"Back to dashboard" action, replacing Next's default
      unstyled error/404 pages.
- [x] Loading state: `(shell)/loading.tsx` — a shimmer skeleton shown automatically by Next's
      Suspense boundary while any page under the shell (including the shell layout's own
      `getAppLockSettingsData()` fetch) is resolving.
- [x] Stale-data indicator (the "silent staleness" gap this surfaced): `lib/api.ts`'s
      `requestJson` already returned `{data, source: "api" | "stub"}`, but every `lib/*-data.ts`
      helper discarded `source` via the `fetchJson` wrapper — a failed backend call silently
      rendered hardcoded stub data with zero indication anything was wrong. Added `*WithSource`
      variants of every primary data-fetch function (`getEnduranceDashboardDataWithSource`,
      `getEnduranceTimelineDataWithSource`, `getEnduranceInsightsDataWithSource`,
      `getNutritionPlannerDataWithSource`, `getNutritionShoppingListDataWithSource`,
      `getNutritionSubstitutionsDataWithSource`, `getNutritionCookingPlanDataWithSource`) plus a
      `combineDataSources()` helper (`lib/data-source.ts` — pessimistic: any "stub" among several
      combined fetches wins) and `<DataSourceBanner>`, now wired into **all six** pages that pull
      live endurance/nutrition data: dashboard, capability, timeline, nutrition, cooking,
      planner, shopping. Settings/onboarding already had their own equivalent
      (`DataSourceBadge` in `settings-data.ts`, pre-existing, per-field granularity) and were left
      as-is rather than converted to a second competing pattern. `log`/`ask` have no backend
      fetch to be stale. Verified live for all six pages: banner renders with the backend
      stopped, disappears once it's reachable, for each route individually (not just dashboard).
- [x] Empty states (distinct from stale/error — "you genuinely have no data yet" vs "couldn't
      reach the backend"): new `<EmptyState>` component (`components/empty-state.tsx`), wired
      into the three spots that are actually reachable as empty today — dashboard's and
      timeline's "no synced sessions" case (`timeline.entries.length === 0`, not currently
      reachable against the stub backend's non-empty defaults, but real once a user has zero
      connected sources) and planner's swap history (`swapHistory.length === 0`, **genuinely
      reachable and verified live** — a fresh install always starts with empty swap history
      until the first refresh; previously this section silently vanished with no explanation).
      Other lists (shopping items, substitutions, insights) aren't empty-reachable against
      current stub/live defaults, so left alone rather than adding untestable speculative UI.
- [ ] Accessibility audit; responsive QA (desktop + phone).
- [ ] Production-safe cache strategy; version/build metadata display.
- [ ] Upgrade Next.js past the `postcss` XSS advisory (GHSA-qx2v-qp2m-jg93) — `npm audit fix
      --force` proposes a breaking major bump; needs its own scoped upgrade + full regression pass.

## 11. Backend hardening — P1 — PARTIAL

- [x] Structured logging + request IDs (`core/logging.py`, `core/middleware.py`): one JSON log
      line per request (method, path, status, duration), a request ID generated or reused from
      an `X-Request-Id` header, echoed back in the response, and attached to every log line
      emitted while handling that request via a contextvar. Verified live against a running
      uvicorn instance, not just unit tests. Tracing/metrics (OpenTelemetry or similar) still
      not started — logging alone gets most of the day-to-day debugging value for a local-first
      single-user app; revisit tracing if/when multi-service correlation is actually needed.
- [ ] Dependency health endpoints; startup config validation.
- [x] Timeout + retry policies for external providers: Groq and Strava's cloud HTTP calls
      (`provider_clients.py`) now retry transient failures (connection errors, timeouts, 5xx) up
      to 3 attempts with backoff, never retrying 4xx. On-device Ollama deliberately excluded — a
      slow local model isn't a transient failure, and doubling an already-long wait would make a
      slow device feel broken rather than resilient (see the comment in `provider_clients.py`).
- [x] Versioned API compatibility policy: documented in `api/router.py`'s module docstring —
      `/api/v1` stays additive/backward-compatible while clients are pinned to it; breaking
      changes get `/api/v2`, mirroring the existing `packages/shared` additive-only rule.
- [x] OpenAPI review: audited all ~40 endpoints for tags/response models (already consistent —
      no gaps found), then added a custom `openapi()` override (`main.py`) that documents a
      shared `ErrorDetail` (`{"detail": "<message>"}`) as the default error response on every
      operation — previously the schema only ever documented the 200 case, even though every
      route consistently raises `HTTPException(status_code=..., detail=...)`.

## 12. Quality, testing, CI/CD — P0/P1 — PARTIAL

- [x] CI pipeline live (api / web / security / e2e).
- [ ] Frontend shared-loader contract/snapshot tests.
- [ ] Prompt regression tests; connector replay tests with fixtures.
- [ ] Persistence migration tests; offline-mode tests; upgrade/rollback tests.
- [ ] Full release gates: clean-checkout install, packaged desktop smoke in CI, connector
      fallback modes, Ollama health + model check.

## 13. Documentation still needed — P1

- [ ] End-user desktop install guide; Android install guide.
- [ ] First-run Ollama setup guide (user-facing).
- [ ] Integration troubleshooting guide; data retention & privacy guide.
- [ ] Recovery/restore guide; backup/export guide; agent prompt/version maintenance guide.

---

## Agent handoff instructions

Ownership boundaries for coding agents. **Do not break** the local-first default, loopback-only
runtime default, deterministic-first reasoning, or existing shared-schema compatibility.

### Shared shell agent
Owns packaging shell, local runtime lifecycle, settings contracts, secret storage, AI runtime UX,
connector UX states, refresh orchestration, persistence, CI/build hygiene, mobile pairing backend.
Start files: `apps/api/app/features/shared/schemas/app.py`, `.../services/state.py`,
`.../services/ai.py`, `.../services/pairing.py`, `apps/web/components/ai-runtime-settings-form.tsx`,
`apps/web/components/pairing-settings-form.tsx`, `desktop/electron/main.js`.
First tasks: sections 2 (backup/export/import, Alembic), 5, 9 (signing/branding), 8 (native SDK
plugins once device access exists).

### Nutrition agent
Owns planner engine, shopping derivation, substitutions, meal prep hacks, video links, seven-day
refresh logic, weekly calendar data. Do not break localization/currency, fallback compatibility,
or the low-cost/low-friction bias. Do **not** edit `packages/shared/src/index.ts` (integrator-owned)
or `agent_runtime.py`.
Start files: `apps/api/app/features/nutrition/{schemas,service,router}.py`,
`apps/web/lib/nutrition-data.ts`, `apps/web/app/(shell)/{planner,cooking,shopping}/page.tsx`.
First tasks: section 6b.

### Endurance agent
Owns data normalization, readiness/capability scoring, connector confidence, support links,
coaching explanation layer. Do not break shared connector contracts, local-first sync assumptions,
or deterministic-first reasoning. Do **not** edit `packages/shared/src/index.ts` or
`agent_runtime.py`.
Start files: `apps/api/app/features/endurance/{schemas,service}.py`,
`apps/web/lib/endurance-data.ts`, `apps/web/app/(shell)/{dashboard,timeline,capability}/page.tsx`.
First tasks: section 7b.

### Coordination rule
`packages/shared/src/index.ts` and `apps/api/app/features/shared/services/agent_runtime.py` are
**shared/integrator-owned** files. Feature agents rely on their contracts but do not edit them
concurrently, to avoid merge conflicts. All new response fields must be additive and match
snake_case (Python) ↔ camelCase (TS) exactly.
