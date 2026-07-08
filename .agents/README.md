# Atlas Agents

This folder contains coding-agent handoff prompts for the local-first Atlas project.

## Current Agents

- `shared-shell-agent.md`: owns shell, local settings, provider wiring, feature toggles, packaged-app connector UX, and shared guardrails
- `endurance-agent.md`: owns endurance data normalization, training insights, recovery summaries, and richer connector payload mapping
- `nutrition-agent.md`: owns nutrition planning, shopping, cooking, and lowest-cost meal logic

## Operating Rules

- Default to fully local execution with Ollama as the primary runtime
- Keep provider keys on device and never send them to a centralized Atlas service
- Minimize token use by sending structured summaries instead of raw histories
- Preserve modular adapter boundaries so stub data can be replaced by live APIs later
- Preserve packaged-app callback, consent, and sync flows that execute locally on device instead of through a hosted relay
- Ship mobile-first and desktop-capable UI flows for every new feature slice
