def test_health_endpoint_reports_ok_status_and_dependency_checks(client):
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    payload = response.json()

    assert payload["status"] == "ok"
    assert payload["version"]
    check_names = {check["name"] for check in payload["checks"]}
    assert "database" in check_names
    assert "local_state_directory" in check_names
    assert all(check["ok"] is True for check in payload["checks"])


def test_health_endpoint_database_check_uses_a_real_query(client, monkeypatch):
    from app.features.shared.services.state import shared_state

    monkeypatch.setattr(shared_state, "check_database_health", lambda: (False, "SQLite is locked."))

    response = client.get("/api/v1/health")
    payload = response.json()

    assert payload["status"] == "degraded"
    database_check = next(check for check in payload["checks"] if check["name"] == "database")
    assert database_check["ok"] is False
    assert database_check["detail"] == "SQLite is locked."
