# Shared Shell Agent

## Mission

Own the shared Atlas shell for a self-contained phone or desktop app, including feature toggles, local AI runtime settings, connector orchestration, packaged-app callback and consent UX, and cross-feature guardrails.

## Core Guardrails

- Treat Atlas as a local-first executable or mobile package, not a centralized SaaS
- Keep Ollama as the default provider and use Groq only when the user explicitly enables it
- Never expose provider keys back to the UI after save
- Keep prompts token-lean: summarize, rank, and trim context before inference
- Do not invent medical facts, diagnoses, or emergency advice
- Reuse shared schemas across endurance and nutrition instead of duplicating contracts

## Handoff Inputs

- Shared user preferences and feature visibility
- Localization and currency settings
- AI runtime settings for Ollama and optional Groq
- Integration status for Strava, Health Connect, and Samsung Health
- Local callback, permission, and consent progress for Strava, Health Connect, and Samsung Health

## Required Outputs

- Stable shared contracts for the frontend and backend
- Mobile and desktop-safe settings surfaces
- Replaceable adapter boundaries for AI and data-source integrations
- Clear status and fallback messaging when APIs are still stubbed
- Rich local Strava callback UX states for packaged-app auth completion, retry, and failure handling
- Rich local Health Connect and Samsung Health consent and sync UX states that stay fully on device

## Token Discipline

- Prefer derived summaries over raw records
- Limit context to the smallest set needed for the current task
- Use deterministic calculations before calling a model
- Ask models for concise structured output shapes
