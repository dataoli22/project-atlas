import json
from urllib.error import HTTPError, URLError

import pytest

from app.features.shared.services import ai


class _FakeResponse:
    def __init__(self, payload: dict) -> None:
        self._body = json.dumps(payload).encode("utf-8")

    def read(self) -> bytes:
        return self._body

    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, *args) -> None:
        return None


def _tags_payload(models: list[str]) -> dict:
    return {"models": [{"model": name} for name in models]}


def test_normalize_model_tag_adds_latest_when_bare():
    assert ai._normalize_model_tag("nomic-embed-text") == "nomic-embed-text:latest"


def test_normalize_model_tag_keeps_existing_tag():
    assert ai._normalize_model_tag("llama3.1:8b") == "llama3.1:8b"


def test_check_ollama_runtime_ok_when_models_installed(monkeypatch):
    monkeypatch.setattr(ai, "_is_ollama_binary_present", lambda: True)

    responses = iter(
        [
            _FakeResponse({"version": "0.31.1"}),
            _FakeResponse(_tags_payload(["qwen2.5:7b", "nomic-embed-text:latest"])),
        ]
    )
    monkeypatch.setattr(ai, "urlopen", lambda *args, **kwargs: next(responses))

    result = ai.check_ollama_runtime(
        ollama_base_url="http://localhost:11434",
        ollama_model="qwen2.5:7b",
        ollama_embed_model="nomic-embed-text",
        ollama_api_key=None,
    )

    assert result.ok is True
    assert result.installed is True
    assert result.model_available is True
    assert result.embed_model_available is True
    assert result.version == "0.31.1"


def test_check_ollama_runtime_reports_missing_chat_model(monkeypatch):
    monkeypatch.setattr(ai, "_is_ollama_binary_present", lambda: True)

    responses = iter(
        [
            _FakeResponse({"version": "0.31.1"}),
            _FakeResponse(_tags_payload(["nomic-embed-text:latest"])),
        ]
    )
    monkeypatch.setattr(ai, "urlopen", lambda *args, **kwargs: next(responses))

    result = ai.check_ollama_runtime(
        ollama_base_url="http://localhost:11434",
        ollama_model="llama3.1:8b",
        ollama_embed_model="nomic-embed-text",
        ollama_api_key=None,
    )

    assert result.ok is False
    assert result.model_available is False
    assert "not installed on this runtime" in result.message
    assert ai.OLLAMA_LIBRARY_URL in result.message


def test_check_ollama_runtime_distinguishes_not_installed_from_not_running(monkeypatch):
    monkeypatch.setattr(ai, "_is_ollama_binary_present", lambda: False)
    monkeypatch.setattr(
        ai,
        "urlopen",
        lambda *args, **kwargs: (_ for _ in ()).throw(URLError("connection refused")),
    )

    result = ai.check_ollama_runtime(
        ollama_base_url="http://localhost:11434",
        ollama_model="qwen2.5:7b",
        ollama_embed_model=None,
        ollama_api_key=None,
    )

    assert result.ok is False
    assert result.installed is False
    assert ai.OLLAMA_DOWNLOAD_URL in result.message


def test_check_ollama_runtime_reports_not_running_when_installed_but_unreachable(monkeypatch):
    monkeypatch.setattr(ai, "_is_ollama_binary_present", lambda: True)
    monkeypatch.setattr(
        ai,
        "urlopen",
        lambda *args, **kwargs: (_ for _ in ()).throw(URLError("connection refused")),
    )

    result = ai.check_ollama_runtime(
        ollama_base_url="http://localhost:11434",
        ollama_model="qwen2.5:7b",
        ollama_embed_model=None,
        ollama_api_key=None,
    )

    assert result.ok is False
    assert result.installed is True
    assert "Make sure Ollama is running" in result.message


def test_check_ollama_runtime_treats_non_local_target_as_unknown_install_state(monkeypatch):
    monkeypatch.setattr(
        ai,
        "urlopen",
        lambda *args, **kwargs: (_ for _ in ()).throw(URLError("connection refused")),
    )

    result = ai.check_ollama_runtime(
        ollama_base_url="https://cloud.ollama.example.com",
        ollama_model="qwen2.5:7b",
        ollama_embed_model=None,
        ollama_api_key=None,
    )

    assert result.local_target is False
    assert result.installed is None


def test_pull_ollama_model_success(monkeypatch):
    monkeypatch.setattr(ai, "urlopen", lambda *args, **kwargs: _FakeResponse({"status": "success"}))

    result = ai.pull_ollama_model(
        ollama_base_url="http://localhost:11434",
        model="nomic-embed-text",
        ollama_api_key=None,
    )

    assert result.ok is True
    assert result.model == "nomic-embed-text"


def test_pull_ollama_model_reports_manifest_error(monkeypatch):
    def _raise(*args, **kwargs):
        error_body = json.dumps({"error": "pull model manifest: file does not exist"}).encode("utf-8")

        class _FakeErrorResponse:
            def read(self):
                return error_body

        raise HTTPError(
            "http://localhost:11434/api/pull",
            500,
            "Internal Server Error",
            hdrs=None,
            fp=_FakeErrorResponse(),
        )

    monkeypatch.setattr(ai, "urlopen", _raise)

    result = ai.pull_ollama_model(
        ollama_base_url="http://localhost:11434",
        model="does-not-exist",
        ollama_api_key=None,
    )

    assert result.ok is False
    assert "manifest" in result.message


def test_pull_ollama_model_reports_unreachable_runtime(monkeypatch):
    monkeypatch.setattr(
        ai,
        "urlopen",
        lambda *args, **kwargs: (_ for _ in ()).throw(URLError("connection refused")),
    )

    result = ai.pull_ollama_model(
        ollama_base_url="http://localhost:11434",
        model="qwen2.5:7b",
        ollama_api_key=None,
    )

    assert result.ok is False
    assert "could not reach" in result.message.lower()


def test_pull_ollama_model_rejects_blank_model_name():
    with pytest.raises(ValueError):
        ai.pull_ollama_model(
            ollama_base_url="http://localhost:11434",
            model="   ",
            ollama_api_key=None,
        )
