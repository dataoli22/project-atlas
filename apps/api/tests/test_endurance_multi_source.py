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
        # Health Connect/Samsung Health no longer support a desktop-triggered "sync" (they only
        # exist on the phone) - device-sync is the real path a paired phone app posts through,
        # so that's what feeds the combined multi-source aggregation now.
        client.post("/api/v1/integrations/health_connect/connect", json={"account_label": "Pixel 10 Pro"})
        client.post(
            "/api/v1/integrations/health_connect/device-sync",
            json={
                "device_label": "Pixel 10 Pro",
                "bridge_source": "health-connect-sdk",
                "recent_sessions": [
                    {
                        "session_label": "Health Connect steady run",
                        "session_type": "Run",
                        "duration_minutes": 52,
                        "distance_km": 8.6,
                        "start_date": "2026-07-09T06:10:00Z",
                        "source": "health-connect-live",
                    },
                    {
                        "session_label": "Health Connect walk",
                        "session_type": "Walk",
                        "duration_minutes": 34,
                        "distance_km": 2.8,
                        "start_date": "2026-07-08T18:25:00Z",
                        "source": "health-connect-live",
                    },
                ],
                "hydration_ml": 2400,
                "body_weight_kg": 69.8,
                "step_count": 10840,
                "active_energy_kcal": 684,
            },
        )
        client.post("/api/v1/integrations/samsung_health/connect", json={"account_label": "Galaxy Watch Ultra"})
        client.post(
            "/api/v1/integrations/samsung_health/device-sync",
            json={
                "device_label": "Galaxy Watch Ultra",
                "bridge_source": "samsung-health-sdk",
                "recent_sessions": [
                    {
                        "session_label": "Samsung Health recovery walk",
                        "session_type": "Walk",
                        "duration_minutes": 28,
                        "distance_km": 2.1,
                        "start_date": "2026-07-09T19:00:00Z",
                        "source": "samsung-health-live",
                    },
                    {
                        "session_label": "Samsung Health mobility",
                        "session_type": "Mobility",
                        "duration_minutes": 22,
                        "distance_km": 0.0,
                        "start_date": "2026-07-08T20:00:00Z",
                        "source": "samsung-health-live",
                    },
                ],
                "sleep_hours": 7.4,
                "resting_hr": 52,
                "energy_score": 82,
                "stress_level": "Low",
            },
        )
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
