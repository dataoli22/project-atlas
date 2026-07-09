from app.features.shared.services import pairing


def test_generate_pairing_code_is_six_digits():
    code = pairing.generate_pairing_code()
    assert len(code) == 6
    assert code.isdigit()


def test_pairing_code_expiry_is_in_the_future():
    expiry = pairing.pairing_code_expiry()
    assert pairing.is_expired(expiry) is False


def test_is_expired_handles_malformed_input():
    assert pairing.is_expired("not-a-date") is True


def test_start_pairing_returns_code_and_port(client):
    response = client.post("/api/v1/pairing/start")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["code"]) == 6
    assert isinstance(payload["lan_addresses"], list)
    assert payload["port"] > 0


def test_confirm_pairing_with_correct_code_issues_device_token(client):
    start = client.post("/api/v1/pairing/start").json()

    response = client.post(
        "/api/v1/pairing/confirm",
        json={"code": start["code"], "device_name": "Pixel 10 Pro"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["device_name"] == "Pixel 10 Pro"
    assert len(payload["device_token"]) > 20

    devices = client.get("/api/v1/pairing/devices").json()
    assert len(devices) == 1
    assert devices[0]["device_id"] == payload["device_id"]
    assert devices[0]["last_sync_at"] is None


def test_confirm_pairing_with_wrong_code_fails(client):
    client.post("/api/v1/pairing/start")

    response = client.post(
        "/api/v1/pairing/confirm",
        json={"code": "000000", "device_name": "Someone else's phone"},
    )

    assert response.status_code == 400


def test_confirm_pairing_invalidates_code_after_max_wrong_attempts(client):
    from app.features.shared.services.pairing import MAX_PAIRING_ATTEMPTS

    start = client.post("/api/v1/pairing/start").json()

    for _ in range(MAX_PAIRING_ATTEMPTS):
        response = client.post(
            "/api/v1/pairing/confirm",
            json={"code": "000000", "device_name": "Attacker"},
        )
        assert response.status_code == 400

    # Even the correct code no longer works - the code was invalidated outright, not just
    # rate-limited, after MAX_PAIRING_ATTEMPTS wrong guesses.
    final = client.post(
        "/api/v1/pairing/confirm",
        json={"code": start["code"], "device_name": "Legitimate phone"},
    )
    assert final.status_code == 400
    assert "no pairing" in final.json()["detail"].lower() or "expired" in final.json()["detail"].lower() or "attempts" in final.json()["detail"].lower()


def test_confirm_pairing_attempts_reset_on_new_pairing_start(client):
    from app.features.shared.services.pairing import MAX_PAIRING_ATTEMPTS

    client.post("/api/v1/pairing/start")
    for _ in range(MAX_PAIRING_ATTEMPTS - 1):
        client.post(
            "/api/v1/pairing/confirm",
            json={"code": "000000", "device_name": "Attacker"},
        )

    # Starting a fresh pairing session should reset the attempt counter, not carry it over.
    fresh = client.post("/api/v1/pairing/start").json()
    response = client.post(
        "/api/v1/pairing/confirm",
        json={"code": fresh["code"], "device_name": "Legitimate phone"},
    )
    assert response.status_code == 200


def test_confirm_pairing_without_any_pending_code_fails(client):
    response = client.post(
        "/api/v1/pairing/confirm",
        json={"code": "123456", "device_name": "No pairing started"},
    )
    assert response.status_code == 400


def test_confirm_pairing_code_is_single_use(client):
    start = client.post("/api/v1/pairing/start").json()

    first = client.post(
        "/api/v1/pairing/confirm",
        json={"code": start["code"], "device_name": "First device"},
    )
    assert first.status_code == 200

    second = client.post(
        "/api/v1/pairing/confirm",
        json={"code": start["code"], "device_name": "Replay attempt"},
    )
    assert second.status_code == 400


def test_revoke_paired_device_removes_it(client):
    start = client.post("/api/v1/pairing/start").json()
    confirmed = client.post(
        "/api/v1/pairing/confirm",
        json={"code": start["code"], "device_name": "Pixel 10 Pro"},
    ).json()

    response = client.delete(f"/api/v1/pairing/devices/{confirmed['device_id']}")

    assert response.status_code == 200
    assert response.json() == []


def test_revoke_unknown_device_returns_404(client):
    response = client.delete("/api/v1/pairing/devices/does-not-exist")
    assert response.status_code == 404


def test_device_sync_without_pairing_headers_still_works(client):
    """Backward compatibility: the desktop UI's own sync buttons never send device headers."""
    response = client.post(
        "/api/v1/integrations/health_connect/device-sync",
        json={"recent_sessions": [], "device_label": "This device"},
    )
    assert response.status_code == 200


def test_device_sync_with_valid_paired_token_works(client):
    start = client.post("/api/v1/pairing/start").json()
    confirmed = client.post(
        "/api/v1/pairing/confirm",
        json={"code": start["code"], "device_name": "Pixel 10 Pro"},
    ).json()

    response = client.post(
        "/api/v1/integrations/health_connect/device-sync",
        json={"recent_sessions": [], "device_label": "Pixel 10 Pro"},
        headers={
            "X-Atlas-Device-Id": confirmed["device_id"],
            "Authorization": f"Bearer {confirmed['device_token']}",
        },
    )
    assert response.status_code == 200

    devices = client.get("/api/v1/pairing/devices").json()
    assert devices[0]["last_sync_at"] is not None


def test_device_sync_with_invalid_token_is_rejected(client):
    start = client.post("/api/v1/pairing/start").json()
    confirmed = client.post(
        "/api/v1/pairing/confirm",
        json={"code": start["code"], "device_name": "Pixel 10 Pro"},
    ).json()

    response = client.post(
        "/api/v1/integrations/health_connect/device-sync",
        json={"recent_sessions": [], "device_label": "Pixel 10 Pro"},
        headers={
            "X-Atlas-Device-Id": confirmed["device_id"],
            "Authorization": "Bearer wrong-token",
        },
    )
    assert response.status_code == 401


def test_device_sync_with_incomplete_pairing_headers_is_rejected(client):
    response = client.post(
        "/api/v1/integrations/health_connect/device-sync",
        json={"recent_sessions": [], "device_label": "Pixel 10 Pro"},
        headers={"X-Atlas-Device-Id": "some-id"},
    )
    assert response.status_code == 401
