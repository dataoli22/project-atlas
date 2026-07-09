import subprocess
from unittest.mock import patch

from app.features.shared.services.secure_storage import (
    LocalSecretProtector,
    build_local_secret_protector,
)
from app.features.shared.services.state import shared_state


def test_local_secret_protector_round_trips_secret():
    protector = build_local_secret_protector()

    payload = protector.protect("secret-token-value", key="test_secret")

    assert payload["scheme"] == "base64-fallback"
    assert payload["cipher_text"] != "secret-token-value"
    assert protector.unprotect(payload, key="test_secret") == "secret-token-value"


def test_protect_empty_secret_returns_empty_cipher_text():
    protector = build_local_secret_protector()

    payload = protector.protect("", key="test_secret")

    assert payload["cipher_text"] == ""
    assert protector.unprotect(payload, key="test_secret") == ""


def test_unprotect_missing_payload_returns_empty_string():
    protector = build_local_secret_protector()

    assert protector.unprotect(None, key="test_secret") == ""


def test_keychain_protect_and_unprotect_round_trip_via_security_cli():
    protector = LocalSecretProtector(scheme="keychain")
    stored: dict[str, str] = {}

    def fake_run(args, **kwargs):
        if args[1] == "add-generic-password":
            stored[args[4]] = args[-1]
            return subprocess.CompletedProcess(args, 0)
        if args[1] == "find-generic-password":
            account = args[3]
            return subprocess.CompletedProcess(args, 0, stdout=stored.get(account, ""))
        raise AssertionError(f"unexpected security invocation: {args}")

    with patch("app.features.shared.services.secure_storage.subprocess.run", side_effect=fake_run):
        payload = protector.protect("keychain-secret", key="strava_access_token")
        assert payload["scheme"] == "keychain"
        assert payload["cipher_text"] == "strava_access_token"

        recovered = protector.unprotect(payload, key="strava_access_token")

    assert recovered == "keychain-secret"


def test_keychain_falls_back_to_base64_when_security_cli_fails():
    protector = LocalSecretProtector(scheme="keychain")

    with patch(
        "app.features.shared.services.secure_storage.subprocess.run",
        side_effect=subprocess.CalledProcessError(1, ["security"]),
    ):
        payload = protector.protect("keychain-secret", key="strava_access_token")

    assert payload["scheme"] == "base64-fallback"
    assert protector.unprotect(payload, key="strava_access_token") == "keychain-secret"


def test_libsecret_protect_and_unprotect_round_trip_via_secret_tool_cli():
    protector = LocalSecretProtector(scheme="libsecret")
    stored: dict[str, str] = {}

    def fake_run(args, **kwargs):
        if args[1] == "store":
            stored[args[-1]] = kwargs.get("input", "")
            return subprocess.CompletedProcess(args, 0)
        if args[1] == "lookup":
            key = args[-1]
            return subprocess.CompletedProcess(args, 0, stdout=stored.get(key, ""))
        raise AssertionError(f"unexpected secret-tool invocation: {args}")

    with patch("app.features.shared.services.secure_storage.subprocess.run", side_effect=fake_run):
        payload = protector.protect("libsecret-secret", key="strava_refresh_token")
        assert payload["scheme"] == "libsecret"
        assert payload["cipher_text"] == "strava_refresh_token"

        recovered = protector.unprotect(payload, key="strava_refresh_token")

    assert recovered == "libsecret-secret"


def test_libsecret_falls_back_to_base64_when_secret_tool_missing():
    protector = LocalSecretProtector(scheme="libsecret")

    with patch(
        "app.features.shared.services.secure_storage.subprocess.run",
        side_effect=FileNotFoundError("secret-tool not found"),
    ):
        payload = protector.protect("libsecret-secret", key="strava_refresh_token")

    assert payload["scheme"] == "base64-fallback"
    assert protector.unprotect(payload, key="strava_refresh_token") == "libsecret-secret"


def test_libsecret_unprotect_returns_empty_string_when_lookup_fails():
    protector = LocalSecretProtector(scheme="libsecret")

    with patch(
        "app.features.shared.services.secure_storage.subprocess.run",
        side_effect=subprocess.CalledProcessError(1, ["secret-tool"]),
    ):
        recovered = protector.unprotect(
            {"scheme": "libsecret", "cipher_text": "strava_refresh_token"},
            key="strava_refresh_token",
        )

    assert recovered == ""


def test_build_local_secret_protector_uses_base64_fallback_under_pytest():
    protector = build_local_secret_protector()

    assert protector.scheme == "base64-fallback"


def test_serialized_runtime_payload_does_not_store_plaintext_tokens():
    with shared_state._lock:
        shared_state._integration_runtime["strava"]["access_token"] = "plain-access"
        shared_state._integration_runtime["strava"]["refresh_token"] = "plain-refresh"

        payload = shared_state._serialized_runtime_payload_unlocked()
        strava_payload = payload["strava"]

    assert "access_token" not in strava_payload
    assert "refresh_token" not in strava_payload
    assert strava_payload["access_token_protected"]["cipher_text"] != "plain-access"
    assert strava_payload["refresh_token_protected"]["cipher_text"] != "plain-refresh"
