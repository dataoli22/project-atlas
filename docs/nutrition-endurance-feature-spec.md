# Nutrition & Endurance Feature Spec (Refresh, Calendar, Prep Hacks, Support Links)

Last updated: July 9, 2026

This spec defines the concrete product features being added to Atlas in this iteration and their
exact data contracts. It is the implementation source of truth for the nutrition and endurance
agents. The TypeScript contracts already exist in `packages/shared/src/index.ts`; the backend
Pydantic schemas and the frontend loaders/pages must match them field-for-field
(snake_case in Python, camelCase in TS).

---

## Part A — Nutrition: seven-day plan with refresh, calendar, prep hacks, and videos

### A.1 Goals

1. The weekly planner becomes a real **seven-day calendar** surface.
2. The plan **refreshes every seven days** by default, with **manual refresh** available earlier.
3. Each plan carries **meal prep hacks** and **YouTube video links**.
4. Refreshes are explained (`refreshReason`) and previous plans are preserved in **swap history**
   instead of silently overwritten.

### A.2 New shared contracts (already in `packages/shared/src/index.ts`)

- `NutritionMealPrepHack` — `title`, `detail`, `appliesToDays[]`, `estimatedTimeSavedMinutes`,
  `difficulty` (`easy | medium | advanced`).
- `NutritionVideoLink` — `title`, `url`, `topic`, `marketScope`, `whyRecommended`.
- `NutritionCalendarMeal` — `slot` (`breakfast | lunch | dinner`), `title`, `isLeftover`,
  `carryoverFrom?`.
- `NutritionCalendarDay` — `date` (ISO), `dayLabel`, `isBatchDay`, `prepWindow?`, `meals[]`,
  `cookTimeMinutes`, `leftoverInto?`, `status`.
- `NutritionPlanRefreshMeta` — `planId`, `plannerVersion`, `weekStartDate`, `weekEndDate`,
  `lastRefreshedAt`, `refreshDueAt`, `refreshIntervalDays`, `refreshReason`, `status`, `isStale`,
  `dataFreshness`.
- `NutritionSwapHistoryEntry` — `refreshedAt`, `reason`, `summary`.
- `NutritionPlannerData` extended with: `refresh`, `calendarDays`, `mealPrepHacks`, `videoLinks`,
  `swapHistory`.

### A.3 Backend schema mapping (`apps/api/app/features/nutrition/schemas.py`)

Add Pydantic models mirroring the TS types, snake_case:

```
NutritionMealPrepHack(title, detail, applies_to_days: list[str],
                      estimated_time_saved_minutes: int, difficulty: str)
NutritionVideoLink(title, url, topic, market_scope, why_recommended)
NutritionCalendarMeal(slot, title, is_leftover: bool, carryover_from: str | None = None)
NutritionCalendarDay(date, day_label, is_batch_day: bool, prep_window: str | None,
                     meals: list[NutritionCalendarMeal], cook_time_minutes: int,
                     leftover_into: str | None, status: str)
NutritionPlanRefreshMeta(plan_id, planner_version, week_start_date, week_end_date,
                         last_refreshed_at, refresh_due_at, refresh_interval_days: int,
                         refresh_reason, status, is_stale: bool, data_freshness)
NutritionSwapHistoryEntry(refreshed_at, reason, summary)
```

Extend `NutritionPlannerResponse` with:
`refresh: NutritionPlanRefreshMeta`, `calendar_days: list[NutritionCalendarDay]`,
`meal_prep_hacks: list[NutritionMealPrepHack]`, `video_links: list[NutritionVideoLink]`,
`swap_history: list[NutritionSwapHistoryEntry]`.

### A.4 Service logic (`apps/api/app/features/nutrition/service.py`)

The service is deterministic today (`_market_blueprints()`), and must stay deterministic-first.

- **Calendar derivation**: build exactly 7 `NutritionCalendarDay` entries from the existing
  `blueprint.meals` (7 weekday templates). Map each meal to three `NutritionCalendarMeal` slots.
  Mark `is_leftover` when the lunch/dinner text contains "leftover". Set `is_batch_day` when the
  day equals `blueprint.batch_day`. Derive `prep_window` from the cooking plan window on batch
  day. Set `leftover_into` from `leftover_plan` when it references the next day.
  - Compute dates from a fixed anchor: `week_start_date = "2026-07-13"` (a Monday matching
    "Week of July 13, 2026"); `date` for each day = anchor + index.
- **Refresh metadata**: `week_end_date = week_start + 6 days`;
  `refresh_interval_days = 7`; `refresh_due_at = week_start + 7 days` (00:00Z);
  `last_refreshed_at = generated_at`; `is_stale = refresh_due_at < now`;
  `status = "stale" if is_stale else "current"`; `plan_id = f"plan-{market_code}-{week_start}"`;
  `planner_version = "2026.07"`; `refresh_reason = "Scheduled weekly plan"` on first generation;
  `data_freshness` = short human summary (e.g. "Deterministic market blueprint, on-device").
- **Meal prep hacks**: return a market-aware list built from the blueprint (batch grains once,
  pre-chop repeat vegetables after shopping, stage breakfast jars for 3 days, freeze one fallback
  meal on batch day, plan one low-energy leftover night, mark ingredients used in ≥3 meals as
  first-pass prep). Each hack sets realistic `estimated_time_saved_minutes` and `difficulty`.
  Derive `appliesToDays` from the blueprint's meals/shopping data where possible.
- **Video links**: return curated YouTube search links, `market_scope` aware:
  - Beginner weekly meal prep — `https://www.youtube.com/results?search_query=beginner+weekly+meal+prep`
  - Budget healthy meal prep — `https://www.youtube.com/results?search_query=budget+healthy+meal+prep`
  - High protein meal prep — `https://www.youtube.com/results?search_query=high+protein+meal+prep+for+the+week`
  - Meal prep storage tips — `https://www.youtube.com/results?search_query=meal+prep+storage+tips`
  - Market-specific, e.g. for IN — `https://www.youtube.com/results?search_query=indian+budget+meal+prep`
  Each link gets `topic`, `market_scope` (the current market code or "global"), and
  `why_recommended`.

### A.5 Refresh endpoint (`apps/api/app/features/nutrition/router.py`)

Add `POST /api/v1/nutrition/planner/refresh`:
- Optional body `{ reason?: string }`.
- Records a `NutritionSwapHistoryEntry` for the outgoing plan (preserve, don't overwrite),
  updates `last_refreshed_at` to now, recomputes `refresh_due_at = now + interval`, sets
  `refresh_reason` from the body (default "Manual refresh"), `status = "current"`, `is_stale=false`.
- Returns the full `NutritionPlannerResponse`.
- Persist refresh state + swap history via `shared_state` (JSON store today; SQLite later).
  Add a small nutrition runtime slice to `state.py` or a dedicated helper; keep persistence
  disabled under pytest (mirror `_persistence_disabled`).
- Keep `GET /planner` returning the current plan with correct `is_stale` computed against `now`.

### A.6 Frontend

- `apps/web/lib/nutrition-data.ts`: extend the API response type, the stub, and
  `mapPlannerResponse` with the new fields. Add `refreshNutritionPlan(reason?)` calling the POST
  endpoint via `requestJson` with a stub fallback.
- `apps/web/app/(shell)/planner/page.tsx`: add
  1. a **7-day calendar view** — one card/row per day, desktop week grid + mobile scroll, showing
     each day's three meals, batch-day/prep-window markers, leftover carryover arrows, and the
     per-day `status`;
  2. a **plan status banner** showing `current | refreshing | stale | failed`, `refreshDueAt`,
     and days remaining;
  3. a **refresh control** (Server Action or client handler) that calls the refresh endpoint and
     shows `refreshReason`/what changed;
  4. a **meal prep hacks** panel;
  5. a **video resource strip** (opens links in a new tab, `rel="noreferrer"`).
- `apps/web/app/(shell)/cooking/page.tsx`: surface `mealPrepHacks` alongside the existing prep
  sequence (cooking page already consumes the planner loader).

### A.7 Tests (`apps/api/tests/test_nutrition.py`)

- Planner returns 7 `calendar_days`, non-empty `meal_prep_hacks`, non-empty `video_links`,
  and a well-formed `refresh` block; `refresh_due_at == week_start + 7 days`.
- `is_stale` is computed correctly.
- Refresh endpoint appends to `swap_history`, advances `last_refreshed_at`/`refresh_due_at`,
  sets `status="current"`, and echoes the supplied `reason`.
- Localization currency still respected (existing behavior preserved).

---

## Part B — Endurance: coach support links

### B.1 Goals

Surface **non-medical** support resources through the endurance coach: recovery/mobility
routines, strength for endurance athletes, base training, and connector setup help. Resources are
separated from coaching advice, each labeled with **why it is relevant** and a freshness stamp.

### B.2 New shared contracts (already in `packages/shared/src/index.ts`)

- `EnduranceSupportResourceType` = `recovery | mobility | strength | base-training |
  connector-setup | general`.
- `EnduranceSupportLink` — `title`, `url`, `topic`, `whyRecommended`, `resourceType`,
  `freshnessAt?`.
- `EnduranceDashboardData.supportLinks` and `EnduranceInsightsData.supportLinks` added.

### B.3 Backend (`apps/api/app/features/endurance/schemas.py` + `service.py`)

- Add `EnduranceSupportLink` Pydantic model (snake_case: `why_recommended`, `resource_type`,
  `freshness_at`), and `support_links: list[EnduranceSupportLink]` to `EnduranceDashboardResponse`
  and `EnduranceInsightsResponse`.
- Build a shared `_support_links()` helper. Include, at minimum:
  - Recovery/mobility — `https://www.youtube.com/results?search_query=runner+recovery+mobility+routine`
  - Strength for runners — `https://www.youtube.com/results?search_query=strength+training+for+runners`
  - Base training — `https://www.youtube.com/results?search_query=endurance+base+training+for+beginners`
  - Strava auth setup — `https://developers.strava.com/docs/authentication/` (`connector-setup`)
  - Health Connect setup — `https://developer.android.com/health-and-fitness/guides/health-connect`
  - Samsung Health setup — `https://developer.samsung.com/health/android`
- Make connector-setup links **contextual**: prioritize setup help for connectors that are not yet
  connected (read connector state from `shared_state.get_integrations()`), and set
  `why_recommended` accordingly. Set `freshness_at` to the response `generated_at`.
- Populate `support_links` in both the live and stub code paths of `get_stub_dashboard`,
  `get_endurance_dashboard`, `get_stub_insights`, `get_endurance_insights`.
- **Do not** modify `agent_runtime.py` — grounding continues to work with the existing fields.

### B.4 Frontend

- `apps/web/lib/endurance-data.ts`: extend the dashboard + insights API response types, stubs, and
  mappers with `supportLinks` (map `why_recommended`→`whyRecommended`, `resource_type`→
  `resourceType`, `freshness_at`→`freshnessAt`).
- `apps/web/app/(shell)/dashboard/page.tsx` and `apps/web/app/(shell)/capability/page.tsx`
  (insights consumer): add a **Coach support resources** panel listing links grouped by
  `resourceType`, each showing `whyRecommended`, opening in a new tab with `rel="noreferrer"`.
  Add a short "resources are informational, not medical advice" note.

### B.5 Tests (`apps/api/tests/test_endurance_live_sync.py` or a new test module)

- Dashboard and insights responses include non-empty `support_links` with valid `resource_type`
  values in both stub and live paths.
- When a connector is disconnected, a `connector-setup` link for it is present.

---

## Part C — Guardrails for both agents

- Deterministic-first: compute everything without the model; the model only explains.
- No invented prices, nutrition math, or biometrics.
- Support/video links are curated static resources, clearly non-medical, always labeled with why.
- Preserve backward compatibility: existing loaders and pages must keep working; all new fields
  are additive.
- Keep the `fetchJson` stub-fallback pattern so pages render before the backend is available.
- Match snake_case ↔ camelCase exactly between Python responses and TS mappers.
