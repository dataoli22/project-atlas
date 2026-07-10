from app.main import app


def test_openapi_schema_builds_without_error():
    schema = app.openapi()

    assert schema["info"]["title"]
    assert schema["info"]["version"]
    assert len(schema["paths"]) > 0


def test_openapi_schema_documents_a_default_error_response_on_every_operation():
    schema = app.openapi()

    assert schema["components"]["schemas"]["ErrorDetail"]["required"] == ["detail"]

    checked = 0
    for path_item in schema["paths"].values():
        for method, operation in path_item.items():
            if method not in ("get", "post", "put", "delete", "patch"):
                continue
            checked += 1
            assert "default" in operation["responses"], f"{method} missing default error response"
            assert (
                operation["responses"]["default"]["content"]["application/json"]["schema"]["$ref"]
                == "#/components/schemas/ErrorDetail"
            )

    assert checked > 30


def test_openapi_schema_is_served_under_the_versioned_api_prefix(client):
    response = client.get("/api/v1/openapi.json")

    assert response.status_code == 200
    assert response.json()["paths"]
