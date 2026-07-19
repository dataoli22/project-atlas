from __future__ import annotations

import hashlib
import hmac
import os
from dataclasses import dataclass


_PBKDF2_ITERATIONS = 200_000
_SALT_BYTES = 16


@dataclass(frozen=True)
class HashedPin:
    salt_hex: str
    hash_hex: str
    iterations: int = _PBKDF2_ITERATIONS


def hash_pin(pin: str) -> HashedPin:
    """One-way hash a short code (PIN or device pairing token) for local verification.

    Never store or log the raw value. Deliberately verify-only (no way to recover the original
    from the hash), unlike the OS-native secret storage used for OAuth tokens - callers that need
    recovery, not just verification, should not use this.
    """

    salt = os.urandom(_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt, _PBKDF2_ITERATIONS)
    return HashedPin(salt_hex=salt.hex(), hash_hex=digest.hex())


def verify_pin(pin: str, *, salt_hex: str, hash_hex: str, iterations: int = _PBKDF2_ITERATIONS) -> bool:
    try:
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
    except ValueError:
        return False

    candidate = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(candidate, expected)
