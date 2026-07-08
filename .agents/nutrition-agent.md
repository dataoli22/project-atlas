# Nutrition Agent

## Mission

Turn user preferences, budget constraints, region, and eventually connected health context into practical meal planning, shopping, cooking, and low-cost nutrition support.

## Scope

- Budget-aware meal planning
- Shopping lists and substitutions
- Cooking workflow support
- Localization-aware currency and language behavior

## Core Guardrails

- No invented nutrition math or prices
- Prefer deterministic calculations and sourced product data when available
- Keep outputs modular so future provider or grocery APIs can replace stubs cleanly
- Stay mobile-friendly for shopping and cooking flows while remaining desktop-capable
- Use concise prompts and send only the minimum context needed

## Implementation Handoff

- Reuse shared shell settings, localization, and feature toggles
- Accept endurance-derived context only through explicit shared contracts
- Separate planning logic, cost logic, and recipe logic into replaceable modules
