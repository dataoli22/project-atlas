def test_insights_endpoint_surfaces_no_medical_flags_by_default(client):
    response = client.get("/api/v1/endurance/insights")

    assert response.status_code == 200
    assert response.json()["medical_flags"] == []


def test_insights_endpoint_surfaces_a_medical_flag_from_synced_samsung_health_data(client, monkeypatch):
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

    class MinimalStravaOAuthClient:
        def __init__(self, *, client_id: str, client_secret: str) -> None:
            pass

        def exchange_code_for_tokens(self, *, code: str) -> StravaTokenExchangeResult:
            return StravaTokenExchangeResult(
                access_token="access-123", refresh_token="refresh-456", expires_at=1893456000, athlete_id="789"
            )

        def get_athlete_profile(self, *, access_token: str) -> StravaAthleteProfile:
            return StravaAthleteProfile(athlete_id="789", username="runner", firstname="Atlas", lastname="Runner")

        def list_recent_activities(self, *, access_token: str, per_page: int = 5) -> list[StravaActivity]:
            return [
                StravaActivity(
                    activity_id="1",
                    name="Morning Run",
                    sport_type="Run",
                    moving_time_seconds=1800,
                    distance_meters=5000,
                    start_date="2026-07-09T06:00:00Z",
                )
            ]

    monkeypatch.setattr(integrations_service, "StravaOAuthClient", MinimalStravaOAuthClient)
    get_settings.cache_clear()
    try:
        launch_url = client.post("/api/v1/integrations/strava/connect", json={}).json()["launch_url"]
        state_value = launch_url.split("state=")[1].split("&")[0]
        client.post("/api/v1/integrations/strava/callback", json={"code": "temporary-auth-code", "state": state_value})
        client.post("/api/v1/integrations/strava/token-exchange")
        client.post("/api/v1/integrations/strava/sync")

        client.post("/api/v1/integrations/samsung_health/connect", json={"account_label": "Galaxy Watch"})
        client.post("/api/v1/integrations/samsung_health/sync")

        from app.features.shared.services.state import shared_state

        shared_state.store_samsung_health_sync(
            recent_sessions=[],
            sleep_hours=2.0,
            resting_hr=110,
            energy_score=40,
            stress_level="High",
            bridge_source="local-stub",
        )

        response = client.get("/api/v1/endurance/insights")
    finally:
        get_settings.cache_clear()

    payload = response.json()
    flag_types = {flag["flag_type"] for flag in payload["medical_flags"]}
    assert flag_types == {"elevated_resting_heart_rate", "severe_sleep_deprivation"}
    for flag in payload["medical_flags"]:
        assert "doctor" in flag["message"].lower()
        assert flag["detail"]
