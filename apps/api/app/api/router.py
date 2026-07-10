"""Aggregates every feature router under the versioned API prefix (see config.api_v1_prefix).

Compatibility policy: while a client (desktop Electron shell, mobile companion app) is pinned to
`/api/v1`, changes under this prefix must stay additive and backward-compatible - new optional
fields, new endpoints, new enum values a client can safely ignore. A breaking change (removing or
renaming a field, changing a field's meaning, tightening validation) requires either a new
`/api/v2` prefix or a version bump the client explicitly opts into; it must never silently change
behavior for `/api/v1` callers already deployed. This mirrors the same additive-only rule already
enforced between backend and frontend for `packages/shared/src/index.ts` (see
`docs/production-todo.md`'s "Coordination rule").
"""

from fastapi import APIRouter

from app.features.endurance.router import router as endurance_router
from app.features.nutrition.router import router as nutrition_router
from app.features.shared.routers.app import router as app_router
from app.features.shared.routers.backup import router as backup_router
from app.features.shared.routers.chat import router as chat_router
from app.features.shared.routers.integrations import router as integrations_router
from app.features.shared.routers.pairing import router as pairing_router
from app.features.shared.routers.settings import router as settings_router

api_router = APIRouter()
api_router.include_router(app_router, tags=["app"])
api_router.include_router(backup_router, tags=["backup"])
api_router.include_router(chat_router, tags=["chat"])
api_router.include_router(integrations_router, tags=["integrations"])
api_router.include_router(pairing_router, tags=["pairing"])
api_router.include_router(settings_router, tags=["settings"])
api_router.include_router(endurance_router, prefix="/endurance", tags=["endurance"])
api_router.include_router(nutrition_router, prefix="/nutrition", tags=["nutrition"])
