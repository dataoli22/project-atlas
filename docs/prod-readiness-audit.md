# Project Atlas Prod Readiness Audit (archived summary)

Last updated: July 10, 2026

This was the original comprehensive production-readiness audit (761 lines). It has been
**superseded** by `docs/production-todo.md` (the live tracker) and four dedicated docs that now
carry the detail this file used to duplicate:

- `docs/packaging-and-installation.md` — desktop/Android/iOS packaging, install flows, release gates
- `docs/ollama-on-device-and-agents.md` — AI runtime wiring, provider fallback, agent integration
- `docs/nutrition-endurance-feature-spec.md` — nutrition refresh/calendar/prep-hacks, endurance support links
- `docs/mobile-architecture.md` — companion-mode mobile app, pairing, Android/iOS status

Full original text remains in git history (`git log -- docs/prod-readiness-audit.md`) if the
original framing or long-form gap analysis is ever needed. Kept here: the still-relevant
high-level framing that isn't duplicated elsewhere.

## Executive summary (original, still broadly accurate as framing)

Atlas is a local-first monorepo: `apps/web` (Next.js), `apps/api` (FastAPI), `packages/*` (shared
contracts), with local-first AI (Ollama default, optional cloud), replaceable integration
contracts (Strava, Health Connect, Samsung Health), and a real backend test suite.

## Definition of production ready for this repo

Atlas should be considered production-ready only when all of the following are true:

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

Current status against this bar: see `docs/production-todo.md` section 0.
