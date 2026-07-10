from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.middleware import RequestIdLoggingMiddleware


def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    )
    application.add_middleware(RequestIdLoggingMiddleware)
    application.include_router(api_router, prefix=settings.api_v1_prefix)
    return application


app = create_app()
