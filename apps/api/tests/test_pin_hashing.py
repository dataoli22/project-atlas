from app.features.shared.services.app_lock import hash_pin, verify_pin


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
