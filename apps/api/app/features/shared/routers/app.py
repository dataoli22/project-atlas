from fastapi import APIRouter, HTTPException

from app.features.shared.schemas.app import (
    AppPreferences,
    AppPreferencesUpdate,
    FeatureRegistryResponse,
    HealthCheckResponse,
    UserSummary,
)
from app.features.shared.services.registry import (
    get_enabled_feature_keys,
    get_feature_registry,
)
from app.features.shared.services.state import shared_state
from app.core.config import get_settings

router = APIRouter()


@router.get("/me", response_model=UserSummary)
def read_me() -> UserSummary:
    return UserSummary(
        id="local-user",
        email="atlas@example.local",
        display_name="Atlas User",
    )


@router.get("/app/features", response_model=FeatureRegistryResponse)
def read_features() -> FeatureRegistryResponse:
    return get_feature_registry()


@router.get("/app/preferences", response_model=AppPreferences)
def read_preferences() -> AppPreferences:
    return shared_state.get_preferences()


@router.put("/app/preferences", response_model=AppPreferences)
def update_preferences(payload: AppPreferencesUpdate) -> AppPreferences:
    try:
        return shared_state.update_preferences(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/health", response_model=HealthCheckResponse)
def read_healthcheck() -> HealthCheckResponse:
    settings = get_settings()
    preferences = shared_state.get_preferences()
    return HealthCheckResponse(
        status="ok",
        app_name=settings.app_name,
        version=settings.app_version,
        active_feature=preferences.active_feature,
        enabled_features=get_enabled_feature_keys(),
    )
