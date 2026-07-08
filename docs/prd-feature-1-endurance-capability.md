# Project Atlas PRD

## Feature 1: Endurance and Capability Operating System

Version: 1.0  
Status: Draft for implementation handoff  
Scope: First feature only. Nutrition, cooking, and lowest-cost planning are explicitly out of scope for this document and will be added in a later PRD.

## 1. Product Summary

Project Atlas is a personal health intelligence system that turns raw activity and recovery data into a long-term view of human capability.

The first feature focuses on endurance and physical capability, not calorie counting or generic readiness scores. The product should help the user understand:

- how durable they are becoming over time
- what training loads they now tolerate
- whether recovery supports adaptation
- whether they are progressing toward events like a marathon or ultra
- which patterns increase or reduce injury risk

The initial release is for a single user and should be built entirely with free and open-source tools where possible. It must work on both mobile and laptop.

Even as an MVP, the product should be designed so tracked inputs, activity types, and capability dimensions can expand beyond the founder-user without requiring a full redesign.

This feature must also fit into a shared Project Atlas product shell so it can coexist cleanly with Feature 2, Nutrition and Lowest-Cost Meal Planning.

## 2. Problem Statement

Current consumer fitness apps report isolated metrics such as steps, pace, sleep, or calories. They do not maintain a durable memory of capability development across months and years.

The user wants a system that can answer questions like:

- Is this my highest lower-limb loading week ever?
- Am I adapting well to long efforts?
- How does today affect marathon or 50k readiness?
- Am I recovering enough to absorb training?
- Which shoe, terrain, or training pattern helps me perform better?

## 3. Vision

Build an AI-supported operating system for endurance capability that combines wearable data, workout history, subjective inputs, and long-term memory into a personalized capability model.

The product should emphasize:

- capability over fitness vanity metrics
- long-term memory over daily dashboards
- interpretable coaching over raw charts
- personal trajectory over comparison with other users

## 4. Target User

### Primary User

- Single founder-user

### Future Users

- Endurance athletes
- Military aspirants
- Trekkers
- Adventure travellers
- Students living abroad who want structured self-management

## 5. Goals and Success Criteria

### Product Goals

- Ingest data from Samsung Health, Android health sources, and Strava
- Normalize workouts, recovery, and daily activity into one timeline
- Compute a transparent Capability Score and supporting sub-scores
- Generate actionable daily and weekly coaching insights
- Preserve milestone memory permanently
- Support mobile-first capture and laptop-first review equally well
- Keep inputs, activity types, and tracked dimensions flexible enough for the future user groups
- Integrate cleanly with the nutrition feature through shared identity, shared settings, and shared data contracts

### MVP Success Criteria

- User can connect Samsung Health and Strava, and can ingest Android health data via Health Connect
- User can manually log soreness, pain, mood, RPE, shoes, terrain, hydration, and notes
- System can display a unified timeline of workouts, recovery, and milestones
- System can compute baseline weekly load, longest effort, rolling time-on-feet, and recovery trend
- System can generate at least 3 useful coaching insights per week from real data
- System can run fully on a local Ollama-powered stack for AI features
- System can support configurable activity types and custom tracking fields without schema rewrites
- If both product features are enabled, the user can switch between them from a single shared app shell

## 6. Non-Goals for This PRD

- Nutrition optimization engine
- Cooking assistant
- Grocery planning
- Lowest-cost meal planning
- Apple Health support
- Real-time watch coaching
- Video gait or form analysis
- Multi-user social features
- Advanced medical claims or diagnosis

## 7. Key Product Principles

- Local-first where practical
- Open-source first
- Explainable scoring over black-box outputs
- User-owned data and exportability
- Mobile and laptop parity for core workflows
- Privacy by default
- Flexible schema and configurable inputs over hardcoded runner-only assumptions
- One product shell with feature-level modularity rather than separate disconnected apps

## 8. Cross-Feature Integration

Feature 1 must work as one module inside the larger Project Atlas product.

### Shared Product Requirements

- shared authentication and single-user account
- shared settings system
- shared design system
- shared mobile and laptop navigation shell
- shared Ollama configuration
- shared data export model

### Integration With Feature 2

If both features are enabled:

- hydration and body weight data may be reused across both features
- nutrition summaries may inform recovery and adaptation interpretation
- activity load and training context may inform athlete-oriented nutrition guidance later
- the AI layer should be able to answer feature-specific questions while respecting feature boundaries

### Master Feature Toggle

The app should provide a master feature switcher in the shared shell so the user can move between:

- Endurance and Capability
- Nutrition and Meal Planning

This switcher is a navigation control, not a destructive settings toggle. It should change the active workspace without disconnecting data or changing account settings.

## 9. Platforms and Device Support

The product must support both:

- Mobile: Android-first experience for data permissions, manual input, and daily usage
- Laptop: browser-based experience for review, analytics, planning, and deeper exploration

### Platform Requirement

- The app must be responsive and usable on phone screens and laptop screens
- The same backend should serve both clients
- Mobile should prioritize quick capture and summaries
- Laptop should prioritize analysis, timeline review, and configuration

### Recommended Delivery Model

- Local-first app distributed as a self-hosted desktop executable and phone package where feasible
- Responsive UI can still be used during development, but the production direction is user-owned packaged distribution rather than a centralized website
- Optional Android wrapper later if Health Connect or Samsung-specific native integration requires it

## 10. Core User Jobs

- Connect my data sources once and keep them synced
- See whether my capability is improving
- Understand whether I am recovering or digging a hole
- Know when to push, maintain, or recover
- Remember key milestones forever
- Ask questions in plain language about training status
- Track the things that matter for my context, even if my training style differs from a runner's
- Move between endurance and nutrition workflows without feeling like I am using two separate products

## 11. Core Use Cases

### Daily

- Review today's activity, recovery, and readiness summary
- Log soreness, pain, mood, hydration, RPE, shoes, terrain, and freeform notes
- Receive a short coach recommendation for today

### Weekly

- Review weekly load vs recent baseline
- See longest effort, time on feet, and consistency
- Understand warning signals for overload or under-recovery

### Long-Term

- Track capability growth over months and years
- View milestone timeline
- Estimate readiness for distance goals such as 20k, marathon, and 50k
- Understand what conditions help or hurt performance

## 12. MVP Feature Set

### 12.1 Data Source Integrations

#### Samsung Health

Required for:

- steps
- sleep
- heart rate if available
- resting heart rate if available
- workouts
- distance
- pace
- cadence if available
- GPS route if available
- calories if available

#### Google Fit / Android Health

Important implementation note:

- Google Fit APIs are deprecated in 2026, and new developer sign-ups were closed on May 1, 2024.
- MVP should treat Health Connect as the primary Android aggregation layer.
- If the user refers to "Google Fit," the product should support the practical equivalent through Health Connect-based ingestion and optionally document a legacy import path later.

Required via Health Connect where available:

- workouts
- steps
- sleep
- heart rate
- body weight
- hydration

#### Strava

Required for:

- imported activities
- route and distance data
- pace and split data
- activity metadata

Note:

- Strava requires OAuth and has platform terms/rate limits that must be respected.
- MVP is for a single user, so the first implementation can remain within personal/single-player app constraints while we validate the product.

### 12.2 Manual Inputs

The system must allow user-entered daily inputs:

- soreness by body area
- pain by body area
- mood
- sleep quality override
- hydration estimate
- RPE
- shoes used
- terrain
- weather notes
- freeform note

The MVP should also support configurable optional fields so the same product can later work for trekkers, military prep, travel-heavy users, and other endurance-oriented users.

Examples of optional or future-trackable inputs:

- pack weight or carried load
- session purpose such as long run, recovery, ruck, trek, commute, or drill
- surface or environment tags
- altitude exposure
- heat or humidity perception
- blister or hotspot tracking
- mobility or strength accessory work
- energy level
- motivation level

### 12.3 Unified Timeline

A chronological timeline should combine:

- workouts
- daily aggregates
- recovery signals
- manual inputs
- derived insights
- milestones

The timeline should not assume every meaningful event is a run. It must support walking, hiking, trekking, rucking, travel-heavy days, and custom activity labels.

### 12.4 Capability Model

The MVP should compute:

- overall Capability Score
- endurance sub-score
- consistency sub-score
- recovery sub-score
- resilience risk flag

The model should be modular so future profiles can weight different signals differently. For example:

- a runner profile may weigh pace and long-run progression more heavily
- a trekker profile may weigh elevation, duration, and load carriage more heavily
- a military-prep profile may weigh back-to-back workload, load carriage, and recovery resilience more heavily

The score does not need to be scientifically perfect in v1. It must be:

- internally consistent
- explainable
- stable enough to track trends over time
- configurable through profile weights rather than hardcoded sport assumptions

### 12.5 Recovery and Load Engine

Required MVP calculations:

- rolling 7-day load
- rolling 28-day load
- longest effort ever
- time on feet
- monotony or load concentration signal
- days since last long effort
- sleep trend
- resting HR trend if available
- subjective soreness trend

### 12.6 AI Coach

The AI layer should produce:

- daily summary
- daily recommendation
- weekly summary
- milestone-aware narrative
- simple Q&A over user data

Example outputs:

- "This week exceeded your recent lower-limb loading baseline."
- "Your sleep and soreness trend suggest recovery should be prioritized today."
- "This is now your longest sustained endurance effort on record."

### 12.7 Milestone Memory

The system should create and preserve milestone events such as:

- first 10k
- first 20k
- first marathon
- longest weekly distance
- first back-to-back long efforts
- first low-pain high-distance shoe combination

## 13. Functional Requirements

### FR1. Authentication

- Support local account for single-user mode
- No social login required in MVP
- Share authentication with other Project Atlas features

### FR2. Source Connection Management

- User can connect and disconnect Samsung Health integration
- User can connect and disconnect Strava integration
- User can authorize Android data access through Health Connect
- User can see last sync time and sync status per source

### FR3. Data Sync

- System can run manual sync on demand
- System can run scheduled background sync
- System deduplicates workouts across sources
- System records raw source payloads for traceability

### FR4. Data Normalization

- Normalize all workouts into one canonical activity model
- Normalize daily aggregates into a common daily summary model
- Preserve source attribution for every record
- Support extensible metadata fields for activity-specific attributes such as pack weight, terrain, or environment tags

### FR5. Manual Logging

- User can submit daily subjective logs from phone or laptop
- User can edit previous logs
- User can enable or disable optional tracking fields in settings
- User can define a limited set of custom tags or custom fields without code changes

### FR6. Insights

- System generates daily and weekly insight cards
- Each insight references the signals used to produce it

### FR7. Capability Timeline

- User can browse progression over time
- User can filter by weeks, months, and years
- User can click milestones to see why they were created
- User can filter by activity type, terrain, load, and custom tags

### FR8. AI Q&A

- User can ask natural-language questions about their own data
- Responses must only use the user's available data and derived metrics
- Responses should mention uncertainty when data is incomplete
- If the nutrition feature is disabled, endurance chat must remain fully usable on its own

### FR9. Export

- User can export normalized data and manual logs as JSON or CSV

### FR10. Configurable Tracking

- User can choose which optional metrics are visible or tracked
- System can support multiple activity categories beyond running
- System can attach structured tags and metadata to workouts and daily logs
- Configuration changes must not require database schema changes for common optional fields

### FR11. Shared Shell Navigation

- User can access this feature from a shared product shell
- User can switch to the nutrition feature through a master feature switcher when that feature is enabled
- The shared shell must work on both mobile and laptop

### FR12. Cross-Feature Data Contract

- Shared health-related fields such as hydration and body weight should use common definitions across features
- Feature-specific services must consume shared fields through stable contracts, not duplicated ad hoc schemas

## 14. Non-Functional Requirements

### NFR1. Cost

- Target runtime cost: zero for a single self-hosted user
- Use local Ollama models for inference
- Prefer free-tier or self-hosted infrastructure only

### NFR2. Open Source

- All core app code must rely on open-source frameworks and libraries
- Avoid paid SaaS dependencies in the MVP

### NFR3. Privacy

- Store secrets in environment variables only
- Encrypt sensitive tokens at rest if persisted
- Minimize retention of unnecessary raw payload data

### NFR4. Performance

- Daily dashboard should load in under 3 seconds on normal broadband
- Timeline views for one year of data should remain usable on laptop and mobile

### NFR5. Reliability

- Sync jobs must be retryable
- Integration failures should not break the rest of the system

### NFR6. Responsiveness

- UI must support phone and laptop layouts without breaking core flows

### NFR7. Extensibility

- Common future tracking additions should be implementable through configuration or metadata, not repeated schema redesign
- MVP should avoid hardcoding runner-only labels into core domain models

### NFR8. Product Cohesion

- This feature must feel like one mode within Project Atlas, not a separate standalone application
- Shared shell navigation and settings must behave consistently on mobile and laptop

## 15. Data Sources and Integration Strategy

### Recommended MVP Strategy

Use a hybrid integration model:

- Android health data via Health Connect
- Strava via OAuth and REST API
- Samsung Health via Samsung Health Data SDK or approved integration path

### Important Feasibility Notes

- Health Connect is the safest Android-first path for free MVP ingestion
- Google Fit should be treated as a legacy concept, not the primary build target
- Samsung Health integration may require Samsung-specific SDK setup and partner constraints that need early validation
- Strava access must comply with current API terms and rate limits

### Sync Priority

1. Health Connect
2. Strava
3. Samsung Health direct integration if needed beyond Health Connect coverage
4. Manual entry fallback for any missing fields

## 16. AI and LLM Requirements

### LLM Provider

Primary provider for MVP:

- Ollama running locally

### Model Usage

- Insight generation
- Weekly summaries
- Narrative milestone descriptions
- Natural-language Q&A over user data

### Important Design Rule

The LLM should not compute core health metrics directly from raw source data. Deterministic application logic should compute metrics first, and the LLM should explain or summarize them.

If both product features are enabled, the LLM routing layer should keep feature context explicit so endurance prompts do not accidentally rely on nutrition claims unless those data are intentionally passed in.

## 17. Ollama Configuration Requirements

Although Ollama commonly runs without an API key in local setups, this product should support a configurable key field because some users may use:

- a reverse proxy in front of Ollama
- an OpenAI-compatible gateway
- a remote Ollama server that is key-protected

### Required Environment Variables

```env
ATLAS_ENV=development
ATLAS_APP_URL=http://localhost:3000
ATLAS_API_URL=http://localhost:8000

DATABASE_URL=postgresql://atlas:atlas@localhost:5432/atlas

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_API_KEY=

STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=http://localhost:8000/api/v1/integrations/strava/callback

SAMSUNG_HEALTH_ENABLED=true
HEALTH_CONNECT_ENABLED=true

ENCRYPTION_KEY=
JWT_SECRET=
```

### Configuration Behavior

- `OLLAMA_API_KEY` is optional
- If empty, backend sends unauthenticated requests to Ollama
- If present, backend includes it as a bearer token or configured header
- Admin settings screen should allow testing the Ollama connection
- Any Ollama or optional Groq keys should remain on the local device runtime and must not be forwarded to a centralized Atlas service

## 18. Proposed Open-Source Tech Stack

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- PWA support
- Charting with Apache ECharts or Plotly
- shared app shell with feature switcher

### Backend

- FastAPI
- Python
- SQLAlchemy or SQLModel
- Pydantic
- APScheduler or Celery for sync jobs

### Database

- PostgreSQL

### AI

- Ollama
- local embedding model
- pgvector for embeddings if semantic memory is needed in MVP

### Maps

- OpenStreetMap
- Leaflet

### Auth

- simple local auth for single-user mode

### Deployment

- local Docker Compose for development
- self-hosted VPS optional later

## 19. Proposed Information Architecture

### Primary Screens

- Product home / shell
- Dashboard
- Timeline
- Activity detail
- Recovery view
- Capability view
- Manual log form
- Integrations settings
- AI chat / ask Atlas

### Mobile Priorities

- today summary
- quick log
- latest workout
- single-tap sync status
- adaptive forms that only show enabled fields
- easy feature switching from the shared shell

### Laptop Priorities

- long timeline
- charts and comparisons
- milestone explorer
- settings and data troubleshooting
- easier configuration of tracked fields, tags, and profile settings
- persistent shell navigation for switching features

### Shared Shell Requirements

- one global header or tab shell for product-level navigation
- one master feature switcher for changing the active feature workspace
- no duplicate login or duplicated settings experience between features

## 20. UX Requirements for Mobile and Laptop

### Shared Requirements

- Consistent navigation and terminology across devices
- Responsive layout with no hidden critical functionality
- Large touch targets on mobile
- Dense analytical views on laptop
- feature switching must remain obvious and low-friction on both mobile and laptop

### Mobile-Specific

- Fast load
- quick input flows
- collapsible charts
- minimal typing burden

### Laptop-Specific

- multi-panel analytics
- richer tables
- broader timeline context
- easier data export and debugging

## 21. Data Model Outline

### Core Entities

- `user`
- `app_preference`
- `user_profile`
- `tracking_preference`
- `integration_account`
- `sync_job`
- `raw_event`
- `activity`
- `activity_route`
- `daily_summary`
- `manual_log`
- `shoe`
- `milestone`
- `capability_snapshot`
- `insight`
- `chat_session`
- `chat_message`

### Shared Entities

- `app_preference` should store cross-product preferences such as active feature, enabled features, and shared UI state
- shared user profile fields such as hydration or weight should be reusable by other features through common contracts

### Flexibility Pattern

To keep the MVP flexible without overengineering:

- store stable universal fields as first-class columns
- store optional domain-specific attributes in structured JSON metadata
- support user-configurable tags for activities and daily logs
- support profile-based scoring weights instead of separate scoring engines per user type

### Important Fields

#### activity

- source
- source_activity_id
- start_time
- duration_seconds
- distance_meters
- elevation_gain_meters
- average_hr
- max_hr
- average_pace
- activity_type
- route_polyline
- shoe_id
- perceived_exertion
- activity_category
- load_weight_kg
- terrain_tags
- environment_tags
- metadata_json

#### daily_summary

- date
- steps
- sleep_minutes
- resting_hr
- hydration_ml
- weight_kg
- readiness_flags
- metadata_json

#### manual_log

- date
- soreness_score
- pain_score
- body_area_notes
- mood_score
- rpe
- terrain
- weather_note
- shoe_id
- freeform_note
- custom_tags
- custom_metrics_json

#### user_profile

- primary_goal
- profile_type
- enabled_tracking_fields
- capability_weight_config

#### app_preference

- active_feature
- enabled_feature_flags
- preferred_platform_density
- shared_locale

#### capability_snapshot

- date
- capability_score
- endurance_score
- consistency_score
- recovery_score
- resilience_risk_score
- rationale_json

## 22. Capability Scoring MVP Logic

The first version should use deterministic heuristics rather than pretending to be a clinical model.

### Inputs

- rolling workload
- longest recent effort
- consistency of training
- recent sleep trend
- resting HR drift if available
- soreness and pain trend
- time since last hard effort
- activity category and context tags
- carried load where relevant

### Output

- 0 to 100 capability score
- supporting component scores
- explanation payload that can be shown in UI and used by the LLM

The scoring service should accept a profile configuration so the same engine can adapt to runners, trekkers, military aspirants, and general endurance users.

## 23. Risks and Constraints

### Integration Risk

- Samsung Health access details may be more complex than generic Android health ingestion
- Strava platform rules may limit some downstream AI use and display behavior
- Google Fit should not be relied on as a future-proof integration

### Product Risk

- Overpromising on injury prediction or readiness without enough data
- Mixing deterministic scoring and generative AI without a clear trust boundary
- Adding too much configurability too early and making the MVP harder to use
- Building Feature 1 and Feature 2 separately enough that they fragment the user experience

### UX Risk

- Analytics-heavy UI could become unusable on mobile if not intentionally simplified

## 24. MVP Release Plan

### Phase 1

- scaffold backend and frontend
- set up Postgres
- wire Ollama client
- implement local auth
- implement shared app shell and master feature switcher
- build manual logging
- add tracking preferences and metadata-based extensibility foundations

### Phase 2

- Health Connect ingestion
- Strava OAuth and sync
- normalized activity timeline

### Phase 3

- capability scoring
- recovery engine
- insights generation

### Phase 4

- milestone memory
- AI Q&A
- export

## 25. Acceptance Criteria

The MVP is acceptable when:

- the user can open the app on phone and laptop and complete core flows
- Health Connect ingestion works for Android-supported data
- Strava sync works for the user's own account
- Samsung Health support path is documented and at least partially wired where feasible
- the system computes visible capability snapshots from real data
- the AI coach uses Ollama and produces usable summaries grounded in deterministic metrics
- the system stores all important data locally in open formats
- the feature is reachable from a shared product shell on mobile and laptop
- if Feature 2 is enabled, the user can switch between both features through a master feature switcher

## 26. Coding Agent Handoff Instructions

This section is written for the implementation agent.

### Objective

Build the first working MVP for Feature 1 only: endurance and capability tracking.

### Delivery Constraints

- Use only free and open-source tools and libraries
- Optimize for local development first
- Keep architecture simple enough for a single-user app
- Support both mobile and laptop from the first usable version
- Default to local Ollama for AI
- Build this as one module within a shared Atlas app, not as a separate standalone frontend
- Keep the product compatible with self-contained desktop and phone packaging rather than assuming centralized hosted APIs

### Recommended Repository Structure

```text
/apps
  /web
  /api
/packages
  /config
  /ui
  /shared
/infra
  docker-compose.yml
/docs
  prd-feature-1-endurance-capability.md
  prd-feature-2-nutrition-cooking-cost.md
```

### Build Order

1. Scaffold monorepo with `apps/web` and `apps/api`
2. Add Docker Compose for Postgres and Ollama
3. Implement env loading and health checks
4. Implement local auth and shared shell navigation
5. Build feature switcher and shared settings foundation
6. Build integrations settings UI
7. Build manual logging flow
8. Add Strava OAuth flow
9. Add Health Connect ingestion path
10. Add normalized activity and daily summary tables
11. Add timeline and dashboard
12. Add capability scoring service
13. Add insight generation through Ollama
14. Add milestone memory and AI chat

### Implementation Rules

- Keep core score math deterministic and testable
- Keep LLM prompts small and grounded in structured metrics
- Save raw source payloads separately from normalized records
- Deduplicate activities by source ids plus timestamp heuristics
- Add source attribution to every displayed metric
- Prefer server-side integration adapters, not frontend API calls for secrets
- Use first-class columns for universal fields and JSON metadata for optional fields
- Avoid hardcoding the product around running-only terminology
- Reuse shared app shell, shared auth, and shared settings contracts
- Keep cross-feature integration optional so Feature 1 still runs independently if Feature 2 is disabled

### Minimum API Endpoints

- `POST /api/v1/auth/login`
- `GET /api/v1/me`
- `GET /api/v1/app/features`
- `PUT /api/v1/app/preferences`
- `GET /api/v1/dashboard/today`
- `GET /api/v1/timeline`
- `POST /api/v1/manual-logs`
- `GET /api/v1/manual-logs/:date`
- `GET /api/v1/integrations`
- `GET /api/v1/tracking-preferences`
- `PUT /api/v1/tracking-preferences`
- `POST /api/v1/integrations/strava/connect`
- `GET /api/v1/integrations/strava/callback`
- `POST /api/v1/integrations/strava/sync`
- `POST /api/v1/integrations/health-connect/sync`
- `POST /api/v1/integrations/samsung-health/sync`
- `GET /api/v1/capability`
- `GET /api/v1/insights`
- `POST /api/v1/chat`

### Minimum UI Pages

- `/login`
- `/`
- `/dashboard`
- `/timeline`
- `/capability`
- `/log`
- `/settings/tracking`
- `/settings/integrations`
- `/ask`

### Required Early Tests

- capability score calculation tests
- activity deduplication tests
- Strava token refresh tests
- Ollama client tests
- responsive UI smoke tests for phone and laptop widths
- configurable field rendering tests
- profile-based scoring configuration tests
- shared shell feature-switching tests
- cross-feature shared contract tests for hydration and weight fields

### What to Defer

- Apple Health
- video analysis
- wearable real-time coaching
- multi-user support
- deep nutrition intelligence

## 27. Open Questions

- How much direct Samsung Health access is feasible without additional partner approval beyond standard SDK setup?
- Do we want a pure PWA first, or an Android shell app early to simplify Health Connect permissions?
- Should route maps be included in MVP, or can they wait until after timeline and capability scoring are stable?

## 28. Source Notes

This PRD was adapted from the original Project Atlas vision note and intentionally narrowed to:

- one feature only
- one user
- free and open-source implementation choices
- mobile and laptop support from day one
- Ollama-first AI setup

It was also updated so the MVP stays implementation-light while remaining flexible for the broader future user groups.
