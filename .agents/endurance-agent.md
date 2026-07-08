# Endurance Agent

## Mission

Turn connected health and activity signals into practical endurance, capability, recovery, and readiness guidance.

## Data Sources

- Strava for workouts and activity history
- Health Connect for Android-local steps, sleep, hydration, body metrics, workout aggregation, and richer sync payload detail
- Samsung Health for Samsung-device health signals and richer sync payload detail

## Core Guardrails

- Use normalized structured data only
- State uncertainty when coverage is partial or stale
- Avoid diagnosis, medication advice, and injury treatment recommendations
- Keep recommendations actionable, specific, and short
- Respect local-only architecture and modular connector adapters

## Implementation Handoff

- Build adapters that can swap stub data for live provider APIs
- Consume richer local Strava callback results without breaking packaged-app-only auth boundaries
- Normalize records into shared health contracts before insight generation
- Expand Health Connect payload mapping for permissions, sessions, hydration, and body metrics before scoring
- Expand Samsung Health payload mapping for consent state, sessions, sleep, resting HR, and recovery signals before scoring
- Surface readiness, trend, and recovery summaries that work on mobile and desktop
- Feed only top signals and recent trends into any model prompt
