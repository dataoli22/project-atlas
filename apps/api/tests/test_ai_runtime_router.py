import json
from urllib.error import URLError

from app.features.shared.services import ai as ai_service


class _FakeResponse:
    def __init__(self, payload: dict) -> None:
        self._body = json.dumps(payload).encode("utf-8")

    def read(self) -> bytes:
        return self._body

    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, *args) -> None:
        return None


def test_ai_health_endpoint_reports_missing_model(client, monkeypatch):
    monkeypatch.setattr(ai_service, "_is_ollama_binary_present", lambda: True)
    responses = iter(
        [
            _FakeResponse({"version": "0.31.1"}),
            _FakeResponse({"models": [{"model": "nomic-embed-text:latest"}]}),
        ]
    )
    monkeypatch.setattr(ai_service, "urlopen", lambda *args, **kwargs: next(responses))

    response = client.post(
        "/api/v1/settings/ai/health",
        json={
            "ollama_base_url": "http://localhost:11434",
            "ollama_model": "llama3.1:8b",
            "ollama_embed_model": "nomic-embed-text",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is False
    assert payload["installed"] is True
    assert payload["model_available"] is False
    assert payload["embed_model_available"] is True


def test_ai_health_endpoint_ok_when_reachable_with_models(client, monkeypatch):
    monkeypatch.setattr(ai_service, "_is_ollama_binary_present", lambda: True)
    responses = iter(
        [
            _FakeResponse({"version": "0.31.1"}),
            _FakeResponse({"models": [{"model": "qwen2.5:7b"}, {"model": "nomic-embed-text:latest"}]}),
        ]
    )
    monkeypatch.setattr(ai_service, "urlopen", lambda *args, **kwargs: next(responses))

    response = client.post(
        "/api/v1/settings/ai/health",
        json={
            "ollama_base_url": "http://localhost:11434",
            "ollama_model": "qwen2.5:7b",
            "ollama_embed_model": "nomic-embed-text",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["model_available"] is True
    assert payload["embed_model_available"] is True


def test_ai_pull_endpoint_success(client, monkeypatch):
    monkeypatch.setattr(
        ai_service, "urlopen", lambda *args, **kwargs: _FakeResponse({"status": "success"})
    )

    response = client.post(
        "/api/v1/settings/ai/pull",
        json={"model": "nomic-embed-text", "ollama_base_url": "http://localhost:11434"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["model"] == "nomic-embed-text"


def test_ai_pull_endpoint_reports_unreachable_runtime(client, monkeypatch):
    monkeypatch.setattr(
        ai_service,
        "urlopen",
        lambda *args, **kwargs: (_ for _ in ()).throw(URLError("connection refused")),
    )

    response = client.post(
        "/api/v1/settings/ai/pull",
        json={"model": "qwen2.5:7b", "ollama_base_url": "http://localhost:11434"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is False
    assert "could not reach" in payload["message"].lower()


def test_ai_pull_endpoint_rejects_blank_model(client):
    response = client.post(
        "/api/v1/settings/ai/pull",
        json={"model": "   ", "ollama_base_url": "http://localhost:11434"},
    )

    assert response.status_code == 400
