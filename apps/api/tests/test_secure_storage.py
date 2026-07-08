from app.features.shared.services.secure_storage import build_local_secret_protector
from app.features.shared.services.state import shared_state


def test_local_secret_protector_round_trips_secret():
    protector = build_local_secret_protector()

    payload = protector.protect("secret-token-value")

    assert payload["scheme"] == "base64-fallback"
    assert payload["cipher_text"] != "secret-token-value"
    assert protector.unprotect(payload) == "secret-token-value"


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
