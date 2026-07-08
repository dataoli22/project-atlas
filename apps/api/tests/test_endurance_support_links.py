VALID_RESOURCE_TYPES = {
    "recovery",
    "mobility",
    "strength",
    "base-training",
    "connector-setup",
    "general",
}

CONNECTOR_SETUP_URLS = {
    "strava": "https://developers.strava.com/docs/authentication/",
    "health_connect": "https://developer.android.com/health-and-fitness/guides/health-connect",
    "samsung_health": "https://developer.samsung.com/health/android",
}


def _assert_valid_support_links(payload: dict) -> list[dict]:
    links = payload["support_links"]
    assert isinstance(links, list)
    assert len(links) > 0
    for link in links:
        assert link["resource_type"] in VALID_RESOURCE_TYPES
        assert link["title"]
        assert link["url"]
        assert link["why_recommended"]
    return links


def _connector_setup_urls(links: list[dict]) -> set[str]:
    return {link["url"] for link in links if link["resource_type"] == "connector-setup"}


def test_stub_dashboard_and_insights_include_support_links(client):
    dashboard = client.get("/api/v1/endurance/dashboard").json()
    insights = client.get("/api/v1/endurance/insights").json()

    dashboard_links = _assert_valid_support_links(dashboard)
    insights_links = _assert_valid_support_links(insights)

    # In the default (all-disconnected) state, every connector has a setup link.
    for url in CONNECTOR_SETUP_URLS.values():
        assert url in _connector_setup_urls(dashboard_links)
        assert url in _connector_setup_urls(insights_links)

    # Every support link carries a freshness stamp.
    assert all(link["freshness_at"] for link in dashboard_links)
    assert all(link["freshness_at"] for link in insights_links)


def test_live_paths_include_support_links_and_flag_disconnected_connectors(client, monkeypatch):
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
        client.post(
            "/api/v1/integrations/strava/callback",
            json={"code": "temporary-auth-code", "state": state_value},
        )
        client.post("/api/v1/integrations/strava/token-exchange")
        client.post("/api/v1/integrations/strava/sync")
    finally:
        get_settings.cache_clear()

    dashboard = client.get("/api/v1/endurance/dashboard").json()
    insights = client.get("/api/v1/endurance/insights").json()

    dashboard_links = _assert_valid_support_links(dashboard)
    insights_links = _assert_valid_support_links(insights)

    # Strava is connected but Health Connect and Samsung Health are not:
    # their connector-setup links must still be present in both live paths.
    for url in (
        CONNECTOR_SETUP_URLS["health_connect"],
        CONNECTOR_SETUP_URLS["samsung_health"],
    ):
        assert url in _connector_setup_urls(dashboard_links)
        assert url in _connector_setup_urls(insights_links)

    # Freshness stamp on the live path mirrors the response generated_at.
    assert dashboard_links[0]["freshness_at"] == dashboard["generated_at"]
    assert insights_links[0]["freshness_at"] == insights["generated_at"]

    # A disconnected connector's setup link is worded to reflect the missing connection.
    hc_links = [
        link
        for link in dashboard_links
        if link["url"] == CONNECTOR_SETUP_URLS["health_connect"]
    ]
    assert hc_links
    assert "not connected" in hc_links[0]["why_recommended"].lower()
