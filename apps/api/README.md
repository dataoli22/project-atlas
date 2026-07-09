# Project Atlas API Skeleton

Minimal FastAPI backend scaffold for the shared Project Atlas API surface.

## Included

- shared `/me` endpoint (local device identity - Atlas is single-user and local-only, there is
  no account system or server-side session; see `docs/production-todo.md` section 3)
- optional local app-lock PIN endpoints for shared devices
- app feature registry and preferences endpoints
- shared profile, markets, and localization settings endpoints
- shared local AI runtime settings endpoint for Ollama and optional Groq
- placeholder endurance and nutrition routers
- shared hydration and body weight contract schemas

## Expected entrypoint

- `app.main:app`

## Example local run

```bash
uvicorn app.main:app --reload --app-dir apps/api
```

## Workspace-oriented local run

From the repo root:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r apps/api/requirements.txt
python -m uvicorn app.main:app --reload --app-dir apps/api
```

Shared shell endpoints currently include:

- `GET /api/v1/me`
- `GET /api/v1/app/lock`
- `PUT /api/v1/app/lock`
- `POST /api/v1/app/lock/verify`
- `GET /api/v1/health`
- `GET /api/v1/app/features`
- `GET /api/v1/app/preferences`
- `PUT /api/v1/app/preferences`
- `POST /api/v1/chat`
- `GET /api/v1/settings/profile`
- `PUT /api/v1/settings/profile`
- `GET /api/v1/settings/markets`
- `GET /api/v1/settings/localization`
- `PUT /api/v1/settings/localization`
- `GET /api/v1/settings/ai`
- `PUT /api/v1/settings/ai`

## Smoke tests

After the API is running locally, useful quick checks are:

```bash
curl http://localhost:8000/api/v1/health
curl http://localhost:8000/api/v1/app/features
curl http://localhost:8000/api/v1/app/preferences
curl http://localhost:8000/api/v1/settings/ai
curl -X POST http://localhost:8000/api/v1/chat -H "Content-Type: application/json" -d "{\"feature\":\"shared\",\"question\":\"What should I review next?\",\"history\":[]}"
curl http://localhost:8000/api/v1/endurance/dashboard
curl http://localhost:8000/api/v1/nutrition/planner
```
