from __future__ import annotations

import secrets
import socket
from datetime import datetime, timedelta, timezone

PAIRING_CODE_TTL_MINUTES = 5

# A 6-digit code has only 1,000,000 possibilities - bounding guesses per code matters far more
# here than per-request rate limiting. After this many wrong attempts the code is invalidated
# outright and a fresh one must be started on the desktop, which a remote attacker cannot do.
MAX_PAIRING_ATTEMPTS = 5


def generate_pairing_code() -> str:
    """A short, human-typeable code shown on the desktop screen and entered on the phone."""
    return f"{secrets.randbelow(1_000_000):06d}"


def generate_device_token() -> str:
    """Long-lived bearer credential for a paired device. Never logged or echoed back after issue."""
    return secrets.token_urlsafe(32)


def generate_device_id() -> str:
    return secrets.token_hex(8)


def pairing_code_expiry(*, now: datetime | None = None) -> str:
    base = now or datetime.now(timezone.utc)
    return (base + timedelta(minutes=PAIRING_CODE_TTL_MINUTES)).isoformat()


def is_expired(expires_at: str, *, now: datetime | None = None) -> bool:
    try:
        deadline = datetime.fromisoformat(expires_at)
    except ValueError:
        return True
    current = now or datetime.now(timezone.utc)
    return current >= deadline


def detect_lan_addresses() -> list[str]:
    """Best-effort local network IPv4 addresses this machine can be reached at.

    This does not guarantee the API is actually listening on these interfaces - that depends on
    the bind host the sidecar was launched with (see docs/packaging-and-installation.md's LAN
    pairing section). It only reports what a phone on the same network could try.
    """
    addresses: set[str] = set()

    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            candidate = info[4][0]
            if candidate and not candidate.startswith("127."):
                addresses.add(candidate)
    except OSError:
        pass

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.settimeout(0.2)
            probe.connect(("10.255.255.255", 1))
            candidate = probe.getsockname()[0]
            if candidate and not candidate.startswith("127."):
                addresses.add(candidate)
    except OSError:
        pass

    return sorted(addresses)
