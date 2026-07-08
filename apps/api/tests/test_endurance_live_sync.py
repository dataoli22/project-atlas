def test_endurance_routes_use_synced_strava_data(client, monkeypatch):
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
        client.post("/api/v1/integrations/strava/sync")
    finally:
        get_settings.cache_clear()

    dashboard_response = client.get("/api/v1/endurance/dashboard")
    timeline_response = client.get("/api/v1/endurance/timeline")
    insights_response = client.get("/api/v1/endurance/insights")

    assert dashboard_response.status_code == 200
    dashboard = dashboard_response.json()
    assert dashboard["latest_workout"]["title"] == "Morning Run"
    assert dashboard["cards"][1]["trend"] == "Synced from Strava"

    assert timeline_response.status_code == 200
    timeline = timeline_response.json()
    assert timeline["entries"][0]["session_label"] == "Morning Run"
    assert timeline["entries"][0]["source"] == "strava-live"

    assert insights_response.status_code == 200
    insights = insights_response.json()
    assert "Live Strava activity data" in insights["capability"]["headline"]
    assert insights["insights"][0]["priority"] == "high"
