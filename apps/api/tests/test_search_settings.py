def test_read_search_settings_defaults_to_no_key_set(client):
    response = client.get("/api/v1/settings/search")

    assert response.status_code == 200
    assert response.json() == {"brave_api_key_set": False}


def test_update_search_settings_sets_and_reports_key_present(client):
    set_response = client.put("/api/v1/settings/search", json={"brave_api_key": "test-brave-key"})
    assert set_response.status_code == 200
    assert set_response.json() == {"brave_api_key_set": True}

    read_response = client.get("/api/v1/settings/search")
    assert read_response.json() == {"brave_api_key_set": True}


def test_update_search_settings_never_echoes_the_raw_key(client):
    response = client.put("/api/v1/settings/search", json={"brave_api_key": "super-secret"})

    assert "super-secret" not in response.text


def test_clear_search_settings_removes_the_key(client):
    client.put("/api/v1/settings/search", json={"brave_api_key": "test-brave-key"})

    cleared = client.put("/api/v1/settings/search", json={"clear_brave_api_key": True})

    assert cleared.json() == {"brave_api_key_set": False}


def test_update_search_settings_strips_whitespace(client):
    from app.features.shared.services.state import shared_state

    client.put("/api/v1/settings/search", json={"brave_api_key": "  padded-key  "})

    assert shared_state.get_brave_api_key() == "padded-key"
