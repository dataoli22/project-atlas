def test_read_integrations_returns_all_supported_sources(client):
    response = client.get("/api/v1/integrations")

    assert response.status_code == 200
    payload = response.json()

    assert [item["key"] for item in payload] == [
        "strava",
        "health_connect",
        "samsung_health",
    ]
    assert payload[0]["connect_mode"] == "oauth"
    assert payload[1]["connect_mode"] == "device-permission"
    assert payload[2]["connect_mode"] == "sdk-consent"
    assert payload[0]["runtime_summary"]["token_ready"] is False


def test_connecting_strava_returns_stub_oauth_launch_contract(client):
    response = client.post(
        "/api/v1/integrations/strava/connect",
        json={
            "account_label": "Road training",
            "login_identifier": "runner@example.com",
        },
    )

    assert response.status_code == 200
    payload = response.json()

    assert payload["integration"]["connected"] is True
    assert payload["integration"]["status"] == "oauth-ready"
    assert payload["integration"]["account_label"] == "Road training"
    assert "developers.strava.com" in payload["launch_url"]


def test_connecting_strava_uses_oauth_authorize_url_when_configured(client, monkeypatch):
    monkeypatch.setenv("ATLAS_STRAVA_CLIENT_ID", "12345")
    monkeypatch.setenv(
        "ATLAS_STRAVA_REDIRECT_URI",
        "http://localhost:8000/api/v1/integrations/strava/callback",
    )
    from app.core.config import get_settings

    get_settings.cache_clear()
    try:
        response = client.post(
            "/api/v1/integrations/strava/connect",
            json={"login_identifier": "runner@example.com"},
        )
    finally:
        get_settings.cache_clear()

    assert response.status_code == 200
    payload = response.json()
    assert "www.strava.com/oauth/authorize" in payload["launch_url"]
    assert "client_id=12345" in payload["launch_url"]
    assert "state=" in payload["launch_url"]


def test_strava_callback_marks_code_as_ready_for_token_exchange(client, monkeypatch):
    monkeypatch.setenv("ATLAS_STRAVA_CLIENT_ID", "12345")
    monkeypatch.setenv(
        "ATLAS_STRAVA_REDIRECT_URI",
        "http://localhost:8000/api/v1/integrations/strava/callback",
    )
    from app.core.config import get_settings

    get_settings.cache_clear()
    try:
        connect_response = client.post(
            "/api/v1/integrations/strava/connect",
            json={"account_label": "Runner"},
        )
        launch_url = connect_response.json()["launch_url"]
        state_value = launch_url.split("state=")[1].split("&")[0]

        callback_response = client.post(
            "/api/v1/integrations/strava/callback",
            json={
                "code": "temporary-auth-code",
                "state": state_value,
                "scope": "read,activity:read_all",
            },
        )
    finally:
        get_settings.cache_clear()

    assert callback_response.status_code == 200
    payload = callback_response.json()
    assert payload["token_exchange_ready"] is True
    assert payload["token_exchange_status"] == "authorization-code-captured"
    assert payload["integration"]["status"] == "oauth-code-received"


def test_strava_callback_accepts_full_callback_url_contract(client, monkeypatch):
    monkeypatch.setenv("ATLAS_STRAVA_CLIENT_ID", "12345")
    monkeypatch.setenv(
        "ATLAS_STRAVA_REDIRECT_URI",
        "http://localhost:8000/api/v1/integrations/strava/callback",
    )
    from app.core.config import get_settings

    get_settings.cache_clear()
    try:
        connect_response = client.post(
            "/api/v1/integrations/strava/connect",
            json={"account_label": "Runner"},
        )
        launch_url = connect_response.json()["launch_url"]
        state_value = launch_url.split("state=")[1].split("&")[0]

        callback_response = client.post(
            "/api/v1/integrations/strava/callback",
            json={
                "callback_url": (
                    "atlas://strava/callback"
                    f"?code=temporary-auth-code&state={state_value}&scope=read,activity:read_all"
                )
            },
        )
    finally:
        get_settings.cache_clear()

    assert callback_response.status_code == 200
    payload = callback_response.json()
    assert payload["token_exchange_ready"] is True
    assert payload["token_exchange_status"] == "authorization-code-captured"
    assert payload["integration"]["status"] == "oauth-code-received"
    assert payload["integration"]["runtime_summary"]["token_exchange_ready"] is True


def test_strava_token_exchange_updates_local_runtime_state(client, monkeypatch):
    monkeypatch.setenv("ATLAS_STRAVA_CLIENT_ID", "12345")
    monkeypatch.setenv("ATLAS_STRAVA_CLIENT_SECRET", "secret-xyz")
    monkeypatch.setenv(
        "ATLAS_STRAVA_REDIRECT_URI",
        "http://localhost:8000/api/v1/integrations/strava/callback",
    )
    from app.core.config import get_settings
    from app.features.shared.services import integrations as integrations_service
    from app.features.shared.services.provider_clients import StravaTokenExchangeResult

    class SuccessfulStravaOAuthClient:
        def __init__(self, *, client_id: str, client_secret: str) -> None:
            assert client_id == "12345"
            assert client_secret == "secret-xyz"

        def exchange_code_for_tokens(self, *, code: str) -> StravaTokenExchangeResult:
            assert code == "temporary-auth-code"
            return StravaTokenExchangeResult(
                access_token="access-123",
                refresh_token="refresh-456",
                expires_at=1893456000,
                athlete_id="789",
            )

    monkeypatch.setattr(
        integrations_service,
        "StravaOAuthClient",
        SuccessfulStravaOAuthClient,
    )

    get_settings.cache_clear()
    try:
        connect_response = client.post(
            "/api/v1/integrations/strava/connect",
            json={"account_label": "Runner"},
        )
        launch_url = connect_response.json()["launch_url"]
        state_value = launch_url.split("state=")[1].split("&")[0]

        client.post(
            "/api/v1/integrations/strava/callback",
            json={
                "code": "temporary-auth-code",
                "state": state_value,
                "scope": "read,activity:read_all",
            },
        )

        exchange_response = client.post("/api/v1/integrations/strava/token-exchange")
    finally:
        get_settings.cache_clear()

    assert exchange_response.status_code == 200
    payload = exchange_response.json()
    assert payload["token_exchange_status"] == "token-ready"
    assert payload["access_token_set"] is True
    assert payload["refresh_token_set"] is True
    assert payload["athlete_id"] == "789"
    assert payload["integration"]["status"] == "token-ready"


def _connect_and_exchange_strava_tokens(client, monkeypatch, *, deauthorize_client):
    monkeypatch.setenv("ATLAS_STRAVA_CLIENT_ID", "12345")
    monkeypatch.setenv("ATLAS_STRAVA_CLIENT_SECRET", "secret-xyz")
    monkeypatch.setenv(
        "ATLAS_STRAVA_REDIRECT_URI",
        "http://localhost:8000/api/v1/integrations/strava/callback",
    )
    from app.core.config import get_settings
    from app.features.shared.services import integrations as integrations_service
    from app.features.shared.services.provider_clients import StravaTokenExchangeResult

    class ExchangeOnlyStravaOAuthClient:
        def __init__(self, *, client_id: str, client_secret: str) -> None:
            pass

        def exchange_code_for_tokens(self, *, code: str) -> StravaTokenExchangeResult:
            return StravaTokenExchangeResult(
                access_token="access-123",
                refresh_token="refresh-456",
                expires_at=1893456000,
                athlete_id="789",
            )

    monkeypatch.setattr(integrations_service, "StravaOAuthClient", ExchangeOnlyStravaOAuthClient)
    get_settings.cache_clear()

    connect_response = client.post("/api/v1/integrations/strava/connect", json={})
    launch_url = connect_response.json()["launch_url"]
    state_value = launch_url.split("state=")[1].split("&")[0]
    client.post(
        "/api/v1/integrations/strava/callback",
        json={"code": "temporary-auth-code", "state": state_value},
    )
    client.post("/api/v1/integrations/strava/token-exchange")

    # Swap in the deauthorize-tracking client only after token exchange, so disconnect() uses it.
    monkeypatch.setattr(integrations_service, "StravaOAuthClient", deauthorize_client)


def test_disconnecting_strava_revokes_access_server_side(client, monkeypatch):
    from app.core.config import get_settings

    calls = []

    class RevokingStravaOAuthClient:
        def __init__(self, *, client_id: str, client_secret: str) -> None:
            pass

        def deauthorize(self, *, access_token: str) -> None:
            calls.append(access_token)

    try:
        _connect_and_exchange_strava_tokens(client, monkeypatch, deauthorize_client=RevokingStravaOAuthClient)
        response = client.post("/api/v1/integrations/strava/disconnect", json={"confirm": True})
    finally:
        get_settings.cache_clear()

    assert response.status_code == 200
    assert calls == ["access-123"]
    assert "revoked server-side" in response.json()["local_only_notice"]
    assert response.json()["integration"]["connected"] is False


def test_disconnecting_strava_still_succeeds_locally_when_revocation_fails(client, monkeypatch):
    from urllib.error import URLError

    from app.core.config import get_settings

    class FailingDeauthorizeStravaOAuthClient:
        def __init__(self, *, client_id: str, client_secret: str) -> None:
            pass

        def deauthorize(self, *, access_token: str) -> None:
            raise URLError("network down")

    try:
        _connect_and_exchange_strava_tokens(
            client, monkeypatch, deauthorize_client=FailingDeauthorizeStravaOAuthClient
        )
        response = client.post("/api/v1/integrations/strava/disconnect", json={"confirm": True})
    finally:
        get_settings.cache_clear()

    assert response.status_code == 200
    assert response.json()["integration"]["connected"] is False
    assert "failed" in response.json()["local_only_notice"]


def test_disconnecting_strava_without_stored_tokens_skips_revocation_call(client):
    response = client.post("/api/v1/integrations/strava/disconnect", json={"confirm": True})

    assert response.status_code == 200
    assert "revoked server-side" not in response.json()["local_only_notice"]
    assert response.json()["integration"]["connected"] is False


def test_strava_live_sync_fetches_recent_activities(client, monkeypatch):
    monkeypatch.setenv("ATLAS_STRAVA_CLIENT_ID", "12345")
    monkeypatch.setenv("ATLAS_STRAVA_CLIENT_SECRET", "secret-xyz")
    monkeypatch.setenv(
        "ATLAS_STRAVA_REDIRECT_URI",
        "http://localhost:8000/api/v1/integrations/strava/callback",
    )
    from app.core.config import get_settings
    from app.features.shared.services import integrations as integrations_service
    from app.features.shared.services.provider_clients import (
        StravaAthleteProfile,
        StravaTokenExchangeResult,
        StravaActivity,
    )

    class SuccessfulStravaOAuthClient:
        def __init__(self, *, client_id: str, client_secret: str) -> None:
            assert client_id == "12345"
            assert client_secret == "secret-xyz"

        def exchange_code_for_tokens(self, *, code: str) -> StravaTokenExchangeResult:
            return StravaTokenExchangeResult(
                access_token="access-123",
                refresh_token="refresh-456",
                expires_at=1893456000,
                athlete_id="789",
            )

        def get_athlete_profile(self, *, access_token: str) -> StravaAthleteProfile:
            assert access_token == "access-123"
            return StravaAthleteProfile(
                athlete_id="789",
                username="atlas-runner",
                firstname="Atlas",
                lastname="Runner",
            )

        def list_recent_activities(self, *, access_token: str, per_page: int = 5) -> list[StravaActivity]:
            assert access_token == "access-123"
            assert per_page == 5
            return [
                StravaActivity(
                    activity_id="1",
                    name="Morning Run",
                    sport_type="Run",
                    moving_time_seconds=3600,
                    distance_meters=10000,
                    start_date="2026-07-08T06:00:00Z",
                ),
                StravaActivity(
                    activity_id="2",
                    name="Evening Ride",
                    sport_type="Ride",
                    moving_time_seconds=5400,
                    distance_meters=32000,
                    start_date="2026-07-07T18:00:00Z",
                ),
            ]

    monkeypatch.setattr(
        integrations_service,
        "StravaOAuthClient",
        SuccessfulStravaOAuthClient,
    )

    get_settings.cache_clear()
    try:
        launch_url = client.post("/api/v1/integrations/strava/connect", json={}).json()["launch_url"]
        state_value = launch_url.split("state=")[1].split("&")[0]
        client.post(
            "/api/v1/integrations/strava/callback",
            json={"code": "temporary-auth-code", "state": state_value},
        )
        client.post("/api/v1/integrations/strava/token-exchange")

        sync_response = client.post("/api/v1/integrations/strava/sync")
    finally:
        get_settings.cache_clear()

    assert sync_response.status_code == 200
    payload = sync_response.json()
    assert payload["integration"]["status"] == "sync-live"
    assert payload["integration"]["last_sync_at"] is not None


def test_strava_sync_refreshes_expired_token_before_fetch(client, monkeypatch):
    monkeypatch.setenv("ATLAS_STRAVA_CLIENT_ID", "12345")
    monkeypatch.setenv("ATLAS_STRAVA_CLIENT_SECRET", "secret-xyz")
    monkeypatch.setenv(
        "ATLAS_STRAVA_REDIRECT_URI",
        "http://localhost:8000/api/v1/integrations/strava/callback",
    )
    from app.core.config import get_settings
    from app.features.shared.services import integrations as integrations_service
    from app.features.shared.services.provider_clients import (
        StravaActivity,
        StravaAthleteProfile,
        StravaTokenExchangeResult,
    )
    from app.features.shared.services.state import shared_state

    class RefreshingStravaOAuthClient:
        def __init__(self, *, client_id: str, client_secret: str) -> None:
            pass

        def exchange_code_for_tokens(self, *, code: str) -> StravaTokenExchangeResult:
            return StravaTokenExchangeResult(
                access_token="expired-access",
                refresh_token="refresh-456",
                expires_at=1,
                athlete_id="789",
            )

        def refresh_access_token(self, *, refresh_token: str) -> StravaTokenExchangeResult:
            assert refresh_token == "refresh-456"
            return StravaTokenExchangeResult(
                access_token="fresh-access",
                refresh_token="refresh-789",
                expires_at=1893456000,
                athlete_id="789",
            )

        def get_athlete_profile(self, *, access_token: str) -> StravaAthleteProfile:
            assert access_token == "fresh-access"
            return StravaAthleteProfile(
                athlete_id="789",
                username="atlas-runner",
                firstname="Atlas",
                lastname="Runner",
            )

        def list_recent_activities(self, *, access_token: str, per_page: int = 5) -> list[StravaActivity]:
            assert access_token == "fresh-access"
            return [
                StravaActivity(
                    activity_id="1",
                    name="Morning Run",
                    sport_type="Run",
                    moving_time_seconds=3600,
                    distance_meters=10000,
                    start_date="2026-07-08T06:00:00Z",
                )
            ]

    monkeypatch.setattr(integrations_service, "StravaOAuthClient", RefreshingStravaOAuthClient)

    get_settings.cache_clear()
    try:
        launch_url = client.post("/api/v1/integrations/strava/connect", json={}).json()["launch_url"]
        state_value = launch_url.split("state=")[1].split("&")[0]
        client.post(
            "/api/v1/integrations/strava/callback",
            json={"code": "temporary-auth-code", "state": state_value},
        )
        client.post("/api/v1/integrations/strava/token-exchange")
        sync_response = client.post("/api/v1/integrations/strava/sync")
        runtime = shared_state.get_integration_runtime_snapshot()["strava"]
    finally:
        get_settings.cache_clear()

    assert sync_response.status_code == 200
    assert runtime["access_token"] == "fresh-access"
    assert runtime["refresh_token"] == "refresh-789"
    assert runtime["last_token_refresh_at"] is not None


def test_integrations_payload_exposes_strava_runtime_summary_after_sync(client, monkeypatch):
    monkeypatch.setenv("ATLAS_STRAVA_CLIENT_ID", "12345")
    monkeypatch.setenv("ATLAS_STRAVA_CLIENT_SECRET", "secret-xyz")
    monkeypatch.setenv(
        "ATLAS_STRAVA_REDIRECT_URI",
        "http://localhost:8000/api/v1/integrations/strava/callback",
    )
    from app.core.config import get_settings
    from app.features.shared.services import integrations as integrations_service
    from app.features.shared.services.provider_clients import (
        StravaActivity,
        StravaAthleteProfile,
        StravaTokenExchangeResult,
    )

    class SuccessfulStravaOAuthClient:
        def __init__(self, *, client_id: str, client_secret: str) -> None:
            pass

        def exchange_code_for_tokens(self, *, code: str) -> StravaTokenExchangeResult:
            return StravaTokenExchangeResult(
                access_token="access-123",
                refresh_token="refresh-456",
                expires_at=1893456000,
                athlete_id="789",
            )

        def get_athlete_profile(self, *, access_token: str) -> StravaAthleteProfile:
            return StravaAthleteProfile(
                athlete_id="789",
                username="atlas-runner",
                firstname="Atlas",
                lastname="Runner",
            )

        def list_recent_activities(self, *, access_token: str, per_page: int = 5) -> list[StravaActivity]:
            return [
                StravaActivity(
                    activity_id="1",
                    name="Morning Run",
                    sport_type="Run",
                    moving_time_seconds=3600,
                    distance_meters=10000,
                    start_date="2026-07-08T06:00:00Z",
                )
            ]

    monkeypatch.setattr(integrations_service, "StravaOAuthClient", SuccessfulStravaOAuthClient)

    get_settings.cache_clear()
    try:
        launch_url = client.post("/api/v1/integrations/strava/connect", json={}).json()["launch_url"]
        state_value = launch_url.split("state=")[1].split("&")[0]
        client.post("/api/v1/integrations/strava/callback", json={"code": "temporary-auth-code", "state": state_value})
        client.post("/api/v1/integrations/strava/token-exchange")
        client.post("/api/v1/integrations/strava/sync")
        integrations_response = client.get("/api/v1/integrations")
    finally:
        get_settings.cache_clear()

    assert integrations_response.status_code == 200
    strava_item = integrations_response.json()[0]
    assert strava_item["runtime_summary"]["token_ready"] is True
    assert strava_item["runtime_summary"]["athlete_name"] == "Atlas Runner"
    assert strava_item["runtime_summary"]["synced_activity_count"] == 1


def test_sync_requires_connected_integration(client):
    response = client.post("/api/v1/integrations/health_connect/sync")

    assert response.status_code == 400
    assert response.json()["detail"] == "Connect the integration before running a sync."


def test_connect_and_sync_health_connect_tracks_last_sync(client):
    connect_response = client.post(
        "/api/v1/integrations/health_connect/connect",
        json={"account_label": "Pixel 10 Pro"},
    )
    assert connect_response.status_code == 200

    sync_response = client.post("/api/v1/integrations/health_connect/sync")
    assert sync_response.status_code == 200

    payload = sync_response.json()
    assert payload["integration"]["connected"] is True
    assert payload["integration"]["status"] == "sync-live"
    assert payload["integration"]["last_sync_at"] is not None
    assert payload["integration"]["runtime_summary"]["permission_granted"] is True
    assert payload["integration"]["runtime_summary"]["connected_device_label"] == "Pixel 10 Pro"
    assert payload["integration"]["runtime_summary"]["last_permission_at"] is not None
    assert payload["integration"]["runtime_summary"]["synced_session_count"] == 2
    assert payload["integration"]["runtime_summary"]["hydration_ml"] == 2400
    assert payload["integration"]["runtime_summary"]["body_weight_kg"] == 69.8
    assert payload["integration"]["runtime_summary"]["step_count"] == 10840
    assert payload["integration"]["runtime_summary"]["active_energy_kcal"] == 684
    assert payload["integration"]["runtime_summary"]["sync_mode"] == "permissions-local-stub"


def test_health_connect_device_sync_imports_sdk_records(client):
    response = client.post(
        "/api/v1/integrations/health_connect/device-sync",
        json={
            "device_label": "Pixel Health Connect",
            "bridge_source": "google-fit-health-connect",
            "recent_sessions": [
                {
                    "session_label": "Imported Google Fit walk",
                    "session_type": "Walk",
                    "duration_minutes": 42,
                    "distance_km": 3.6,
                    "start_date": "2026-07-09T07:00:00Z",
                    "source": "google-fit-health-connect",
                }
            ],
            "hydration_ml": 2100,
            "body_weight_kg": 70.2,
            "step_count": 12450,
            "active_energy_kcal": 735,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    summary = payload["integration"]["runtime_summary"]

    assert payload["integration"]["status"] == "sync-live"
    assert payload["integration"]["account_label"] is None
    assert summary["permission_granted"] is True
    assert summary["connected_device_label"] == "Pixel Health Connect"
    assert summary["synced_session_count"] == 1
    assert summary["step_count"] == 12450
    assert summary["active_energy_kcal"] == 735
    assert summary["bridge_source"] == "google-fit-health-connect"
    assert summary["sync_mode"] == "device-sdk-bridge"


def test_samsung_health_connect_exposes_local_sdk_runtime_summary(client):
    connect_response = client.post(
        "/api/v1/integrations/samsung_health/connect",
        json={"account_label": "Galaxy Watch Ultra"},
    )

    assert connect_response.status_code == 200
    payload = connect_response.json()
    assert payload["integration"]["runtime_summary"]["consent_granted"] is True
    assert payload["integration"]["runtime_summary"]["connected_device_label"] == "Galaxy Watch Ultra"
    assert payload["integration"]["runtime_summary"]["last_consent_at"] is not None
    assert payload["integration"]["runtime_summary"]["supported_metric_count"] == 5

    sync_response = client.post("/api/v1/integrations/samsung_health/sync")
    assert sync_response.status_code == 200
    sync_payload = sync_response.json()
    assert sync_payload["integration"]["status"] == "sync-live"
    assert sync_payload["integration"]["runtime_summary"]["sync_mode"] == "sdk-local-stub"
    assert sync_payload["integration"]["runtime_summary"]["synced_session_count"] == 2
    assert sync_payload["integration"]["runtime_summary"]["sleep_hours"] == 7.4
    assert sync_payload["integration"]["runtime_summary"]["resting_hr"] == 52
    assert sync_payload["integration"]["runtime_summary"]["energy_score"] == 82
    assert sync_payload["integration"]["runtime_summary"]["stress_level"] == "Low"


def test_samsung_health_device_sync_imports_sdk_records(client):
    response = client.post(
        "/api/v1/integrations/samsung_health/device-sync",
        json={
            "device_label": "Galaxy Watch Ultra",
            "bridge_source": "samsung-health-sdk",
            "recent_sessions": [
                {
                    "session_label": "Samsung imported run",
                    "session_type": "Run",
                    "duration_minutes": 38,
                    "distance_km": 6.2,
                    "start_date": "2026-07-09T06:15:00Z",
                    "source": "samsung-health-sdk",
                }
            ],
            "sleep_hours": 7.8,
            "resting_hr": 49,
            "energy_score": 88,
            "stress_level": "Low",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    summary = payload["integration"]["runtime_summary"]

    assert payload["integration"]["status"] == "sync-live"
    assert summary["consent_granted"] is True
    assert summary["connected_device_label"] == "Galaxy Watch Ultra"
    assert summary["synced_session_count"] == 1
    assert summary["sleep_hours"] == 7.8
    assert summary["resting_hr"] == 49
    assert summary["energy_score"] == 88
    assert summary["bridge_source"] == "samsung-health-sdk"
    assert summary["sync_mode"] == "device-sdk-bridge"


def test_integrations_payload_exposes_richer_device_runtime_summaries(client):
    client.post(
        "/api/v1/integrations/health_connect/connect",
        json={"account_label": "Pixel 10 Pro"},
    )
    client.post("/api/v1/integrations/health_connect/sync")
    client.post(
        "/api/v1/integrations/samsung_health/connect",
        json={"account_label": "Galaxy Watch Ultra"},
    )
    client.post("/api/v1/integrations/samsung_health/sync")

    response = client.get("/api/v1/integrations")

    assert response.status_code == 200
    payload = response.json()
    health_connect = next(item for item in payload if item["key"] == "health_connect")
    samsung_health = next(item for item in payload if item["key"] == "samsung_health")

    assert health_connect["runtime_summary"]["permission_granted"] is True
    assert health_connect["runtime_summary"]["connected_device_label"] == "Pixel 10 Pro"
    assert health_connect["runtime_summary"]["last_permission_at"] is not None
    assert health_connect["runtime_summary"]["hydration_ml"] == 2400
    assert health_connect["runtime_summary"]["body_weight_kg"] == 69.8
    assert health_connect["runtime_summary"]["step_count"] == 10840
    assert health_connect["runtime_summary"]["active_energy_kcal"] == 684
    assert health_connect["runtime_summary"]["synced_session_count"] == 2
    assert health_connect["runtime_summary"]["sync_mode"] == "permissions-local-stub"

    assert samsung_health["runtime_summary"]["consent_granted"] is True
    assert samsung_health["runtime_summary"]["connected_device_label"] == "Galaxy Watch Ultra"
    assert samsung_health["runtime_summary"]["last_consent_at"] is not None
    assert samsung_health["runtime_summary"]["supported_metric_count"] == 5
    assert samsung_health["runtime_summary"]["sleep_hours"] == 7.4
    assert samsung_health["runtime_summary"]["resting_hr"] == 52
    assert samsung_health["runtime_summary"]["energy_score"] == 82
    assert samsung_health["runtime_summary"]["stress_level"] == "Low"
    assert samsung_health["runtime_summary"]["synced_session_count"] == 2
    assert samsung_health["runtime_summary"]["sync_mode"] == "sdk-local-stub"


def test_disconnect_resets_integration_state(client):
    client.post(
        "/api/v1/integrations/samsung_health/connect",
        json={"account_label": "Galaxy Watch"},
    )

    response = client.post(
        "/api/v1/integrations/samsung_health/disconnect",
        json={"confirm": True},
    )

    assert response.status_code == 200
    payload = response.json()

    assert payload["integration"]["connected"] is False
    assert payload["integration"]["status"] == "disconnected"
    assert payload["integration"]["account_label"] is None
    assert payload["integration"]["last_sync_at"] is None


def test_disconnect_requires_explicit_confirmation(client):
    client.post(
        "/api/v1/integrations/samsung_health/connect",
        json={"account_label": "Galaxy Watch"},
    )

    unconfirmed = client.post("/api/v1/integrations/samsung_health/disconnect")
    assert unconfirmed.status_code == 400

    explicitly_declined = client.post(
        "/api/v1/integrations/samsung_health/disconnect",
        json={"confirm": False},
    )
    assert explicitly_declined.status_code == 400

    still_connected = client.get("/api/v1/integrations")
    samsung_health = next(
        item for item in still_connected.json() if item["key"] == "samsung_health"
    )
    assert samsung_health["connected"] is True
