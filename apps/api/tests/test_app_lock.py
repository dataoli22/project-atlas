from app.features.shared.schemas.app import AppLockUpdateRequest
from app.features.shared.services.app_lock import hash_pin, verify_pin
from app.features.shared.services.state import shared_state


def test_hash_pin_round_trips_via_verify_pin():
    hashed = hash_pin("1234")

    assert verify_pin("1234", salt_hex=hashed.salt_hex, hash_hex=hashed.hash_hex, iterations=hashed.iterations)
    assert not verify_pin("9999", salt_hex=hashed.salt_hex, hash_hex=hashed.hash_hex, iterations=hashed.iterations)


def test_hash_pin_uses_a_fresh_salt_each_time():
    first = hash_pin("1234")
    second = hash_pin("1234")

    assert first.salt_hex != second.salt_hex
    assert first.hash_hex != second.hash_hex


def test_verify_pin_rejects_malformed_stored_hash():
    assert not verify_pin("1234", salt_hex="not-hex", hash_hex="also-not-hex", iterations=200_000)


def test_app_lock_disabled_by_default():
    settings = shared_state.get_app_lock_settings()

    assert settings.enabled is False
    assert settings.has_pin is False


def test_enable_app_lock_requires_pin():
    try:
        shared_state.update_app_lock(AppLockUpdateRequest(enabled=True))
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "PIN is required" in str(exc)


def test_enable_app_lock_with_pin_then_verify():
    settings = shared_state.update_app_lock(AppLockUpdateRequest(enabled=True, pin="4242"))

    assert settings.enabled is True
    assert settings.has_pin is True
    assert shared_state.verify_app_lock_pin("4242") is True
    assert shared_state.verify_app_lock_pin("0000") is False


def test_changing_pin_requires_current_pin():
    shared_state.update_app_lock(AppLockUpdateRequest(enabled=True, pin="4242"))

    try:
        shared_state.update_app_lock(AppLockUpdateRequest(enabled=True, pin="9999"))
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "current PIN" in str(exc)

    updated = shared_state.update_app_lock(
        AppLockUpdateRequest(enabled=True, pin="9999", current_pin="4242")
    )
    assert updated.enabled is True
    assert shared_state.verify_app_lock_pin("9999") is True
    assert shared_state.verify_app_lock_pin("4242") is False


def test_disabling_app_lock_requires_current_pin():
    shared_state.update_app_lock(AppLockUpdateRequest(enabled=True, pin="4242"))

    try:
        shared_state.update_app_lock(AppLockUpdateRequest(enabled=False))
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "current PIN" in str(exc)

    disabled = shared_state.update_app_lock(
        AppLockUpdateRequest(enabled=False, current_pin="4242")
    )
    assert disabled.enabled is False
    assert disabled.has_pin is False


def test_verify_pin_when_lock_disabled_always_true():
    assert shared_state.verify_app_lock_pin("anything") is True


def test_app_lock_router_endpoints(client):
    initial = client.get("/api/v1/app/lock")
    assert initial.status_code == 200
    assert initial.json()["enabled"] is False

    enabled = client.put("/api/v1/app/lock", json={"enabled": True, "pin": "1357"})
    assert enabled.status_code == 200
    assert enabled.json()["enabled"] is True
    assert enabled.json()["has_pin"] is True

    correct = client.post("/api/v1/app/lock/verify", json={"pin": "1357"})
    assert correct.status_code == 200
    assert correct.json()["unlocked"] is True

    wrong = client.post("/api/v1/app/lock/verify", json={"pin": "0000"})
    assert wrong.status_code == 200
    assert wrong.json()["unlocked"] is False

    blocked_disable = client.put("/api/v1/app/lock", json={"enabled": False})
    assert blocked_disable.status_code == 400

    disabled = client.put(
        "/api/v1/app/lock", json={"enabled": False, "current_pin": "1357"}
    )
    assert disabled.status_code == 200
    assert disabled.json()["enabled"] is False
