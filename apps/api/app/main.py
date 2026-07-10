import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

from app.api.router import api_router
from app.core.config import get_settings, validate_startup_config
from app.core.logging import configure_logging
from app.core.middleware import RequestIdLoggingMiddleware
from app.core.scheduler import run_periodic_maintenance

# Every HTTPException raised across the API uses FastAPI's default {"detail": "<message>"} body
# (see api/deps.py and the feature routers) - this schema documents that shape once instead of
# re-declaring `responses={...}` on ~40 individual routes, and gives any OpenAPI-driven client
# generator (a future typed desktop/mobile client, say) a real error contract instead of only
# ever seeing the 200 case.
_ERROR_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {"detail": {"type": "string"}},
    "required": ["detail"],
}


def _build_custom_openapi(application: FastAPI):
    def custom_openapi() -> dict:
        if application.openapi_schema:
            return application.openapi_schema

        schema = get_openapi(
            title=application.title,
            version=application.version,
            routes=application.routes,
        )
        schema.setdefault("components", {}).setdefault("schemas", {})["ErrorDetail"] = (
            _ERROR_RESPONSE_SCHEMA
        )
        for path_item in schema.get("paths", {}).values():
            for operation in path_item.values():
                if not isinstance(operation, dict):
                    continue
                operation.setdefault("responses", {})["default"] = {
                    "description": (
                        "Error response. Atlas's error bodies are always "
                        '{"detail": "<human-readable message>"} - see ErrorDetail.'
                    ),
                    "content": {
                        "application/json": {"schema": {"$ref": "#/components/schemas/ErrorDetail"}}
                    },
                }

        application.openapi_schema = schema
        return application.openapi_schema

    return custom_openapi


def _background_maintenance_disabled() -> bool:
    # The periodic maintenance loop has no place to run inside pytest's request/response cycle
    # (TestClient's startup/shutdown fire per-fixture, so a real background task would leak
    # across tests) - same PYTEST_CURRENT_TEST gate the persistence layer already uses.
    return "PYTEST_CURRENT_TEST" in os.environ


@asynccontextmanager
async def _lifespan(application: FastAPI):
    validate_startup_config(get_settings())

    stop_event = asyncio.Event()
    task: asyncio.Task | None = None
    if not _background_maintenance_disabled():
        task = asyncio.create_task(run_periodic_maintenance(stop_event=stop_event))

    yield

    if task is not None:
        stop_event.set()
        await task


def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        openapi_url=f"{settings.api_v1_prefix}/openapi.json",
        lifespan=_lifespan,
    )
    application.add_middleware(RequestIdLoggingMiddleware)
    application.include_router(api_router, prefix=settings.api_v1_prefix)
    application.openapi = _build_custom_openapi(application)
    return application


app = create_app()
