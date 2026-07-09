from urllib.parse import parse_qs, urlparse

from fastapi import APIRouter, HTTPException

from app.features.shared.schemas.app import (
    HealthConnectDeviceSyncRequest,
    IntegrationConnectRequest,
    IntegrationConnectResponse,
    IntegrationDisconnectRequest,
    IntegrationSourceKey,
    IntegrationSourceStatus,
    SamsungHealthDeviceSyncRequest,
    StravaCallbackRequest,
    StravaCallbackResponse,
    StravaTokenExchangeResponse,
)
from app.features.shared.services.integrations import get_integration_adapter
from app.features.shared.services.state import shared_state

router = APIRouter(prefix="/integrations")


@router.get("", response_model=list[IntegrationSourceStatus])
def read_integrations() -> list[IntegrationSourceStatus]:
    return shared_state.get_integrations()


@router.post("/strava/callback", response_model=StravaCallbackResponse)
def complete_strava_callback(payload: StravaCallbackRequest) -> StravaCallbackResponse:
    try:
        code, state, scope = _resolve_strava_callback_payload(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        integration = shared_state.complete_strava_callback(
            code=code,
            state=state,
            scope=scope,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return StravaCallbackResponse(
        integration=integration,
        token_exchange_ready=True,
        token_exchange_status="authorization-code-captured",
        local_only_notice=(
            "Atlas captured the Strava authorization code locally. The next implementation step is exchanging it for "
            "tokens inside the same device-owned runtime."
        ),
    )


@router.post("/strava/token-exchange", response_model=StravaTokenExchangeResponse)
def exchange_strava_tokens() -> StravaTokenExchangeResponse:
    try:
        result = get_integration_adapter("strava").exchange_tokens()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    runtime = shared_state.get_integration_runtime_snapshot()["strava"]
    return StravaTokenExchangeResponse(
        integration=result.integration,
        token_exchange_status="token-ready",
        access_token_set=bool(runtime.get("access_token_set")),
        refresh_token_set=bool(runtime.get("refresh_token_set")),
        expires_at=runtime.get("expires_at"),
        athlete_id=runtime.get("athlete_id"),
        local_only_notice=result.local_only_notice,
    )


@router.post("/health_connect/device-sync", response_model=IntegrationConnectResponse)
def sync_health_connect_device_records(payload: HealthConnectDeviceSyncRequest) -> IntegrationConnectResponse:
    integration = shared_state.store_health_connect_sync(
        recent_sessions=[
            session.model_dump(mode="json")
            for session in payload.recent_sessions
        ],
        hydration_ml=payload.hydration_ml,
        body_weight_kg=payload.body_weight_kg,
        step_count=payload.step_count,
        active_energy_kcal=payload.active_energy_kcal,
        bridge_source=payload.bridge_source,
        device_label=payload.device_label,
    )
    return IntegrationConnectResponse(
        integration=integration,
        launch_url=None,
        local_only_notice=(
            "Health Connect records were imported into the local Atlas runtime through the packaged-app SDK bridge. "
            "Google Fit history should arrive through Health Connect because new Google Fit API access is deprecated."
        ),
    )


@router.post("/samsung_health/device-sync", response_model=IntegrationConnectResponse)
def sync_samsung_health_device_records(payload: SamsungHealthDeviceSyncRequest) -> IntegrationConnectResponse:
    integration = shared_state.store_samsung_health_sync(
        recent_sessions=[
            session.model_dump(mode="json")
            for session in payload.recent_sessions
        ],
        sleep_hours=payload.sleep_hours,
        resting_hr=payload.resting_hr,
        energy_score=payload.energy_score,
        stress_level=payload.stress_level,
        bridge_source=payload.bridge_source,
        device_label=payload.device_label,
    )
    return IntegrationConnectResponse(
        integration=integration,
        launch_url=None,
        local_only_notice=(
            "Samsung Health records were imported into the local Atlas runtime through the packaged-app SDK bridge."
        ),
    )


def _resolve_strava_callback_payload(payload: StravaCallbackRequest) -> tuple[str, str, str | None]:
    code = (payload.code or "").strip()
    state = (payload.state or "").strip()
    scope = (payload.scope or "").strip() or None

    if payload.callback_url:
        parsed = urlparse(payload.callback_url.strip())
        query = parse_qs(parsed.query)
        if query.get("error"):
            raise ValueError("Strava returned an OAuth error to the local callback URL.")
        code = code or _first_query_value(query, "code")
        state = state or _first_query_value(query, "state")
        scope = scope or _first_query_value(query, "scope")

    if not code or not state:
        raise ValueError("Provide a Strava callback URL or both the authorization code and OAuth state.")

    return code, state, scope


def _first_query_value(query: dict[str, list[str]], key: str) -> str | None:
    values = query.get(key) or []
    if not values:
        return None
    value = values[0].strip()
    return value or None


@router.post("/{source}/connect", response_model=IntegrationConnectResponse)
def connect_integration(
    source: IntegrationSourceKey,
    payload: IntegrationConnectRequest,
) -> IntegrationConnectResponse:
    result = get_integration_adapter(source).connect(
        account_label=payload.account_label,
        login_identifier=payload.login_identifier,
    )
    return IntegrationConnectResponse(
        integration=result.integration,
        launch_url=result.launch_url,
        local_only_notice=result.local_only_notice,
    )


@router.post("/{source}/disconnect", response_model=IntegrationConnectResponse)
def disconnect_integration(
    source: IntegrationSourceKey,
    payload: IntegrationDisconnectRequest | None = None,
) -> IntegrationConnectResponse:
    if payload is None or not payload.confirm:
        raise HTTPException(
            status_code=400,
            detail="Disconnecting an integration is destructive. Resend with {\"confirm\": true} to proceed.",
        )

    result = get_integration_adapter(source).disconnect()
    return IntegrationConnectResponse(
        integration=result.integration,
        launch_url=result.launch_url,
        local_only_notice=result.local_only_notice,
    )


@router.post("/{source}/sync", response_model=IntegrationConnectResponse)
def sync_integration(source: IntegrationSourceKey) -> IntegrationConnectResponse:
    try:
        result = get_integration_adapter(source).sync()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return IntegrationConnectResponse(
        integration=result.integration,
        launch_url=result.launch_url,
        local_only_notice=result.local_only_notice,
    )
