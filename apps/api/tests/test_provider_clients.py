import json
from urllib import error

import pytest

from app.features.shared.services import provider_clients
from app.features.shared.services.provider_clients import GroqProviderClient, _call_with_retry


class _FakeResponse:
    def __init__(self, body: dict | list):
        self._body = json.dumps(body).encode("utf-8")

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def _no_sleep(_seconds):
    pass


def test_call_with_retry_returns_on_first_success():
    calls = {"count": 0}

    def fn():
        calls["count"] += 1
        return "ok"

    assert _call_with_retry(fn, sleep=_no_sleep) == "ok"
    assert calls["count"] == 1


def test_call_with_retry_retries_transient_url_errors_then_succeeds():
    calls = {"count": 0}

    def fn():
        calls["count"] += 1
        if calls["count"] < 3:
            raise error.URLError("connection reset")
        return "ok"

    assert _call_with_retry(fn, sleep=_no_sleep) == "ok"
    assert calls["count"] == 3


def test_call_with_retry_retries_5xx_http_errors():
    calls = {"count": 0}

    def fn():
        calls["count"] += 1
        if calls["count"] < 2:
            raise error.HTTPError("http://x", 503, "Service Unavailable", None, None)
        return "ok"

    assert _call_with_retry(fn, sleep=_no_sleep) == "ok"
    assert calls["count"] == 2


def test_call_with_retry_does_not_retry_4xx_http_errors():
    calls = {"count": 0}

    def fn():
        calls["count"] += 1
        raise error.HTTPError("http://x", 401, "Unauthorized", None, None)

    with pytest.raises(error.HTTPError):
        _call_with_retry(fn, sleep=_no_sleep)
    assert calls["count"] == 1


def test_call_with_retry_gives_up_after_max_attempts():
    calls = {"count": 0}

    def fn():
        calls["count"] += 1
        raise error.URLError("still down")

    with pytest.raises(error.URLError):
        _call_with_retry(fn, sleep=_no_sleep)
    assert calls["count"] == provider_clients._RETRYABLE_HTTP_MAX_ATTEMPTS


def test_groq_client_retries_on_transient_failure_then_succeeds(monkeypatch):
    attempts = {"count": 0}

    def fake_urlopen(req, timeout=None):
        attempts["count"] += 1
        if attempts["count"] < 2:
            raise error.URLError("connection reset")
        return _FakeResponse({"choices": [{"message": {"content": "hello"}}]})

    monkeypatch.setattr(provider_clients.request, "urlopen", fake_urlopen)
    monkeypatch.setattr(provider_clients.time, "sleep", _no_sleep)

    client = GroqProviderClient(api_key="test-key")
    result = client.complete(model="llama-3.1-8b-instant", messages=[], response_token_budget=100)

    assert result.answer == "hello"
    assert attempts["count"] == 2


def test_groq_client_does_not_retry_auth_rejection(monkeypatch):
    attempts = {"count": 0}

    def fake_urlopen(req, timeout=None):
        attempts["count"] += 1
        raise error.HTTPError("http://x", 401, "Unauthorized", None, None)

    monkeypatch.setattr(provider_clients.request, "urlopen", fake_urlopen)
    monkeypatch.setattr(provider_clients.time, "sleep", _no_sleep)

    client = GroqProviderClient(api_key="bad-key")
    with pytest.raises(error.HTTPError):
        client.complete(model="llama-3.1-8b-instant", messages=[], response_token_budget=100)

    assert attempts["count"] == 1
