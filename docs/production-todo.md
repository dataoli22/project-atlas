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

- Backend tests: **240 passing** (`npm run test:api`). E2E: **21 passing**
  (`npm run test:e2e`, including a new axe-core accessibility + responsive smoke suite). CI green
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

**Architecture, in one paragraph:** Atlas is a local-first monorepo — `apps/web` (Next.js),
`apps/api` (FastAPI), `packages/*` (shared contracts) — with local-first AI (Ollama default,
optional cloud), replaceable integration contracts (Strava, Health Connect, Samsung Health), and
a real backend test suite.

**Definition of "production ready" for this repo** (this bar, not a generic checklist):

- a non-technical user can install it locally without terminal setup
- Ollama remains available on-device and is easy to validate; cloud providers are opt-in and
  clearly labeled
- endurance and nutrition both persist real user state locally
- nutrition plans refresh every seven days and expose calendar, prep hacks, and resource links
- endurance views expose support links and confidence-aware coaching
- connectors work through native local flows
- secrets are protected with platform-native storage
- builds, tests, audits, and installers pass in CI
- release artifacts are signed and recoverable

(This folds in what used to be the standalone `docs/prod-readiness-audit.md` — that file's
original 761-line long-form audit is superseded by this tracker and the dedicated docs below;
full original text remains in git history at `git log -- docs/prod-readiness-audit.md`.)

---

## 1. Foundation & hygiene — P0 — DONE (except preflight + clean-room script)

- [x] git/CI/build hygiene: `.gitignore` coverage, clean-before-build step, CI pipeline live.
- [x] **CORS middleware** (`apps/api/app/main.py`) — a real, previously-undiscovered bug: no
      CORS middleware existed at all, so every client-side ("use client") form submission
      calling `fetch` directly from the browser was a genuinely cross-origin request (the web UI
      and API run on different ports, even in the packaged app - see `desktop/electron/main.js`).
      The browser silently blocked every such call, and `requestJson`'s fallback-on-error
      handling (`apps/web/lib/api.ts`) swallowed it - the UI showed "saved" from local stub state
      while nothing ever reached the backend. Only caught because live-testing the onboarding
      flow this session actually clicked through a real browser session instead of verifying via
      `curl` (which bypasses browser CORS entirely - the standing convention for prior live
      verification in this project, which is exactly why this went unnoticed). Fixed with
      `allow_origin_regex` matching only `127.0.0.1`/`localhost` at any port - deliberately not a
      wildcard, so a LAN device's browser still can't script-read the API when LAN pairing
      (`ATLAS_API_HOST=0.0.0.0`) is enabled; the CORS check is based on the requesting page's
      origin, not network reachability. 4 new tests (`test_cors.py`).
- [x] **Real-browser verification pass, post-CORS-fix**: re-tested a representative cross-section
      of every mutating pattern in the app by actually clicking through a live browser session
      (not curl) against a real backend - AI runtime settings save (changed the Ollama model
      field to a marker value, confirmed it round-tripped via `GET /settings/ai`), search
      settings save, feature preferences save, pantry item add (`GET /nutrition/pantry` reflected
      the added item), and app-lock enable (`GET /app/lock` reflected `enabled: true`). Zero CORS
      errors, all changes persisted correctly. High confidence the CORS gap is genuinely closed
      across the app, not just for the onboarding flow that surfaced it.
- [ ] Release preflight rejecting stale generated artifacts.
- [ ] Documented manual clean-room install script (CI provides this per-push, but no standalone
      script exists yet).

> Note: a checkout under OneDrive can transiently `EPERM`-lock `.next` files during sync; retrying
> the build succeeds. See `docs/build-and-run/packaging-and-installation.md` section 3. CI runners are unaffected.

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
- [x] **First-run onboarding gate, live data from day one, health providers explicitly
      skippable.** New `AppPreferences.has_completed_onboarding` (deliberately NOT on
      `AppPreferencesUpdate` - set exactly once via a dedicated
      `POST /api/v1/app/onboarding/complete`, so a routine preference change can never
      accidentally reset it). `<OnboardingGate>` (`components/onboarding-gate.tsx`) wraps the
      shell layout and redirects to `/settings/setup` until the flag is set, exempting
      `/settings` so a user can detour into Settings → Integrations mid-flow without the gate
      bouncing them back to step one. The wizard (`components/onboarding-wizard.tsx`: Welcome →
      Profile & plan → Connect providers → Finish) now lives at `/settings/setup` (moved there
      during the section-10 IA collapse below, was a standalone `/onboarding` route originally)
      - the "Connect providers" step lists Strava/Health Connect/Samsung Health with a link into
      Settings and a prominent "Skip for now", matching the product decision that providers stay
      entirely optional. Nutrition is genuinely live from day one without any connector: the
      profile/market captured in step 2 feeds the same deterministic blueprint generation
      already used everywhere (`nutrition/service.py`), verified live end-to-end
      (`GET /nutrition/planner` reflects the onboarding-entered market/cuisine immediately).
      Endurance still needs a connector for real data (shows illustrative stub content
      otherwise) - inherent to having no wearable/manual entry, not something onboarding alone
      can fix, and out of scope for this pass. The finish step uses a hard
      `window.location.assign` navigation, not `router.push`: the shell layout's
      `OnboardingGate` reads its flag from a server-fetched prop, and Next.js layouts persist
      across client-side navigation, so a plain push (even preceded by `router.refresh()`, which
      races the navigation) could land back on the gate with the stale value still rendered -
      found by testing the actual click-through, not just the API call succeeding.
      3 new tests (`test_onboarding.py`).
- [x] **Required AI setup step, providers stay skippable.** New "AI setup" wizard step between
      Profile and Connect providers - `hasWorkingAiPath()` requires at least one real, verified
      path before `Continue` unlocks: on-device Ollama confirmed reachable via a live health
      check (no key needed - Atlas's zero-config default), OR a Groq API key saved, OR a
      cloud-Ollama key saved. Deliberately not a literal "enter an API key" requirement -
      forcing a needless cloud key on someone who already has local Ollama running would
      contradict the app's local-first default. Health providers (Strava/Health Connect/Samsung
      Health) remain explicitly skippable, unchanged. Also confirmed
      `has_completed_onboarding` genuinely gates on first install only, not every update: it's
      stored in the user's local SQLite state (`AppData\Atlas\atlas.db`), which an app update
      never touches - only a fresh install with no existing state file sees the wizard. Verified
      live end-to-end: fresh backend, walked the real UI through Welcome → Profile → AI setup,
      confirmed `Continue` stays disabled with no AI path configured, saved a Groq key through
      the actual form, confirmed `Continue` unlocks and `GET /settings/ai` reflects
      `groq_api_key_set: true` immediately.

## 4. AI runtime (Ollama + cloud-first) — P0/P1 — MOSTLY DONE

(Details: `docs/build-and-run/ollama-on-device-and-agents.md`.)

- [x] **Cloud-first with automatic on-device Ollama fallback - now actually true, not just
      documented.** `local_only_mode` default `false` (opt-in hard on-device guarantee still
      available), but the literal `default_provider` field was hardcoded to `"ollama"` with
      `allow_groq=False` in `registry.py`'s `get_default_ai_settings()` - meaning even after a
      user saved a Groq key, chat's provider attempt chain (`chat.py`) never actually tried it,
      since it branches on `default_provider` not on whether a key exists. Found via a real user
      report ("not everyone will have Ollama local, cloud should be the default") after shipping
      the onboarding wizard's AI setup step - saving a key there unblocked `Continue` but silently
      never got used for chat. The test asserting the old defaults was even named
      `test_read_ai_settings_exposes_cloud_first_with_local_fallback_defaults` while asserting
      `default_provider == "ollama"` - the test's own name contradicted its assertions, a strong
      signal this was drift from intent, not a deliberate choice. Fixed: fresh-install default is
      now `default_provider="groq"` + `allow_groq=True` (schema field defaults updated to match).
      Safe with no key present - `chat.py` only attempts Groq when `allow_groq and groq_api_key`
      are both truthy, so with no key this still resolves to trying on-device Ollama, identical
      to before. The onboarding wizard's "Save Groq key" action now also explicitly sets
      `defaultProvider: "groq"` in its payload so a saved key takes effect immediately regardless
      of prior state. Verified live against a fresh backend: `GET /settings/ai` reports
      `default_provider: "groq"`, `allow_groq: true`.
- [x] First-run detection wizard, non-local base-URL warning, model pull button, structured
      provider error classification in chat, tag-normalization bug fix, provider attempt chain.
- [~] Model bootstrap UX: pull button works; live percentage progress/disk usage/cancel need an
      NDJSON streaming proxy — deferred.
- [ ] On-device token/latency telemetry and per-feature budgeting.
- [ ] Embedding pipeline (P2 — only needed when retrieval/memory features arrive).

## 5. Agent orchestration — P1 — DONE

- [x] **Explicit handoff contract**: `AgentExecutionPlan` (`agent_runtime.py`) now carries
      `confidence`/`confidence_reason`/`connector_freshness` alongside the existing feature,
      grounding, and token budget - computed from real connector sync state (Strava activity
      count, pantry item count, Health Connect/Samsung Health session counts), not assumed. Both
      are also injected into the system prompt sent to the model and returned on `ChatResponse`.
- [x] **Structured, validated output schema per agent** (bounded to what's safe given local
      models vary in JSON-mode support): rather than forcing brittle structured generation, added
      a deterministic post-generation validator (`guardrails.py`) that runs on every answer -
      model or stub - and reports pass/fail plus specific findings as real schema fields
      (`guardrail_passed`, `guardrail_findings`) on `ChatResponse`.
- [x] **Response provenance**: `response_provenance` on `ChatResponse` is
      `deterministic-only` (stub path), `model-with-grounding`, or `model-only`, computed from
      whether the plan had real grounding data.
- [x] **Guardrail tests for unsafe medical/nutrition advice**: `guardrails.py` catches
      diagnosis-like language, medication/dosing language, and "don't see a doctor" language via
      deterministic regex checks (not model-dependent), covering every provider path including
      the stub fallback. Findings are advisory only - never block a response, matching the
      established medical-escalation product decision. 8 new tests
      (`test_guardrail_checks.py`) plus wiring tests in `test_chat_response_metadata.py`
      confirming an unsafe answer is flagged but still returned.
- [x] **Prompt versioning + changelog; local prompt packs for offline packaged builds**:
      `PROMPT_VERSION` constant in `ai.py`, stamped on every `AgentPromptProfile` and returned on
      `ChatResponse` as `prompt_version`; `docs/build-and-run/prompt-changelog.md` records what changed at each
      version. Prompts are authored directly in `ai.py` and shipped inside the packaged sidecar
      exe (no runtime prompt fetch exists), so packaged builds were already fully offline - this
      just makes that fact explicit and auditable. 7 new tests
      (`test_agent_handoff_contract.py`) plus a prompt-version assertion added to
      `test_ai_settings.py`. Web chat UI (`ask-atlas-form.tsx`) now surfaces provenance,
      confidence, connector freshness, prompt version, and guardrail findings.

## 6. Nutrition — P1

(Details: `docs/feature-specs/nutrition-endurance-feature-spec.md` Part A.)

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
- [x] **6b — bounded real-data substitution grounding landed** (explicit product decision: a
      bounded version now, not a full meal-planning solver — that's multi-session scope).
      `_real_nutrient_comparison()` (nutrition/service.py) looks up both sides of each blueprint
      substitution via the already-integrated `OpenFoodFactsDataSource` and reports real
      calories/protein per 100g, e.g. "Chicken breast: 165kcal / 31g protein per 100g -> Dal:
      116kcal / 9g protein per 100g" — grounding the "why" in real data instead of only static
      blueprint prose. Falls back to the text before "or"/"/"/"," when the substitute field is a
      human-written compound phrase like "Eggs or dal" (not a real product name, so it
      structurally matches nothing verbatim) - verified directly that this fallback works
      ("Eggs or dal" -> resolves via "Eggs"). Returns `None` (not a fabricated placeholder) when
      either side can't be found. Process-lifetime cache that deliberately only caches
      successes, not `None` - a naive `@lru_cache` would permanently hide a comparison behind a
      transient network blip for the rest of the process's life; found and fixed this while
      testing live against the real (occasionally 503-flaky) OpenFoodFacts API. Also fixed two
      pre-existing bugs surfaced along the way: `update_profile()` and the AI-settings restore
      path used `model_copy(update=payload.model_dump())`, which does not re-validate nested
      models - `body_weight`/`hydration`/`prompt_profiles` were silently stored as raw dicts
      instead of typed models, latent until this session's endurance normalization code became
      the first caller to access `.body_weight.value` as an attribute. Both now use
      `model_validate()`. 15 new tests (8 for the comparison/cache logic including the
      transient-failure-is-not-cached case, 2 regression tests for the model-validation bugs).
      Recipe source system with a real "why did the plan change" explanation, and the full
      optimizer/recipe-library replacement, remain open — explicitly deferred, not silently
      dropped.
- [x] **6c — cuisine + cook-time filters, nutrition promoted to the primary module**: nutrition
      is now the higher-usage module day to day, so it leads the feature switcher, nav groups,
      mobile nav, and default landing feature on both frontend (`lib/navigation.ts`,
      `lib/shell-preferences.ts`) and backend (`default_active_feature`, `build_feature_registry`
      in `core/config.py`). Added a real **cuisine** dimension to the weekly plan
      (`MarketNutritionBlueprint.cuisine`, exposed as `NutritionPlannerResponse.cuisine`):
      Indian/Chinese/Continental were tagged from the existing real dish content per market
      (IN/CN/US·UK·EU); **Japan was added as a full 6th market** (JPY currency, `ja` language,
      market registry entry) with a genuinely authored 7-day Japanese weekly plan in the same
      depth/format as the other five (meals, shopping list, substitutions, cooking steps) rather
      than placeholder dishes. `<CuisineSwitcher>` on the planner page lets a user switch cuisine
      directly (maps to the representative market and calls the existing localization update
      endpoint). Added a **cook-time filter** (`lib/cook-time.ts`, `<CalendarTimeFilter>`) over
      the seven-day calendar using the cook-time-minutes data that already existed per day - no
      backend change needed, purely a client-side filter over real data. 11 new backend tests
      (cuisine-per-market, full JP weekly plan contract). Considered and rejected integrating
      NotebookLM as a nutrition data source - it has no public API and isn't a nutrition
      database, so there was nothing to actually integrate.

- [x] **6d — persisted, editable meal plan + Open-Food-Facts-grounded ingredient RAG (step 1 of
      3 toward chat-driven meal editing)**: meals were previously computed live from a static
      per-market blueprint (`_market_blueprints()`) with no per-user edit path and no ingredient
      data at all - swapping a meal, or having it auto-sync to shopping/cooking, was structurally
      impossible. New `meal_plan_entries`/`meal_plan_swap_history` tables
      (`shared/services/db.py`'s migration 003, following the existing `LocalStateDatabase`
      raw-SQL versioned-migration pattern rather than wiring in the separately-scaffolded-but-inert
      Alembic setup - lower risk, same mechanism already proven in production for
      `connector_sync_history`). `nutrition/service.py`'s `_resolve_blueprint()` now seeds these
      rows from the static blueprint on first read per market, then reads live entries back
      afterward - a swap is immediately reflected in calendar days, meal-prep hacks, and the
      planner response. New `POST /nutrition/planner/swap-meal` endpoint + `swap_meal()`.
      Each swap regenerates its ingredient breakdown via `nutrition/ingredient_rag.py`: the AI
      proposes plausible ingredient names for the dish, then **each name is grounded against a
      real Open Food Facts product** via the existing `NutritionDataSourceService`
      (retrieve-then-generate, not trusting the AI's raw output as fact) - this is the RAG
      pipeline requested, reusing the existing product-search infrastructure rather than standing
      up a new vector store. Degrades honestly: if every AI provider is unavailable, stores a
      single ungrounded entry with `confidence=0.0` rather than fabricating an ingredient list.
      Seeding stores empty ingredients (generating breakdowns for all ~126 blueprint meal-slots
      upfront would mean 126+ AI calls on first read) - only swapped meals get a real breakdown.
      **Not yet done** (tracked here, not silently skipped): shopping-list/cooking-plan generation
      still derive from the old hand-authored per-market `shopping_items`/`cooking_steps`, not
      from `meal_plan_entries.ingredients` - the actual "auto-sync to cooking and pantry" the user
      asked for needs that derivation rewritten next. After that: tool-calling support (neither
      Groq nor Ollama client code supports function/tool calls today) so Ask Atlas chat can
      actually invoke a swap, not just discuss the plan.
      **Testing gap found, not fixed**: `SharedStateStore`'s `_persistence_disabled()` checks
      `PYTEST_CURRENT_TEST`, but the module-level `shared_state` singleton is constructed at
      import time (test collection), before that env var is set for any specific test - so
      `self._db` ends up as a real `LocalStateDatabase` for the whole pytest session, meaning
      DB-backed state genuinely persists across separate `pytest` invocations on a dev machine
      (confirmed: a local `apps/api/.local/atlas.db` accumulates real rows run to run). Not a new
      bug (pre-existing for `connector_sync_history`/pantry/swap-history too), but this feature
      is the first with tests sensitive enough to surface it. Worth a real fix later (e.g. an
      explicit test-mode DB path override wired before the singleton is constructed).

## 7. Endurance — P1

(Details: `docs/feature-specs/nutrition-endurance-feature-spec.md` Part B.)

- [x] **7a2 — real health-data history + query layer (RAG pipeline #2, matching 6d's pattern)**:
      found and fixed a real, previously-undiscovered data-loss bug while scoping this: every
      `store_strava_sync`/`store_health_connect_sync`/`store_samsung_health_sync` call
      **overwrote** the in-memory `recent_sessions` list and metric scalars wholesale
      (`state.py`) - a new sync silently discarded everything from prior syncs, so no real
      history ever accumulated regardless of how many times a user synced over time. New
      `health_sessions`/`health_metric_readings` tables (`db.py` migration 004, unbounded
      retention per user decision) now accumulate every synced session/metric reading instead,
      normalizing Strava's raw activity field names to the same `session_label`/`session_type`
      shape Health Connect/Samsung Health already use. New `endurance/health_query.py`: real
      structured retrieval (date-range + metric/session keyword matching against the persisted
      tables - not embeddings; these are small, well-structured numeric/dated records where exact
      filtering beats semantic search) - the RAG pattern applied to health data, same shape as
      6d's ingredient grounding but for sessions/metrics. Wired into two places: `GET
      /endurance/query?question=...` (a real query layer over the dashboard, independent of chat)
      and `agent_runtime.py`'s Ask Atlas grounding for the endurance feature (question-aware -
      "what was my resting heart rate last week" now injects actual retrieved readings, not just
      the fixed scalar summaries that were there before). 4 new tests.
      **Not yet done**: `_combined_recent_sessions()` (the function backing the dashboard/timeline
      pages) still reads only the current in-memory snapshot, not the new persisted history table
      - the dashboard pages themselves don't yet show full accumulated history, only the query
      endpoint and chat grounding do. Nutrition's Ask Atlas grounding (6d) hasn't received the
      equivalent per-record retrieval upgrade either - it still injects only fixed scalar
      summaries, not specific meal/ingredient records matched to the question.
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
      tests. Medical red-flag detection: plumbing built, **deliberately not wired into any
      endpoint or UI yet** — `endurance/medical_escalation.py`'s module docstring is explicit
      that this needs human sign-off on the actual copy before it ships. `detect_medical_red_flags()`
      is pure/stateless (no side effects), flags two conservative conditions from data Atlas
      already syncs: resting HR ≥100bpm, sleep ≤3h — deliberately *not* a low-resting-HR flag,
      since well-trained endurance athletes (this app's actual audience) routinely run well below
      general-population "normal" and that would constantly false-positive. Copy lives in
      `ESCALATION_COPY` in the same file, written to never name a condition or suggest a
      diagnosis, always cite the specific triggering number, always frame the action as "mention
      to a doctor." **Reviewed and approved, now wired in**: `EnduranceInsightsResponse.medical_flags`
      (`_build_medical_flags` in `endurance/service.py`), rendered as a banner on the dashboard
      and capability pages. 9 detection unit tests + 2 end-to-end wiring tests (verified live via
      curl: pushed a real 115bpm/2h-sleep sync, confirmed both flags appeared with the approved
      copy in the API response and rendered on the live capability page).
      Calendarized training plan: explicitly deferred to its own session (not started) — it's a
      genuine new subsystem (multi-week periodization logic), not a quick add, and rushing a
      shallow version into an already-large session wasn't the right call.

## 8. Connectors & mobile — P1 — SCAFFOLDED + HARDENED

(Details: `docs/feature-specs/mobile-architecture.md` — covers why mobile is architecturally different from
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
- [x] `App.tsx`'s sync screen now sends real collected data, not an empty test payload — the
      "Sync Health Connect" button requests permissions then reads sessions/hydration/weight/steps
      from the trailing 24h window before posting to the desktop.
- [x] **Verified live on a real Android emulator** (API 34, google_apis x86_64 image via
      `avdmanager`/`sdkmanager`) — installed the actual debug APK, paired with a locally-running
      `atlas-api.exe` sidecar over the emulator's `10.0.2.2` host alias, and drove the real
      `requestPermissions()` flow, which launched the genuine Health Connect OS consent screen and
      correctly handled the not-granted result. Found and fixed two real, previously-undiscovered
      bugs this surfaced (neither is Samsung-specific — both blocked LAN pairing entirely on any
      modern Android device, not just the emulator):
      1. **No `network_security_config.xml` existed at all**, so Android 9+'s default
         cleartext-blocking silently killed every LAN pairing request. Added
         `mobile/android/app/src/main/res/xml/network_security_config.xml` with
         `cleartextTrafficPermitted="true"` (app-wide - the app makes no other network calls, so
         nothing else is weakened) and wired it via `android:networkSecurityConfig` in
         `AndroidManifest.xml`.
      2. **Capacitor's default `androidScheme: "https"`** made the app's own origin `https://localhost`,
         so Chromium's mixed-content policy blocked the LAN `http://` fetch independently of the
         OS-level cleartext setting above (confirmed via logcat:
         `Mixed Content: ... blocked; the content must be served over HTTPS`). Fixed by setting
         `server.androidScheme: "http"` in `mobile/capacitor.config.ts`, Capacitor's documented
         approach for apps that talk HTTP to a local/LAN device.
- [ ] **APK not yet installed/run on a device or emulator** — permission grant/deny/partial-grant
      flows and a real end-to-end sync against a paired desktop still need real hardware. See
      `docs/feature-specs/mobile-architecture.md` section 3.
- [x] Samsung Health SDK bridge for mobile: Partner Program approval obtained, real SDK v1.1.0
      `.aar` wired into `mobile/android/app/build.gradle` (gitignored — Samsung's proprietary
      binary, not ours to redistribute). `SamsungHealthPlugin.kt` implements the JS interface
      against `HealthDataStore`, reading SLEEP/HEART_RATE/ENERGY_SCORE (real signatures obtained
      by decompiling the `.aar` with `javap`, since the SDK's bundled docs are unusable redirect
      stubs). `minSdkVersion` bumped 26→29 (the SDK's own AAR manifest requires it).
      `:app:compileDebugKotlin` succeeds against the real SDK classes. `App.tsx` has a real "Sync
      Samsung Health" button wired to it. Real, honestly-scoped gaps in SDK v1.1.0 itself (not
      fabricated around): no dedicated resting-HR type (approximated via `MIN_HEART_RATE`), no
      stress data type at all (`readStressLevel()` always resolves null), no exercise-session read
      type (`readRecentSessions()` always empty — Health Connect covers this on modern devices).
      **Cannot be exercised on any emulator** — the Samsung Health app itself is Samsung-device-
      exclusive (Galaxy Store, not Google Play) — needs a real Samsung device to verify permission
      flows and actual data shape.
- [x] iOS: Capacitor scaffold committed (`mobile/ios/`, via `npx cap add ios`); ships as a
      self-compiled build (free Apple ID / Personal Team, 7-day resign) rather than through the
      App Store — see `docs/feature-specs/mobile-architecture.md` section 4 for the full build/sideload flow.
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

(Details: `docs/build-and-run/packaging-and-installation.md`.)

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
- [x] **`electron-updater` wired and verified against a real published release.**
      `desktop/electron/main.js`'s `initializeAutoUpdates()` checks on launch and every 4 hours,
      auto-downloads a newer version in the background, and prompts the user to restart once the
      download completes (rather than force-installing). Found and fixed a real gap while
      verifying this: `npm run desktop:dist` (plain `--win`, no `--publish`) never generates or
      uploads `latest.yml`, the manifest `electron-updater` needs - a release created by manually
      uploading just the installer (as `v0.1.0` originally was) leaves every running app's update
      check silently finding nothing, forever, with no error. New `npm run desktop:release`
      (`electron-builder --win --publish always`) publishes the installer plus
      `latest.yml`/`.blockmap` correctly. Also found and fixed a real NSIS incompatibility while
      publishing the first real release: a hand-built multi-resolution `.ico` with a
      PNG-compressed 256px frame (needed to satisfy electron-builder's own ≥256px exe-icon
      requirement) crashes this repo's NSIS version's `MUI_ICON` loader with "invalid icon file
      size" - fixed by giving electron-builder a single 512x512 PNG and letting its own icon
      pipeline generate the platform `.ico`/`.icns` instead of hand-building one
      (`scripts/generate-app-icons.mjs`). Published `v0.1.1` via the corrected flow and confirmed
      the release's `latest.yml` references the exact uploaded asset name - the actual baseline
      going forward. `v0.1.0` remains published as a download-only artifact (its assets don't
      match a manifest, so it never offered auto-update to begin with).
- [x] **In-app Updates panel** (`components/updates-panel.tsx`, on `/settings`): the only prior
      visibility into update status was a native OS dialog once a download finished - nothing
      showed current version, whether a check had run, or download progress. New IPC bridge
      (`desktop/electron/main.js`'s `updateStatus`/`setUpdateStatus`, forwarded over
      `atlas:update-status`; `preload.js`'s `atlasDesktop.updates`) mirrors electron-updater's
      real state (checking/downloading/downloaded/error/up-to-date, with progress percent) into
      the renderer, plus a manual "Check for updates" button and a "Restart and install now"
      button once a download completes. Shows an honest explanatory note instead of a broken UI
      when opened outside the packaged app (`window.atlasDesktop` is undefined there).
- [x] macOS/Linux **zip** targets configured (no native installers for those platforms, per
      product decision) — config-only, never built on those OSes.
- [ ] Signed installers — **blocked on a real code-signing certificate** (business decision, not
      engineering; `CSC_LINK`/`CSC_KEY_PASSWORD` env vars are all `electron-builder` needs once a
      cert exists).
- [x] **App icon / branding assets**: real original artwork (`assets/brand/atlas-mark.svg`,
      matching the in-app teal→terracotta gradient mark) replaces the default Electron icon.
      `scripts/generate-app-icons.mjs` (sharp + png-to-ico) generates `desktop/build/icon.ico`
      (Windows) and `icon.png` (Linux/macOS fallback, 512x512) plus the web favicon
      (`apps/web/app/icon.png`/`apple-icon.png`, auto-served by Next.js). Wired into
      `desktop/package.json`'s `build.win.icon`/`build.mac.icon`/`build.linux.icon`. Still
      missing: a real `.icns` for macOS (needs `iconutil`, unavailable on this Windows machine) -
      `icon.png` is set as the mac icon in the meantime, which electron-builder accepts but isn't
      a proper multi-resolution bundle icon.
- [~] Packaged smoke test — done manually twice; not yet automated into CI.

## 10. Frontend hardening — P1 — PARTIAL

- [x] **IA collapse: each module owns its Dashboard, Settings becomes a single tabbed hub.**
      "Shared shell" nav previously had 4 items (Overview, Dashboard, Ask Atlas, Settings) plus
      Nutrition/Endurance each carrying their own settings-adjacent items (Onboarding,
      Integrations, Tracking fields) - too many top-level destinations for what's conceptually
      one thing. Collapsed to: **Shared shell = Ask Atlas + Settings only.** Settings is now a
      tabbed hub (`<SettingsTabs>`, real `Link`-based navigation so each tab stays a real
      deep-linkable server-rendered page, not client-only tab state) covering Overview
      (`/settings`), Setup (`/settings/setup` - the onboarding wizard, now also reachable anytime
      to edit profile/market/providers, not just on first run), Integrations
      (`/settings/integrations`), and Tracking fields (`/settings/tracking`). Nutrition's old
      "Nutrition summary" page at `/nutrition` is now labeled **Dashboard** and is the module's
      default landing page (`featureOptions` href updated); Endurance's `/dashboard` - previously
      filed under "Shared shell" despite being endurance-specific content - moved into the
      Endurance nav group where it always semantically belonged. The old placeholder-only `/`
      route (literal "Desktop shell placeholder" / "Mobile shell placeholder" dashed boxes, never
      real content) now redirects to `/nutrition`. Updated `error.tsx`/`not-found.tsx`'s "Back to
      dashboard" links and the onboarding wizard's finish-navigation target accordingly (both
      pointed at the now-endurance-only `/dashboard` or the removed `/onboarding`/`/planner`
      routes). 23 e2e tests passing (added `/settings/setup` to the accessibility/responsive
      smoke suite).
- [x] **Visual polish pass, dashboard as the reference implementation**: the UI was flat text
      everywhere (dt/dd rows, and a dashed "not implemented yet" placeholder style
      (`.atlas-placeholder`) wrongly wrapping real, already-loaded content on the dashboard and
      planner pages). Added `recharts`; `<CapabilityBarChart>` renders the capability snapshot as
      a real color-coded bar chart. New `<TrendBadge>` infers up/down/flat from the backend's
      free-text trend strings and color-codes them, wired into `PageScaffold`'s KPI cards. New
      `.atlas-priority-badge`, `.atlas-stat`/`.atlas-stat-grid` (replaces the placeholder misuse),
      and `.atlas-timeline` (accent rail replacing plain stacked cards for chronological entries).
      Hover elevation/transitions on panels and cards, respecting `prefers-reduced-motion`. Caught
      and fixed two real bugs this surfaced: a fixed `minmax(340px, 1fr)` grid column overflowing
      on mobile (didn't shrink below 340px even when the viewport's content area was narrower),
      and the e2e harness's standalone Next.js server never getting `.next/static` copied next to
      it - every e2e-tested page had been rendering with **zero CSS applied** for the project's
      entire history, invisible until the new accessibility/responsive smoke suite caught it
      (confirmed the real packaged Electron app was never affected - electron-builder's
      `extraResources` already copies static assets correctly at package time). The same pattern
      has since been rolled out to the remaining pages (capability, timeline, nutrition, cooking,
      shopping) - `CapabilityBarChart` and `TrendBadge` on capability/timeline,
      `.atlas-priority-badge` replacing ad-hoc badge reuse, `.atlas-timeline` for the
      chronological timeline and cooking prep sequence, `.atlas-stat-grid` for prominent numeric
      KPIs (nutrition targets, shopping budget snapshot).
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
- [x] Refresh button: new `<RefreshButton>` (`components/refresh-button.tsx`, `router.refresh()`)
      on every endurance and nutrition page (dashboard, capability, timeline, nutrition, cooking,
      shopping, planner — the last alongside its existing regenerate-with-reason form, as a
      quicker "just re-check" action). Verified live that clicking it re-fetches.
- [x] **Accessibility audit + responsive QA** (automated, not manual — see the note below on
      scope): new `e2e/web/accessibility.spec.ts` runs `@axe-core/playwright` (WCAG2A/2AA rules)
      across all 9 primary routes, plus a horizontal-overflow check at a 375px mobile viewport
      for the same routes. This surfaced and led to fixing a real, widespread bug: many
      `<dt>`/`<dd>` pairs across 12 files (dashboard, capability, cooking, nutrition, planner,
      shopping, timeline, settings/integrations, and several form components) weren't wrapped in
      a `<dl>` ancestor, which axe correctly flags as a serious violation. Also surfaced and fixed
      a real e2e-harness gap (see `e2e/copy-standalone-static.mjs`): the standalone Next.js server
      was started directly without copying `.next/static` next to it, so every e2e-tested page was
      silently rendering with **zero CSS applied** the whole time - only caught now because
      earlier specs only asserted visible text, never layout. Confirmed this never affected the
      real packaged app (electron-builder's `extraResources` already copies static assets
      correctly at package time, see section 9). 16 new e2e checks, all passing. This is automated
      smoke coverage, not a substitute for a full manual audit with real assistive tech and real
      devices - noted honestly, not claimed as complete.
- [x] **Production-safe cache strategy**: audited - every fetch in the frontend already goes
      through `requestJson`/raw `fetch` calls with `cache: "no-store"` (`lib/api.ts` and the two
      other direct-fetch call sites in `app-lock-data.ts`/`pairing-data.ts`), so there was no
      stale-cache risk to begin with; this just makes that fact verified and explicit rather than
      assumed.
- [x] **Version/build metadata display**: new `<AppVersionFooter>` (`components/app-version-footer.tsx`)
      in the shell layout footer, showing the web package version plus the live backend version
      and health status (fetched from the extended `/health` endpoint - see section 11).
- [ ] Upgrade Next.js past the `postcss` XSS advisory (GHSA-qx2v-qp2m-jg93) — `npm audit fix
      --force` proposes a breaking major bump; needs its own scoped upgrade + full regression pass.
      Deliberately still deferred - out of scope for this pass, tracked here not dropped.

## 11. Backend hardening — P1 — PARTIAL

- [x] Structured logging + request IDs (`core/logging.py`, `core/middleware.py`): one JSON log
      line per request (method, path, status, duration), a request ID generated or reused from
      an `X-Request-Id` header, echoed back in the response, and attached to every log line
      emitted while handling that request via a contextvar. Verified live against a running
      uvicorn instance, not just unit tests. Tracing/metrics (OpenTelemetry or similar) still
      not started — logging alone gets most of the day-to-day debugging value for a local-first
      single-user app; revisit tracing if/when multi-service correlation is actually needed.
- [x] **Dependency health endpoints + startup config validation**: `GET /api/v1/health` now runs
      real dependency checks (`DependencyCheck[]`) instead of always reporting `"ok"` - a live
      `SELECT 1` against the SQLite connection (`LocalStateDatabase.health_check()`, catches a
      locked/corrupted db file, not just "is the connection object non-null") and a writability
      check on the local state directory; overall `status` becomes `"degraded"` if either fails.
      New `validate_startup_config()` (`core/config.py`) runs in `main.py`'s lifespan before the
      app accepts traffic - probes that `local_db_path`/`local_state_path`'s parent directories
      are actually writable (a real temp-file write+delete, not just `mkdir`) and that
      `api_port` is a valid TCP port, raising a `RuntimeError` naming the exact setting and env
      var to fix instead of letting a bad OneDrive-synced path or permission change surface as an
      opaque `sqlite3.OperationalError` deep inside the state singleton's constructor. 5 new
      tests (`test_system_health.py`, `test_startup_config_validation.py`).
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

## 13. Documentation still needed — P1 — DONE

- [x] **End-user desktop install guide** (`docs/user-guides/desktop-install.md`): Windows-only
      (macOS/Linux are zip-only, config-only per product decision), download location, NSIS
      install flow, the SmartScreen warning explained honestly (no code-signing cert yet - a
      deferred business decision, not a bug), per-user AppData data location, and `electron-updater`
      flagged as wired but not yet exercised against a real published release.
- [x] **Android install guide** (`docs/user-guides/android-install.md`): states upfront this is a
      dev build with no Play Store listing; documents the real Capacitor build commands, the
      actual 5-step LAN-pairing flow (code, expiry, attempt lockout, device token) sourced from
      `pairing.py`, and exactly which fields sync from Health Connect/Samsung Health.
- [x] **First-run Ollama setup guide** (`docs/user-guides/ollama-first-run.md`): short, UI-driven
      (Settings → On-device AI runtime → health check → pull models → save), distinct from the
      existing architectural `docs/build-and-run/ollama-on-device-and-agents.md`.
- [x] **Integration troubleshooting guide** (`docs/user-guides/integration-troubleshooting.md`):
      symptom → cause → fix for Strava OAuth (all three real stages and their exact state fields),
      Health Connect/Samsung Health bridge sync, and the Brave Search fallback's no-key/bad-key
      behavior - all using real field/error-string names from the code.
- [x] **Data retention & privacy guide** (`docs/user-guides/data-retention-and-privacy.md`): exact
      storage paths, OS-native secret store details (DPAPI/Keychain/libsecret + the honest
      base64-fallback caveat), exactly which external hosts are ever contacted and why (no
      Atlas-hosted relay), full-deletion steps, and the app-lock PIN's real "deterrent, not
      authentication" security model.
- [x] **Recovery/restore guide** (`docs/user-guides/recovery-and-restore.md`): app-won't-start
      (quotes the real `validate_startup_config()` error messages), corrupted/locked database via
      the extended `/health` endpoint, and moving to a new machine. Documents two real, honest
      gaps rather than inventing nicer flows: **there is no PIN-reset feature** (verified directly
      against `update_app_lock()` - changing/disabling an enabled lock always requires the current
      PIN, no bypass) - the only recovery is a manual edit of the `app_lock` field inside the
      `shared_state` JSON blob; and **there is currently no backup/export UI** in Settings (API-only
      today, `GET/POST /api/v1/backup/export|import`).
- [x] **Backup/export guide** (`docs/user-guides/backup-and-export.md`): exact export contents
      (verified against `export_backup()` - the full `shared_state` blob: profile, integrations, AI
      settings, pantry, app lock, pairing, etc.), what's excluded (sync history and planner
      generation history live in separate tables, untouched by export/import), that provider
      secrets ARE included but only in their OS-protected form (verified against
      `export_backup()`'s docstring - safe to move between your own devices, not a
      share-with-anyone artifact), and that import is a full overwrite gated only by
      `backup_format_version == 1`.
- [x] **Agent prompt/version maintenance guide** (`docs/build-and-run/agent-prompt-maintenance-guide.md`):
      maintainer-facing - where prompts live, the split between prompt-level guardrail rules and
      the deterministic `guardrails.py` enforcement backstop, and the exact steps to bump
      `PROMPT_VERSION` and record a `docs/build-and-run/prompt-changelog.md` entry.

Two real product gaps surfaced while writing these guides (documented honestly above, not
silently fixed - out of scope for a docs pass): no backup/export UI in Settings, and no app-lock
PIN reset flow beyond a manual database edit. Worth their own follow-up if this becomes a genuine
pain point in practice.

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
