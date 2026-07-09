# Project Atlas

Shared application workspace for:

- Endurance and Capability
- Nutrition and Meal Planning

Atlas is being built as a local-first, self-contained open-source project. The intended distribution model is a user-run desktop or phone package with local services, not a centralized cloud website with mandatory hosted APIs.

Architecture and product requirements live in:

- `docs/master-product-architecture.md`
- `docs/prd-feature-1-endurance-capability.md`
- `docs/prd-feature-2-nutrition-cooking-cost.md`
- `docs/execution-tracker.md`
- `docs/local-packaging-and-security.md`
- `docs/prod-readiness-audit.md`
- `docs/production-todo.md` — master production backlog with agent handoff
- `docs/packaging-and-installation.md` — dev install, desktop/Android packaging, release gates
- `docs/ollama-on-device-and-agents.md` — on-device AI wiring and agent integration
- `docs/nutrition-endurance-feature-spec.md` — refresh, calendar, prep hacks, videos, support links

## Current workspace shape

- `apps/web`: shared Next.js shell and feature routes
- `apps/api`: shared FastAPI backend scaffold
- `packages/shared`: shared feature and app contracts
- `packages/config`: shared market, currency, and app defaults
- `packages/ui`: shared UI package placeholder

## AI runtime posture

- Atlas prefers a cloud provider once configured (Groq's free tier, or Ollama pointed at a
  cloud/hosted endpoint with an API key) for speed and capability, and automatically falls back
  to on-device Ollama if that call fails. A fresh install with no keys still runs fully on
  on-device Ollama by default.
- AI keys and prompts always route directly from this device to the configured provider — never
  through an Atlas-hosted relay, regardless of whether that provider is local or cloud.
- `local_only_mode` is available as an opt-in hard guarantee that forces Ollama and blocks Groq,
  for users who want inference to never leave the device.
- Agent prompts should stay comprehensive in guardrails but lean in token use.
- See `docs/ollama-on-device-and-agents.md` for the full wiring and the provider fallback chain.

## Local development notes

Frontend dependencies have not been installed yet. Backend dependencies have also not been installed yet.

Expected next local commands once you want to run the scaffold:

```bash
npm install
npm run dev:web
```

For the backend:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r apps/api/requirements.txt
python -m uvicorn app.main:app --reload --app-dir apps/api
```

Useful smoke tests once the backend is running:

```bash
curl http://localhost:8000/api/v1/health
curl http://localhost:8000/api/v1/app/features
curl http://localhost:8000/api/v1/settings/ai
curl -X POST http://localhost:8000/api/v1/chat -H "Content-Type: application/json" -d "{\"feature\":\"shared\",\"question\":\"What should I review next?\",\"history\":[]}"
curl http://localhost:8000/api/v1/endurance/dashboard
curl http://localhost:8000/api/v1/nutrition/planner
```
