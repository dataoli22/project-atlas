# Project Atlas Master Product Architecture

Version: 1.0  
Status: Draft for implementation handoff  
Purpose: Define the shared product architecture that connects Feature 1 and Feature 2 into one coherent application.

## 1. Product Context

Project Atlas is one product with multiple feature modules.

Current MVP modules:

- Feature 1: Endurance and Capability
- Feature 2: Nutrition, Cooking, and Lowest-Cost Meal Planning

These features must not be built as separate apps. They must share:

- one account
- one app shell
- one backend
- one settings model
- one AI configuration layer
- one responsive experience across mobile and desktop
- one user-owned local runtime per device

## 2. Architecture Goals

- Keep the product modular without fragmenting the user experience
- Allow each feature to run independently if the other is disabled
- Support shared health-related data where appropriate
- Preserve mobile and desktop usability from day one
- Keep implementation simple enough for a single-user open-source MVP
- Make future features pluggable without major rewrites

## 3. System Model

Project Atlas should be implemented as a modular monolith for MVP.

### Why Modular Monolith

- simpler than microservices for a single-user MVP
- easier local development
- shared database is straightforward
- shared auth, settings, and AI routing are easier to manage
- feature modules can still be cleanly separated by package boundaries

### High-Level Shape

- one frontend app
- one backend API
- one database
- shared packages for UI, types, config, and datasets
- feature modules isolated by domain
- packaged local distribution for desktop and phone, instead of a centralized Atlas cloud

## 4. Shared Product Shell

The frontend should use a shared shell that wraps all enabled features.

### Shell Responsibilities

- authentication gate
- top-level navigation
- master feature switcher
- global settings access
- localization and theme context
- device-responsive layout behavior

### Master Feature Switcher

The product must provide a master switcher that lets the user move between:

- Endurance and Capability
- Nutrition and Meal Planning

Rules:

- switching features changes active workspace only
- switching features must not log the user out
- switching features must not reset feature data
- switching features must work on both mobile and desktop
- if only one feature is enabled, the switcher may be hidden or disabled

## 5. Shared Frontend Architecture

### Recommended Structure

```text
/apps/web
  /app
    /(shell)
    /(feature-endurance)
    /(feature-nutrition)
  /components
  /lib
/packages
  /ui
  /shared
  /config
  /datasets
```

### Shared Frontend Modules

- app shell and navigation
- auth client
- settings client
- feature registry
- shared chart and form components
- localization layer
- currency formatting helpers
- AI chat surface

### Feature Frontend Modules

#### Endurance Module

- dashboard
- timeline
- capability
- logging
- integrations

#### Nutrition Module

- planner
- shopping
- cooking
- nutrition summary
- localization-aware settings

## 6. Shared Backend Architecture

### Recommended Structure

```text
/apps/api
  /app
    /core
    /api
    /features
      /endurance
      /nutrition
      /shared
```

### Shared Backend Modules

- auth
- app preferences
- feature registry
- localization and currency defaults
- Ollama client and AI routing
- optional Groq configuration stored locally on-device
- shared user profile service
- export service
- shared health metrics contracts

### Feature Backend Modules

#### Endurance

- integrations
- normalization
- capability scoring
- recovery logic
- insights

#### Nutrition

- onboarding
- nutrition targets
- optimizer
- shopping generation
- substitutions
- localization-aware cost handling

## 7. Shared Data Contracts

Some data should be reusable across features and defined once.

### Shared Contract Principles

- define shared fields once in common schemas
- do not duplicate the same concept with slightly different names
- feature modules consume shared contracts instead of inventing local variants

### Shared Health Fields

- hydration
- body weight
- activity level
- basic user profile data
- locale
- market
- currency preference
- language preference

### Contract Rules

- shared contracts live in `/packages/shared`
- backend and frontend both consume the same typed schema definitions
- feature-specific extensions should be additive, not conflicting

## 8. Shared Data Model

The database should support both shared entities and feature-specific entities.

### Shared Entities

- `user`
- `user_profile`
- `app_preference`
- `feature_flag`
- `currency_preference`
- `language_preference`
- `location_profile`
- `chat_session`
- `chat_message`

### Endurance Entities

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

### Nutrition Entities

- `market_profile`
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

## 9. Feature Toggle Model

Feature toggles should be lightweight and product-facing.

### Required Behavior

- system knows which features exist
- system knows which features are enabled
- system stores active feature for current user
- shell shows only enabled features

### Suggested Shared Fields

#### app_preference

- `active_feature`
- `enabled_feature_flags`
- `preferred_platform_density`
- `shared_locale`

### MVP Default

- both Feature 1 and Feature 2 can be enabled
- either feature can be disabled for simpler rollout or testing

## 10. Shared API Surface

The backend should expose a small set of shared endpoints for shell-level behavior.

### Shared Endpoints

- `POST /api/v1/auth/login`
- `GET /api/v1/me`
- `GET /api/v1/app/features`
- `PUT /api/v1/app/preferences`
- `GET /api/v1/settings/profile`
- `PUT /api/v1/settings/profile`
- `GET /api/v1/settings/localization`
- `PUT /api/v1/settings/localization`

### Feature Endpoints

Feature-specific endpoints remain defined in their own PRDs.

## 11. Shared AI Architecture

Both features use Ollama, but AI behavior must remain feature-aware.

### Shared AI Layer Responsibilities

- Ollama configuration
- optional Groq configuration
- model selection
- prompt routing
- safety and grounding rules
- chat session storage
- token-budget policy and context-thinning rules for low-cost local inference

### Feature Routing Rules

- endurance prompts should primarily use endurance metrics
- nutrition prompts should primarily use nutrition plan and cost data
- cross-feature data should only be injected intentionally
- deterministic calculations must happen before LLM explanation

## 12. Mobile and Desktop Strategy

Both features already require mobile and desktop support. The master architecture should define how that is enforced consistently.

### Shared Responsive Rules

- one responsive shell for all features
- shared breakpoint strategy
- shared navigation behavior
- no feature may hide critical functionality on one device class
- desktop and phone packaging must preserve the same local-first privacy guarantees

### Mobile Priorities

- quick switching between features
- fast summary views
- touch-friendly forms and actions

### Desktop Priorities

- richer analysis
- wider tables and charts
- persistent cross-feature navigation

## 13. Localization and Market Layer

Localization should be shared infrastructure, even though the nutrition module is the main consumer right now.

### Shared Localization Responsibilities

- active language
- market selection
- currency formatting
- locale-aware number formatting

### MVP Market Rules

- Europe
- China
- India
- United Kingdom
- United States

### MVP Language Rules

- Europe: English, French, German
- China: Chinese
- India: English
- United Kingdom: English
- United States: English

## 14. Shared Repository Structure

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
  master-product-architecture.md
  prd-feature-1-endurance-capability.md
  prd-feature-2-nutrition-cooking-cost.md
```

## 15. Build Sequence

Recommended top-down implementation order:

1. Create shared monorepo structure
2. Implement backend core, auth, and app preferences
3. Implement frontend shell and master feature switcher
4. Add shared localization and currency infrastructure
5. Add shared local AI runtime, Ollama client, prompt guardrails, and token-budget routing
6. Build Feature 1 module
7. Build Feature 2 module
8. Add cross-feature shared field reuse for hydration and weight
9. Add export and shared chat improvements

## 16. Testing Strategy

### Shared Tests

- auth flow tests
- feature switcher tests
- app preference persistence tests
- localization and currency formatting tests
- responsive shell tests for mobile and desktop
- shared schema compatibility tests
- local AI settings tests for provider validation and device-only mode

### Cross-Feature Tests

- hydration field consistency across both features
- body weight field consistency across both features
- active feature persistence across sessions
- disabled-feature behavior

## 17. Risks

- building both features too independently and creating duplicated logic
- unclear shared contracts causing schema drift
- overengineering shared abstractions too early
- mobile shell complexity if each feature uses unrelated navigation patterns

## 18. Coding Agent Handoff

This document is the top-level architecture contract.

Implementation agent should:

- treat this document as the shared source of truth above both PRDs
- implement one shell-first Atlas app
- keep feature boundaries clean
- keep shared contracts centralized
- preserve mobile and desktop parity from the start
- ensure the master feature switcher exists before feature-level polish
- treat Atlas as a self-contained local app that can later be packaged for desktop and phone distribution without a mandatory centralized API layer

## 19. Relationship to PRDs

This document defines shared product architecture.

Feature-specific scope remains in:

- [prd-feature-1-endurance-capability.md](./prd-feature-1-endurance-capability.md)
- [prd-feature-2-nutrition-cooking-cost.md](./prd-feature-2-nutrition-cooking-cost.md)

If a feature PRD conflicts with this document on shared shell, shared settings, shared auth, feature switching, or shared contracts, this master architecture document should win for those shared concerns.
