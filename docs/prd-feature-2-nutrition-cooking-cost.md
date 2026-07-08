# Project Atlas PRD

## Feature 2: Nutrition, Cooking, and Lowest-Cost Meal Planning

Version: 1.0  
Status: Draft for implementation handoff  
Scope: Second feature only. This PRD covers nutrition planning, shopping, cooking, and cost optimization. Endurance and capability tracking are covered separately in Feature 1.

## 1. Product Summary

Project Atlas Feature 2 is an open-source nutrition planning system that generates a weekly food plan with minimal user effort.

The product should automatically produce:

- a weekly meal plan
- a shopping list
- a cooking schedule
- a nutrition summary
- budget-aware substitutions

The system should minimize:

- food cost
- cooking time
- utensil usage
- food waste
- decision fatigue

The system should maximize:

- nutritional completeness
- meal variety
- local ingredient availability
- batch cooking efficiency

The MVP should work for one user first, but the design should remain flexible for students, professionals, families, and other budget-conscious users later.

For MVP localization scope, support is intentionally limited to Europe, China, India, the United Kingdom, and the United States.

This feature must also fit into a shared Project Atlas product shell so it can coexist cleanly with Feature 1, Endurance and Capability.

## 2. Problem Statement

People do not just need recipe suggestions. They need a system that converts nutritional goals, budget, time limits, local availability, and cooking constraints into a realistic weekly plan.

Current tools usually fail in at least one of these ways:

- they ignore local grocery prices
- they do not adapt to the user's country or currency
- they produce meals that are too complex to cook regularly
- they do not minimize waste across the whole week
- they optimize single meals instead of weekly practicality

## 3. Vision

Build a privacy-respecting open-source nutrition agent that plans shopping, cooking, and meals for an entire week with minimal manual effort.

The system should feel like:

- a nutrition planner
- a meal prep assistant
- a low-cost optimizer
- a local grocery intelligence layer

The user should not have to repeatedly decide:

- what to eat
- what to buy
- what to cook first
- what to do with leftovers

## 4. Target User

### Primary User

- Single founder-user

### Future Users

- Students
- Young professionals
- Families
- Budget-conscious users
- People living abroad
- Users with dietary restrictions
- Users who want low-effort healthy eating

## 5. Goals and Success Criteria

### Product Goals

- Generate weekly meal plans from user goals and constraints
- Keep plans realistic for available cooking time and equipment
- Minimize total weekly cost using local price signals or fallback estimates
- Produce shopping lists and cooking workflows automatically
- Adapt output to country, city, and local ingredient patterns
- Support dynamic currency selection based on country location
- Limit MVP localization to a small set of supported regions and languages
- Integrate cleanly with the endurance feature through shared identity, shared settings, and shared health-related data contracts

### MVP Success Criteria

- User can enter profile, diet, budget, location, and kitchen constraints
- System can generate a 7-day meal plan with breakfast, lunch, dinner, or reduced schedules
- System can generate a shopping list with estimated total cost
- Costs are displayed in the user's local currency by default based on country
- User can manually override currency if needed
- System can produce simple substitutions when ingredients are unavailable
- System can support local Ollama-based AI features without requiring paid APIs
- UI language is correctly selected for supported markets and defaults to English outside French, German, and Chinese support paths
- If both product features are enabled, the user can switch between them from a single shared app shell

## 6. Non-Goals for This PRD

- Medical nutrition diagnosis
- Clinical meal plans for disease treatment
- Automatic grocery checkout or ordering
- Full pantry OCR
- Receipt scanning
- Household collaboration
- Real-time retailer inventory guarantees
- Perfect live pricing in every country

## 7. Key Product Principles

- Open-source first
- Local-first where practical
- Country-aware by design
- Cost transparency
- Explainable optimization
- Minimal user effort
- Flexible enough for different cuisines and lifestyles
- Deliberately narrow MVP localization before expanding globally
- One product shell with feature-level modularity rather than separate disconnected apps

## 8. Supported MVP Markets and Languages

MVP support is limited to the following regions:

- Europe
- China
- India
- United Kingdom
- United States

### Language Support Rules

- Europe supports `en`, `fr`, and `de`
- China supports `zh`
- India supports `en`
- United Kingdom supports `en`
- United States supports `en`

### Currency Defaults

- Europe defaults to `EUR`
- China defaults to `CNY`
- India defaults to `INR`
- United Kingdom defaults to `GBP`
- United States defaults to `USD`

### Scope Notes

- "Europe" in MVP should be implemented as a Europe market profile with `EUR` as the default currency
- French and German are only required for the Europe market in MVP
- Chinese language support is only required for the China market in MVP
- All other MVP-supported markets use English only
- Markets outside this list are out of scope for MVP

## 9. Cross-Feature Integration

Feature 2 must work as one module inside the larger Project Atlas product.

### Shared Product Requirements

- shared authentication and single-user account
- shared settings system
- shared design system
- shared mobile and laptop navigation shell
- shared Ollama configuration
- shared data export model

### Integration With Feature 1

If both features are enabled:

- hydration and body weight data may be reused across both features
- nutrition summaries may support endurance recovery interpretation
- training load and activity context may support athlete-oriented meal planning later
- the AI layer should be able to answer feature-specific questions while respecting feature boundaries

### Master Feature Toggle

The app should provide a master feature switcher in the shared shell so the user can move between:

- Endurance and Capability
- Nutrition and Meal Planning

This switcher is a navigation control, not a destructive settings toggle. It should change the active workspace without disconnecting data or changing account settings.

## 10. Platforms and Device Support

The product must support both:

- Mobile: fast review of today's meals, shopping list, and cooking steps
- Laptop: weekly planning, configuration, deeper nutrition review, and debugging

### Platform Requirement

- The app must be responsive on phones and laptops
- The same backend should power both experiences
- Mobile should prioritize execution and quick edits
- Laptop should prioritize planning and configuration

### Recommended Delivery Model

- Local-first app distributed as a user-run desktop executable and phone package where feasible
- Responsive UI remains appropriate for development and shell parity, but the production direction is a self-contained local app rather than a centralized hosted website

## 11. Core User Jobs

- Tell the system my budget, diet, and cooking constraints
- Get a complete weekly meal plan
- See what to buy and what it will roughly cost
- Cook with minimal time and cleanup
- Avoid wasting leftover ingredients
- Stay near my nutrition goals without excessive planning
- View all prices in a currency that matches my location
- Use the app in a supported language for my market
- Move between nutrition and endurance workflows without feeling like I am using two separate products

## 12. Core Use Cases

### Weekly Planning

- Set or update weekly budget
- Select meal frequency and cooking frequency
- Generate a weekly plan
- Review shopping total and substitutions

### Daily Use

- View today's meals
- Follow simplified cooking instructions
- See what leftovers should be used next

### Budget Review

- Compare estimated total cost against budget
- Swap ingredients or recipes to reduce cost
- View spend in the appropriate local currency

## 13. MVP Feature Set

### 13.1 User Profile and Constraints

Required user inputs:

- age
- sex
- height
- weight
- activity level
- goal such as lose fat, maintain, gain muscle, athlete support
- dietary restrictions
- allergies
- weekly budget
- country
- state or region
- city
- meal schedule preference
- cooking time available
- cooking frequency
- cooking style
- kitchen equipment
- cuisine preferences
- protein preference
- disliked foods
- favorite foods

### 13.2 Nutrition Engine

The MVP should calculate practical daily targets for:

- calories
- protein
- fat
- carbs
- fiber
- hydration guidance

Micronutrient reporting can be present in MVP, but should be lower priority than calories, protein, fiber, and practical usability.

### 13.3 Ingredient Discovery

The system should maintain a master ingredient set using:

- built-in nutrition datasets
- built-in ingredient metadata
- optional price and location enrichment

Each ingredient should support:

- nutrition data
- estimated price
- unit
- shelf life
- cuisine tags
- seasonality if known
- availability confidence

### 13.4 Recipe Library and Discovery

The MVP should support:

- a built-in local recipe library
- recipe tagging by cuisine, cooking method, difficulty, and equipment
- recipe simplification for lower complexity

Web scraping can exist as an optional extension path, but the MVP should not depend on scraping in order to be usable.

### 13.5 Weekly Optimizer

The optimization engine should generate a weekly plan that balances:

- budget
- nutrition goals
- meal variety
- cooking time
- ingredient reuse
- equipment constraints
- food waste reduction

### 13.6 Meal Generator

The system should generate:

- 7-day plan
- meal-by-meal schedule
- recipe assignments
- portion estimates
- substitution-aware options

### 13.7 Shopping Generator

The system should generate:

- shopping list grouped by category
- estimated quantity per ingredient
- estimated total cost
- expected leftover ingredients

### 13.8 Batch Cooking Planner

The system should produce:

- prep-day recommendations
- batch cooking suggestions
- leftover-aware reuse plan
- simple cooking timeline

### 13.9 Substitution Engine

The system should suggest alternatives when an ingredient is:

- too expensive
- unavailable
- incompatible with diet or allergy
- hard to cook with available equipment

### 13.10 Currency and Localization

Dynamic currency selection must be a first-class MVP feature.

Requirements:

- currency defaults from the user's selected market
- all shopping totals, ingredient prices, and budget comparisons use that currency by default
- user can manually override currency in settings
- the system stores both numeric amount and currency code
- UI should show ISO currency code where ambiguity is possible
- market-specific defaults should be applied during onboarding
- language defaults should be based on selected market
- language can be manually changed within the supported language set for that market

Examples:

- India defaults to `INR`
- United States defaults to `USD`
- United Kingdom defaults to `GBP`
- China defaults to `CNY`
- Europe defaults to `EUR`

If live country pricing is unavailable, fallback estimates must still be shown in the chosen local currency.

### 13.11 Language Localization

The MVP must support the following UI languages only:

- English
- French
- German
- Chinese

Requirements:

- users in Europe can choose English, French, or German
- users in China use Chinese by default
- users in India, the United Kingdom, and the United States use English only
- unsupported markets should not be exposed in MVP onboarding
- recipe content and generated summaries should respect the active UI language where feasible

## 14. Functional Requirements

### FR1. Authentication

- Support simple local account for single-user mode
- No social login required for MVP
- Share authentication with other Project Atlas features

### FR2. Onboarding

- User can complete onboarding with profile, location, budget, and dietary constraints
- User can update settings later
- User can only select supported MVP markets during onboarding

### FR3. Weekly Plan Generation

- User can generate a weekly meal plan on demand
- User can regenerate all or part of the week
- System must explain major plan tradeoffs when relevant

### FR4. Shopping List Generation

- User can view shopping list grouped by category
- User can see estimated total cost and per-item estimate
- User can mark items already available at home

### FR5. Cooking Plan

- User can view prep schedule and meal instructions
- Recipes should be simplified for minimal effort where possible

### FR6. Nutrition Summary

- User can see daily and weekly macro summaries
- User can inspect whether the plan is under or over target

### FR7. Substitutions

- User can request cheaper alternatives
- System can automatically substitute unavailable ingredients
- Substitutions should preserve nutrition intent where possible

### FR8. Localization and Currency

- System determines default currency from selected market
- User can override currency manually
- Budget input, ingredient costs, and total estimates must remain currency-consistent
- Currency code must be stored with every cost estimate
- UI formatting must respect locale-aware number and symbol conventions
- System determines default UI language from selected market
- Europe market must allow English, French, and German selection
- China market must default to Chinese
- India, United Kingdom, and United States must use English-only UI in MVP
- The shared shell must preserve market and language settings across enabled features

### FR9. Flexible Scheduling

- User can choose breakfast, lunch, dinner, two-meal, or OMAD schedule
- User can choose daily cooking, every 2 days, every 3 days, or weekly prep

### FR10. Export

- User can export weekly plan, shopping list, and nutrition summary as JSON or CSV

### FR11. Market Scope Enforcement

- Unsupported markets must not appear as selectable options in MVP
- Market-specific currency and language defaults must be applied consistently across onboarding, settings, and generated outputs

### FR12. Shared Shell Navigation

- User can access this feature from a shared product shell
- User can switch to the endurance feature through a master feature switcher when that feature is enabled
- The shared shell must work on both mobile and laptop

### FR13. Cross-Feature Data Contract

- Shared health-related fields such as hydration and body weight should use common definitions across features
- Feature-specific services must consume shared fields through stable contracts, not duplicated ad hoc schemas

## 15. Non-Functional Requirements

### NFR1. Cost

- Target runtime cost should be zero for a self-hosted single user
- Paid APIs should not be required for MVP operation

### NFR2. Open Source

- Core stack must use open-source technologies
- Any optional paid integrations must remain optional

### NFR3. Reliability

- Weekly generation must still work with fallback data when scrapers fail
- Missing live prices should not block plan generation

### NFR4. Performance

- Weekly plan generation should complete fast enough for interactive use
- Dashboard and plan pages should remain usable on mobile and laptop

### NFR5. Privacy

- User profile, preferences, and food history should remain locally controllable
- Secrets must be stored in environment variables only

### NFR6. Extensibility

- New countries, stores, currencies, datasets, or recipe sources should plug in without rewriting the full system

### NFR7. Localization Quality

- Supported language strings must be complete for core user flows
- Currency and language defaults must be deterministic for each supported market
- Language fallback must default to English unless the market is China

### NFR8. Product Cohesion

- This feature must feel like one mode within Project Atlas, not a separate standalone application
- Shared shell navigation and settings must behave consistently on mobile and laptop

## 16. Data and Source Strategy

### MVP Data Strategy

Prioritize a stable fallback-first system:

1. built-in recipe library
2. built-in ingredient and nutrition datasets
3. built-in market-to-currency and market-to-language mapping
4. optional price enrichment adapters
5. optional scraper-based enrichments

### Recommended Open Data Sources

- USDA FoodData Central
- Open Food Facts
- country-specific food composition tables where legally usable

### Price Strategy

For MVP, pricing should use a layered approach:

1. direct store data if available
2. recent cached prices
3. heuristic local estimates
4. generic ingredient fallback prices converted into local currency

## 17. AI and LLM Requirements

### LLM Provider

Primary provider for MVP:

- Ollama running locally

Optional abstraction layer:

- LiteLLM-compatible routing if the project later adds remote providers

### Model Usage

- recipe simplification
- shopping summary generation
- weekly meal narrative
- substitution explanations
- natural-language Q&A over user plan and nutrition data

### Important Design Rule

The LLM should not be the source of truth for nutrition math, pricing math, or optimization constraints. Deterministic services should calculate those first, and the LLM should explain the result.

If both product features are enabled, the LLM routing layer should keep feature context explicit so nutrition prompts do not accidentally rely on endurance claims unless those data are intentionally passed in.

## 18. Ollama Configuration Requirements

Although local Ollama often runs without authentication, the app should support a configurable key field for remote or protected deployments.

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

DEFAULT_COUNTRY=IN
DEFAULT_CURRENCY=INR
DEFAULT_LANGUAGE=en

ENCRYPTION_KEY=
JWT_SECRET=
```

### Configuration Behavior

- `OLLAMA_API_KEY` is optional
- `DEFAULT_COUNTRY` and `DEFAULT_CURRENCY` are bootstrap defaults only
- `DEFAULT_LANGUAGE` is a bootstrap default only
- user-level country selection overrides environment defaults
- if `OLLAMA_API_KEY` is set, backend includes it in configured auth headers
- Any Ollama or optional Groq keys should remain on the local device runtime and must not be forwarded to a centralized Atlas service

## 19. Proposed Open-Source Tech Stack

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- PWA support
- shared app shell with feature switcher

### Backend

- FastAPI
- Python
- Pydantic
- SQLAlchemy or SQLModel

### Database

- PostgreSQL
- SQLite for single-user local mode if needed

### AI and Orchestration

- Ollama
- LangGraph for workflow orchestration if needed
- LiteLLM as optional provider abstraction

### Optimization

- Google OR-Tools
- PuLP as fallback if desired

### Search and Parsing

- Trafilatura
- BeautifulSoup
- Playwright for optional scraper adapters

### Vector / Retrieval

- Qdrant or ChromaDB only if semantic retrieval becomes necessary

### Auth

- simple local auth for MVP

### Deployment

- Docker Compose for local development

## 20. Proposed Information Architecture

### Primary Screens

- Product home / shell
- Dashboard
- Weekly Planner
- Shopping List
- Cooking Plan
- Nutrition Summary
- Settings
- Ask Atlas

### Mobile Priorities

- today's meals
- shopping checklist
- cooking steps
- quick budget check
- easy feature switching from the shared shell

### Laptop Priorities

- weekly plan review
- ingredient substitutions
- budget and nutrition comparison
- settings and localization controls
- persistent shell navigation for switching features

### Settings Requirements

- language selector
- market selector
- currency selector
- locale preview for pricing display
- feature switcher visibility and active workspace state

## 21. UX Requirements for Mobile and Laptop

### Shared Requirements

- consistent terminology across devices
- no hidden critical workflow on one device only
- clear price visibility everywhere
- clear nutrition tradeoff visibility
- localization choices must be easy to inspect and change
- feature switching must remain obvious and low-friction on both mobile and laptop

### Mobile-Specific

- fast daily-use screens
- checklist-friendly shopping view
- easy meal navigation

### Laptop-Specific

- denser weekly planning layout
- easier settings management
- better inspection of nutrition and cost tradeoffs

## 22. Data Model Outline

### Core Entities

- `user`
- `user_profile`
- `app_preference`
- `market_profile`
- `location_profile`
- `currency_preference`
- `language_preference`
- `ingredient`
- `ingredient_price`
- `recipe`
- `recipe_ingredient`
- `weekly_plan`
- `planned_meal`
- `shopping_list`
- `shopping_list_item`
- `leftover_item`
- `nutrition_target`
- `nutrition_summary`

### Shared Entities

- `app_preference` should store cross-product preferences such as active feature, enabled features, and shared UI state
- shared user profile fields such as hydration or weight should be reusable by other features through common contracts

### Important Fields

#### location_profile

- market_code
- country_code
- country_name
- state_or_region
- city
- locale_code

#### currency_preference

- default_currency_code
- display_currency_code
- currency_source
- manual_override_enabled
- formatting_locale

#### language_preference

- default_language_code
- display_language_code
- language_source
- manual_override_enabled

#### app_preference

- active_feature
- enabled_feature_flags
- preferred_platform_density
- shared_locale

#### ingredient_price

- ingredient_id
- amount
- currency_code
- unit
- source
- observed_at
- confidence_score

#### weekly_plan

- week_start_date
- budget_amount
- budget_currency_code
- schedule_type
- cooking_frequency
- optimization_notes

#### planned_meal

- date
- meal_type
- recipe_id
- servings
- estimated_cost_amount
- estimated_cost_currency_code
- nutrition_json

#### market_profile

- market_code
- default_currency_code
- supported_language_codes
- default_language_code

## 23. Optimization Logic MVP

The weekly optimizer should use deterministic logic and constraint solving rather than freeform generation.

### Inputs

- nutrition targets
- budget
- meal schedule
- available cooking time
- equipment constraints
- diet restrictions
- price estimates
- ingredient reuse potential
- location and currency context
- market and language context where it affects recipe selection or output formatting

### Objectives

- stay within budget
- reach acceptable nutrition targets
- reduce waste
- reduce prep complexity
- reduce excessive repetition

### Outputs

- weekly meal plan
- shopping list
- total estimated spend
- explanation of main compromises

## 24. Currency and Localization Logic

This feature is required from MVP day one.

### Defaulting Rules

- Use selected market to infer default currency code
- Use selected market to infer default language
- If market changes, prompt the user to keep current currency or switch to the new default
- Budget inputs should auto-format in the active currency

### Storage Rules

- Store raw numeric amount separately from formatted display text
- Store currency code with all price and budget records
- Preserve original source currency when ingesting external prices if different from display currency

### Conversion Rules

- Conversion is optional, not mandatory, for MVP
- If conversion is used, the conversion source and timestamp must be stored
- If no reliable conversion source exists, display original price plus a clearly labeled estimate in display currency

### UX Rules

- Always show currency code on summary and totals where symbol ambiguity exists
- Show user why a currency was selected
- Allow easy override in settings
- Show user why a language was selected

### MVP Market Matrix

- Europe: currency `EUR`; languages `en`, `fr`, `de`
- China: currency `CNY`; language `zh`
- India: currency `INR`; language `en`
- United Kingdom: currency `GBP`; language `en`
- United States: currency `USD`; language `en`

## 25. Risks and Constraints

### Data Risk

- Live price data may be incomplete or unreliable
- Country-specific food datasets may vary in quality

### Product Risk

- Overcomplicating the MVP with too much scraping
- Overpromising pricing accuracy
- Making optimization too rigid to reflect real-life cooking preferences
- Building Feature 1 and Feature 2 separately enough that they fragment the user experience

### Localization Risk

- Wrong currency defaults can undermine trust immediately
- Mixed-currency estimates can confuse users if not labeled carefully
- Partial translations can make supported languages feel broken
- Treating Europe as one market may be too coarse for later expansion, so the implementation should keep room for country-level refinement

## 26. MVP Release Plan

### Phase 1

- scaffold backend and frontend
- implement onboarding
- implement shared app shell and master feature switcher
- add local recipe and ingredient datasets
- add market, currency, and language mapping
- build budget and location settings

### Phase 2

- implement nutrition target engine
- implement weekly optimizer
- generate meal plans and shopping lists

### Phase 3

- add cooking timeline and leftover logic
- add substitution engine
- add Ollama-generated summaries

### Phase 4

- add optional scraper adapters
- add export
- improve localization and currency handling

## 27. Acceptance Criteria

The MVP is acceptable when:

- the user can complete onboarding with diet, budget, and location
- the system generates a usable 7-day plan
- the shopping list shows estimated total cost
- the budget and shopping cost use a market-aware default currency
- the user can override currency manually
- only Europe, China, India, United Kingdom, and United States are selectable in MVP
- Europe supports English, French, and German UI
- China supports Chinese UI
- India, United Kingdom, and United States use English UI
- the weekly plan still works without live scraping
- local Ollama can generate plan summaries grounded in deterministic outputs
- the feature is reachable from a shared product shell on mobile and laptop
- if Feature 1 is enabled, the user can switch between both features through a master feature switcher

## 28. Coding Agent Handoff Instructions

This section is written for the implementation agent.

### Objective

Build the first working MVP for Feature 2 only: nutrition, cooking, shopping, and lowest-cost weekly planning.

### Delivery Constraints

- Use free and open-source tools and libraries only
- Keep local development simple
- Optimize for a single user first
- Support both mobile and laptop from the first usable version
- Make localization and dynamic currency handling part of the core architecture, not an afterthought
- Limit MVP market coverage strictly to Europe, China, India, United Kingdom, and United States
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
  /datasets
/infra
  docker-compose.yml
/docs
  prd-feature-1-endurance-capability.md
  prd-feature-2-nutrition-cooking-cost.md
```

### Build Order

1. Scaffold `apps/web` and `apps/api`
2. Add local auth, shared shell navigation, and settings storage
3. Add feature switcher and shared settings foundation
4. Add onboarding with market, country, budget, and diet constraints
5. Implement market-to-currency and market-to-language default mapping
6. Add ingredient, recipe, and nutrition base datasets
7. Implement nutrition target engine
8. Implement weekly optimizer
9. Implement shopping list and cost summaries
10. Implement substitution logic
11. Add cooking plan and leftovers
12. Add Ollama-generated summaries and Q&A

### Implementation Rules

- Keep nutrition math deterministic
- Keep optimization deterministic and testable
- Do not depend on live scraping for MVP correctness
- Store all costs with numeric amount plus currency code
- Separate source currency from display currency when needed
- Treat location, locale, and currency as separate but linked concepts
- Prefer plugin-style adapters for price sources and recipe ingestion
- Keep market scope hard-limited in the UI and backend validation
- Keep translations file-based and deterministic for the supported languages only
- Reuse shared app shell, shared auth, and shared settings contracts
- Keep cross-feature integration optional so Feature 2 still runs independently if Feature 1 is disabled

### Minimum API Endpoints

- `POST /api/v1/auth/login`
- `GET /api/v1/me`
- `GET /api/v1/app/features`
- `PUT /api/v1/app/preferences`
- `GET /api/v1/settings/profile`
- `PUT /api/v1/settings/profile`
- `GET /api/v1/settings/markets`
- `GET /api/v1/settings/localization`
- `PUT /api/v1/settings/localization`
- `POST /api/v1/plans/generate-week`
- `GET /api/v1/plans/current-week`
- `POST /api/v1/plans/regenerate-meal`
- `GET /api/v1/shopping-list/current`
- `GET /api/v1/nutrition-summary/current-week`
- `POST /api/v1/substitutions/suggest`
- `POST /api/v1/chat`

### Minimum UI Pages

- `/login`
- `/`
- `/onboarding`
- `/dashboard`
- `/planner`
- `/shopping`
- `/cooking`
- `/nutrition`
- `/settings`
- `/ask`

### Required Early Tests

- nutrition target calculation tests
- market-to-currency default mapping tests
- market-to-language default mapping tests
- currency override persistence tests
- supported market restriction tests
- weekly optimizer constraint tests
- substitution logic tests
- responsive UI smoke tests for phone and laptop widths
- shared shell feature-switching tests
- cross-feature shared contract tests for hydration and weight fields

### What to Defer

- automatic ordering
- OCR and barcode flows
- household collaboration
- medical-condition protocols
- full live scraper dependency
- additional languages beyond English, French, German, and Chinese

## 29. Open Questions

- Should Europe remain one MVP market, or should it later split into country-specific support?
- Should exchange-rate conversion be part of MVP or deferred to a later version?
- How much live price scraping is worth adding before the local fallback system is solid?

## 30. Source Notes

This PRD was adapted from the original Open Nutrition Agent vision note and intentionally narrowed to:

- one feature only
- one user first
- free and open-source implementation choices
- mobile and laptop support from day one
- Ollama-first AI setup
- dynamic currency selection based on country location as a core requirement
- limited MVP market and language support for Europe, China, India, United Kingdom, and United States
