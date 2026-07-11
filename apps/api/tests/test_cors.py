def test_loopback_origin_receives_cors_headers(client):
    response = client.get("/api/v1/app/preferences", headers={"Origin": "http://127.0.0.1:54213"})

    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://127.0.0.1:54213"


def test_localhost_origin_receives_cors_headers(client):
    response = client.get("/api/v1/app/preferences", headers={"Origin": "http://localhost:3000"})

    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_non_loopback_origin_does_not_receive_cors_headers(client):
    response = client.get("/api/v1/app/preferences", headers={"Origin": "http://192.168.1.50:3000"})

    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


def test_preflight_request_from_loopback_is_allowed(client):
    response = client.options(
        "/api/v1/app/preferences",
        headers={
            "Origin": "http://127.0.0.1:3000",
            "Access-Control-Request-Method": "PUT",
        },
    )

    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://127.0.0.1:3000"
