# Project Atlas Execution Tracker

Status: Active  
Purpose: Living implementation tracker for the shared Atlas app, Feature 1, and Feature 2.

## Done

- [x] Product PRD for Feature 1 created and refined
- [x] Product PRD for Feature 2 created and refined
- [x] Shared master product architecture document created
- [x] Cross-feature integration rules added to both PRDs
- [x] Shared app shell and master feature switcher defined at architecture level
- [x] Root monorepo workspace scaffold created
- [x] Shared packages scaffolded under `packages/shared`, `packages/config`, and `packages/ui`
- [x] Infrastructure scaffold added with `infra/docker-compose.yml`
- [x] Frontend Next.js shell scaffold created under `apps/web`
- [x] Placeholder mobile and desktop routes created for both features
- [x] Backend FastAPI scaffold created under `apps/api`
- [x] Shared API endpoints scaffolded for auth, feature registry, app preferences, profile, markets, and localization
- [x] Shared health contracts introduced for hydration and body weight
- [x] Shared in-memory settings state added for app preferences, profile, and localization
- [x] Local run instructions added for frontend and backend scaffolds
- [x] Replaceable stub endpoint added for endurance dashboard data
- [x] Replaceable stub endpoint added for nutrition planner data
- [x] Frontend loader modules added so stub screens can later swap to real APIs cleanly
- [x] Shared healthcheck endpoint and validated app-preferences flow added
- [x] Shared settings and onboarding pages wired to shared API loaders with stub fallback
- [x] Shell feature-toggle save flow added and shell navigation now respects enabled features
- [x] Shared API local smoke-test commands documented
- [x] Nutrition onboarding form added with shared profile, localization, and shell-locale save flow
- [x] Onboarding upgraded to staged, profile-aware validation flow for mobile and desktop
- [x] Inline validation styling and field-level onboarding error messaging added
- [x] Endurance timeline and insight stub endpoints added with matching dashboard UI slice
- [x] Nutrition shopping-list and substitution stubs added with matching planner UI slice
- [x] Endurance timeline and capability routes upgraded from placeholders to real loader-driven feature views
- [x] Nutrition shopping and cooking routes upgraded from placeholders to real loader-driven feature views
- [x] Shared on-device AI runtime settings added for Ollama, optional Groq, and guarded prompt profiles
- [x] Local-first self-contained distribution direction documented across architecture and feature PRDs
- [x] Shared `POST /api/v1/chat` endpoint and Ask Atlas UI wired to local AI runtime with deterministic fallback
- [x] Shared frontend localization helpers added and wired into shell feature views
- [x] Ollama runtime health-check flow added to the local AI settings surface
- [x] Backend tests added for AI settings validation and chat fallback/provider behavior
- [x] Backend syntax verified with `python -m compileall apps\\api\\app`
- [x] Stubbed local-first integrations API added for Strava, Health Connect, and Samsung Health
- [x] Integrations settings UI now exposes connector toggles, login-consent staging, and stub sync controls
- [x] `.agents` handoff prompts added for shared shell, endurance, and nutrition agents
- [x] Strava OAuth launch contract and local callback capture scaffold added behind integration adapters
- [x] Shared chat grounding now includes connector state so Ollama or Groq can reason over live integration readiness
- [x] Strava token-exchange contract and local runtime persistence scaffold added
- [x] First live Strava sync path added for athlete profile and recent activities
- [x] Endurance dashboard, timeline, insights, and chat grounding can now project synced Strava data without changing the frontend contract
- [x] Local secret-protection layer added so persisted Strava tokens no longer remain in plaintext state files
- [x] Manual Strava callback capture and token-exchange flow added to the integrations UI for local runtime testing
- [x] Health Connect local permission runtime now projects session, hydration, and body-weight data through the shared contract
- [x] Samsung Health local SDK-consent runtime now projects session, sleep, and resting-HR data through the shared contract
- [x] Endurance dashboard, timeline, insights, and AI grounding now aggregate multi-source connector data
- [x] Nutrition planner, shopping, cooking, and summary views now share one richer deterministic weekly-plan contract
- [x] Nutrition stub outputs now respect Atlas localization currency selection, including manual currency override
- [x] Health Connect and Samsung Health now expose packaged-app device-sync bridge endpoints for SDK-imported records
- [x] Google Fit history is routed through the Health Connect bridge path instead of a deprecated new Google Fit API dependency
- [x] Nutrition now has an Open Food Facts product search and barcode lookup adapter with search/scrape fallback contracts
- [x] Nutrition summary UI now surfaces ingredient data source status and product nutriment facts
- [x] Playwright E2E smoke scaffolding added for nutrition, cooking, and integrations pages
- [x] Comprehensive production-readiness audit and packaging/Ollama/agent-handoff documentation added in `docs/prod-readiness-audit.md`
- [x] Production documentation suite added: `docs/packaging-and-installation.md`, `docs/ollama-on-device-and-agents.md`, `docs/nutrition-endurance-feature-spec.md`, and `docs/production-todo.md` (master backlog + agent handoff)
- [x] Shared contracts extended for nutrition seven-day refresh/calendar/prep-hacks/videos and endurance support links (`packages/shared/src/index.ts`)
- [x] Nutrition planner now returns a seven-day calendar, meal prep hacks, curated YouTube video links, and refresh/provenance metadata; added `POST /nutrition/planner/refresh` with persisted swap history and a seven-day refresh cycle
- [x] Planner UI rebuilt with plan-status banner, seven-day calendar grid, manual refresh (server action), meal-prep-hacks panel, and prep-video strip; cooking page surfaces meal prep hacks
- [x] Endurance dashboard and insights now return non-medical coach support links (recovery, strength, base training, and contextual connector setup) surfaced on the dashboard and capability pages
- [x] Verified: backend `pytest` 44 passing, `next lint` clean, and `next build` green after `.next` clean

## In Progress

- [ ] Replacing integration stub flows with live provider adapters while preserving local-first boundaries
- [ ] Enriching the local packaged-app Strava callback UX so desktop and mobile builds can complete auth with less manual code handling
- [ ] Expanding local Health Connect sync payload coverage so packaged-app endurance flows receive richer Android-device health detail
- [ ] Expanding local Samsung Health sync payload coverage so packaged-app endurance flows receive richer Samsung-device health detail
- [ ] Turning placeholder feature pages into PRD-aligned vertical slices
- [ ] Aligning frontend shared shell with backend shared settings contracts
- [ ] Expanding nutrition from deterministic market-aware stubs into real optimizer, recipe, and substitution modules
- [ ] Wiring native packaged-app adapters that call the Health Connect and Samsung SDKs and post into the local device-sync endpoints
- [ ] Extending nutrition contracts with seven-day calendar refresh, meal prep hacks, YouTube resources, and persisted plan history
- [ ] Extending endurance contracts with support links and richer coach-resource guidance

## Immediate Next Steps

- [ ] Add tests for feature switching and shared health contract consistency
- [ ] Add real connector callback and device-consent adapters behind the new integrations contract, starting with richer packaged-app Strava callback completion states
- [ ] Replace the current Windows-first protected-token fallback with production-grade OS-backed secure credential storage across desktop and mobile targets
- [ ] Replace local Health Connect stub sync payloads with richer packaged-app payload mapping for permissions, workout detail, hydration, and body metrics
- [ ] Replace local Samsung Health stub sync payloads with richer packaged-app payload mapping for consent state, session detail, sleep, and recovery signals
- [ ] Deepen multi-source endurance scoring beyond current deterministic aggregation rules
- [ ] Add first-class packaged-app callback handling so Strava no longer needs manual code/state entry during local testing
- [ ] Replace nutrition market stubs with recipe-library, price-layer, and weekly-optimizer modules behind the same contracts
- [ ] Add seven-day nutrition calendar view data and manual refresh orchestration without breaking current planner loaders
- [ ] Add meal prep hacks and curated support/video links to nutrition and endurance response contracts
- [ ] Add a browser-search provider implementation for nutrition fallback links, then plug Playwright/browser-use execution behind the existing fallback interface
- [ ] Add native mobile bridge code for Health Connect and Samsung Health once the packaged app target is scaffolded

## Near-Term Backlog

- [ ] Add tests for feature switching and shared health contract consistency
- [ ] Add dependency installation and run instructions once package choices are finalized
- [ ] Add live storage persistence for shared settings and integration state

## Notes

- The current codebase is scaffold-first, not yet production-ready
- Shared contracts should remain centralized and reused by both features
- Mobile and desktop support must remain a first-class requirement in every new slice
- Connector upgrades should continue to assume Atlas ships as a local packaged app with on-device auth, consent, sync, and secret handling rather than a hosted callback service
