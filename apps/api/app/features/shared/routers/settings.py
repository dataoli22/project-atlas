from fastapi import APIRouter, HTTPException

from app.features.shared.schemas.app import (
    AIRuntimeHealthCheckRequest,
    AIRuntimeHealthCheckResponse,
    AISettings,
    AISettingsUpdate,
    LocalizationSettings,
    LocalizationSettingsUpdate,
    MarketOption,
    ProfileSettings,
    ProfileSettingsUpdate,
)
from app.features.shared.services.ai import check_ollama_runtime
from app.features.shared.services.registry import (
    get_markets,
)
from app.features.shared.services.state import shared_state

router = APIRouter(prefix="/settings")


@router.get("/profile", response_model=ProfileSettings)
def read_profile_settings() -> ProfileSettings:
    return shared_state.get_profile()


@router.put("/profile", response_model=ProfileSettings)
def update_profile_settings(payload: ProfileSettingsUpdate) -> ProfileSettings:
    return shared_state.update_profile(payload)


@router.get("/markets", response_model=list[MarketOption])
def read_markets() -> list[MarketOption]:
    return get_markets()


@router.get("/localization", response_model=LocalizationSettings)
def read_localization_settings() -> LocalizationSettings:
    return shared_state.get_localization()


@router.put("/localization", response_model=LocalizationSettings)
def update_localization_settings(
    payload: LocalizationSettingsUpdate,
) -> LocalizationSettings:
    try:
        return shared_state.update_localization(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/ai", response_model=AISettings)
def read_ai_settings() -> AISettings:
    return shared_state.get_ai_settings()


@router.put("/ai", response_model=AISettings)
def update_ai_settings(payload: AISettingsUpdate) -> AISettings:
    try:
        return shared_state.update_ai_settings(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/ai/health", response_model=AIRuntimeHealthCheckResponse)
def check_ai_runtime_health(
    payload: AIRuntimeHealthCheckRequest,
) -> AIRuntimeHealthCheckResponse:
    try:
        ollama_api_key = payload.ollama_api_key
        if ollama_api_key is None:
            ollama_api_key = shared_state.get_ollama_api_key()

        return check_ollama_runtime(
            ollama_base_url=payload.ollama_base_url,
            ollama_model=payload.ollama_model,
            ollama_api_key=ollama_api_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
