def test_read_strava_settings_defaults_to_no_credentials_set(client):
    response = client.get("/api/v1/settings/strava")

    assert response.status_code == 200
    body = response.json()
    assert body["client_id_set"] is False
    assert body["client_secret_set"] is False
    assert "redirect_uri" in body
    assert "scopes" in body


def test_update_strava_settings_sets_and_reports_credentials_present(client):
    set_response = client.put(
        "/api/v1/settings/strava",
        json={"client_id": "12345", "client_secret": "shh-secret"},
    )
    assert set_response.status_code == 200
    assert set_response.json()["client_id_set"] is True
    assert set_response.json()["client_secret_set"] is True

    read_response = client.get("/api/v1/settings/strava")
    assert read_response.json()["client_id_set"] is True
    assert read_response.json()["client_secret_set"] is True


def test_update_strava_settings_never_echoes_the_raw_secret(client):
    response = client.put(
        "/api/v1/settings/strava",
        json={"client_id": "12345", "client_secret": "super-secret"},
    )

    assert "super-secret" not in response.text


def test_clear_strava_settings_removes_credentials(client):
    client.put("/api/v1/settings/strava", json={"client_id": "12345", "client_secret": "shh-secret"})

    cleared = client.put(
        "/api/v1/settings/strava",
        json={"clear_client_id": True, "clear_client_secret": True},
    )

    assert cleared.json()["client_id_set"] is False
    assert cleared.json()["client_secret_set"] is False


def test_update_strava_settings_strips_whitespace(client):
    from app.features.shared.services.state import shared_state

    client.put("/api/v1/settings/strava", json={"client_id": "  12345  ", "client_secret": "  shh  "})

    assert shared_state.get_strava_client_id() == "12345"
    assert shared_state.get_strava_client_secret() == "shh"


def test_runtime_configured_client_id_takes_precedence_over_env(client, monkeypatch):
    from app.core.config import get_settings
    from app.features.shared.services.state import shared_state

    monkeypatch.setenv("ATLAS_STRAVA_CLIENT_ID", "env-id")
    monkeypatch.setenv("ATLAS_STRAVA_CLIENT_SECRET", "env-secret")
    get_settings.cache_clear()

    # With nothing configured in Settings, the env value is used as a fallback.
    assert shared_state.get_strava_client_id() == "env-id"
    assert shared_state.get_strava_client_secret() == "env-secret"

    client.put("/api/v1/settings/strava", json={"client_id": "ui-id", "client_secret": "ui-secret"})

    # Once something is entered through Settings, it wins over the env value.
    assert shared_state.get_strava_client_id() == "ui-id"
    assert shared_state.get_strava_client_secret() == "ui-secret"

    get_settings.cache_clear()
