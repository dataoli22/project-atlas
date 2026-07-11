import os
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.features.shared.schemas.app import (
    AppLockSettings,
    AppLockUpdateRequest,
    AppLockVerifyRequest,
    AppLockVerifyResponse,
    AppPreferences,
    AppPreferencesUpdate,
    DependencyCheck,
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


@router.post("/app/onboarding/complete", response_model=AppPreferences)
def complete_onboarding() -> AppPreferences:
    return shared_state.mark_onboarding_complete()


@router.get("/app/lock", response_model=AppLockSettings)
def read_app_lock() -> AppLockSettings:
    return shared_state.get_app_lock_settings()


@router.put("/app/lock", response_model=AppLockSettings)
def update_app_lock(payload: AppLockUpdateRequest) -> AppLockSettings:
    try:
        return shared_state.update_app_lock(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/app/lock/verify", response_model=AppLockVerifyResponse)
def verify_app_lock(payload: AppLockVerifyRequest) -> AppLockVerifyResponse:
    return AppLockVerifyResponse(unlocked=shared_state.verify_app_lock_pin(payload.pin))


@router.get("/health", response_model=HealthCheckResponse)
def read_healthcheck() -> HealthCheckResponse:
    """Real dependency health, not just "the process is up".

    Checks the actual SQLite connection (a live query, not just a non-null object) and that the
    configured local state directory is writable - the two things that can silently break a
    local-first single-user install (a locked/corrupted db file, a read-only data directory after
    an OS permission change) while the process itself keeps running and looking healthy.
    """
    settings = get_settings()
    preferences = shared_state.get_preferences()

    db_ok, db_detail = shared_state.check_database_health()
    checks = [DependencyCheck(name="database", ok=db_ok, detail=db_detail)]

    state_dir = Path(settings.local_state_path).parent
    state_dir_ok = os.access(state_dir, os.W_OK) if state_dir.exists() else False
    checks.append(
        DependencyCheck(
            name="local_state_directory",
            ok=state_dir_ok,
            detail=(
                f"{state_dir} is writable."
                if state_dir_ok
                else f"{state_dir} does not exist or is not writable."
            ),
        )
    )

    return HealthCheckResponse(
        status="ok" if all(check.ok for check in checks) else "degraded",
        app_name=settings.app_name,
        version=settings.app_version,
        active_feature=preferences.active_feature,
        enabled_features=get_enabled_feature_keys(),
        checks=checks,
    )
