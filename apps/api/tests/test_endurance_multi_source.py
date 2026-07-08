def test_endurance_routes_aggregate_all_three_connector_sources(client, monkeypatch):
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
                    start_date="2026-07-09T06:00:00Z",
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
        client.post("/api/v1/integrations/health_connect/connect", json={"account_label": "Pixel 10 Pro"})
        client.post("/api/v1/integrations/health_connect/sync")
        client.post("/api/v1/integrations/samsung_health/connect", json={"account_label": "Galaxy Watch Ultra"})
        client.post("/api/v1/integrations/samsung_health/sync")
    finally:
        get_settings.cache_clear()

    dashboard = client.get("/api/v1/endurance/dashboard").json()
    timeline = client.get("/api/v1/endurance/timeline").json()
    insights = client.get("/api/v1/endurance/insights").json()

    assert dashboard["cards"][0]["trend"] == "5 recent sessions across 3 sources"
    assert any(entry["source"] == "strava-live" for entry in timeline["entries"])
    assert any(entry["source"] == "health-connect-live" for entry in timeline["entries"])
    assert any(entry["source"] == "samsung-health-live" for entry in timeline["entries"])
    assert "combined recent workload and recovery context" in insights["capability"]["headline"]
    assert insights["capability"]["areas"][2]["label"] == "Recovery support"
