from __future__ import annotations

import base64
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from typing import TypedDict


ATLAS_KEYCHAIN_SERVICE_PREFIX = "atlas-"
ATLAS_SECRET_TOOL_LABEL_PREFIX = "Atlas "


class ProtectedSecretPayload(TypedDict):
    cipher_text: str
    scheme: str


@dataclass(frozen=True)
class LocalSecretProtector:
    """Protects secrets using the best available OS-native store.

    `key` is a stable logical identifier for the secret (for example
    `"strava_access_token"`). DPAPI and the base64 fallback ignore it - they encrypt/encode the
    secret directly into `cipher_text`, which the caller stores itself. macOS Keychain and Linux
    libsecret are different: they are OS-managed secret *stores*, not encryption oracles. For
    those schemes, `key` becomes the vault entry name, the real secret lives only in the OS
    vault, and `cipher_text` is just that same key echoed back as a non-secret reference so
    `unprotect` knows what to look up.

    Any native backend failure (missing CLI tool, subprocess error, vault locked) falls back to
    the base64 scheme for that one secret rather than raising, so a broken OS vault never blocks
    the app from starting - it only means secrets are protected weaker than intended, which is
    still surfaced via `scheme` in the stored payload.
    """

    scheme: str

    def protect(self, secret: str, *, key: str) -> ProtectedSecretPayload:
        if not secret:
            return {"scheme": self.scheme, "cipher_text": ""}

        if self.scheme == "dpapi":
            return {"scheme": self.scheme, "cipher_text": _protect_with_dpapi(secret)}

        if self.scheme == "keychain":
            try:
                _protect_with_keychain(key, secret)
                return {"scheme": self.scheme, "cipher_text": key}
            except (OSError, subprocess.SubprocessError):
                return _protect_with_base64(secret)

        if self.scheme == "libsecret":
            try:
                _protect_with_libsecret(key, secret)
                return {"scheme": self.scheme, "cipher_text": key}
            except (OSError, subprocess.SubprocessError):
                return _protect_with_base64(secret)

        return _protect_with_base64(secret)

    def unprotect(self, payload: ProtectedSecretPayload | None, *, key: str) -> str:
        if not payload:
            return ""

        cipher_text = payload.get("cipher_text", "")
        if not cipher_text:
            return ""

        scheme = payload.get("scheme")

        if scheme == "dpapi":
            return _unprotect_with_dpapi(cipher_text)

        if scheme == "keychain":
            try:
                return _unprotect_with_keychain(key)
            except (OSError, subprocess.SubprocessError):
                return ""

        if scheme == "libsecret":
            try:
                return _unprotect_with_libsecret(key)
            except (OSError, subprocess.SubprocessError):
                return ""

        return base64.b64decode(cipher_text.encode("ascii")).decode("utf-8")


def build_local_secret_protector() -> LocalSecretProtector:
    if _persistence_test_mode():
        return LocalSecretProtector(scheme="base64-fallback")

    if sys.platform == "win32":
        return LocalSecretProtector(scheme="dpapi")

    if sys.platform == "darwin" and shutil.which("security"):
        return LocalSecretProtector(scheme="keychain")

    if sys.platform.startswith("linux") and shutil.which("secret-tool"):
        return LocalSecretProtector(scheme="libsecret")

    return LocalSecretProtector(scheme="base64-fallback")


def _persistence_test_mode() -> bool:
    return "PYTEST_CURRENT_TEST" in os.environ


def _protect_with_base64(secret: str) -> ProtectedSecretPayload:
    return {
        "scheme": "base64-fallback",
        "cipher_text": base64.b64encode(secret.encode("utf-8")).decode("ascii"),
    }


# --- Windows DPAPI (Credential Manager-backed) --------------------------------------------


def _protect_with_dpapi(secret: str) -> str:
    import ctypes
    from ctypes import wintypes

    class DATA_BLOB(ctypes.Structure):
        _fields_ = [
            ("cbData", wintypes.DWORD),
            ("pbData", ctypes.POINTER(ctypes.c_byte)),
        ]

    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32

    raw = secret.encode("utf-8")
    buffer = ctypes.create_string_buffer(raw, len(raw))
    in_blob = DATA_BLOB(len(raw), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_byte)))
    out_blob = DATA_BLOB()

    if not crypt32.CryptProtectData(
        ctypes.byref(in_blob),
        None,
        None,
        None,
        None,
        0,
        ctypes.byref(out_blob),
    ):
        raise OSError("CryptProtectData failed.")

    try:
        protected_bytes = ctypes.string_at(out_blob.pbData, out_blob.cbData)
        return base64.b64encode(protected_bytes).decode("ascii")
    finally:
        kernel32.LocalFree(out_blob.pbData)


def _unprotect_with_dpapi(cipher_text: str) -> str:
    import ctypes
    from ctypes import wintypes

    class DATA_BLOB(ctypes.Structure):
        _fields_ = [
            ("cbData", wintypes.DWORD),
            ("pbData", ctypes.POINTER(ctypes.c_byte)),
        ]

    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32

    protected = base64.b64decode(cipher_text.encode("ascii"))
    buffer = ctypes.create_string_buffer(protected, len(protected))
    in_blob = DATA_BLOB(len(protected), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_byte)))
    out_blob = DATA_BLOB()

    if not crypt32.CryptUnprotectData(
        ctypes.byref(in_blob),
        None,
        None,
        None,
        None,
        0,
        ctypes.byref(out_blob),
    ):
        raise OSError("CryptUnprotectData failed.")

    try:
        plain_bytes = ctypes.string_at(out_blob.pbData, out_blob.cbData)
        return plain_bytes.decode("utf-8")
    finally:
        kernel32.LocalFree(out_blob.pbData)


# --- macOS Keychain (via the `security` CLI, no extra Python dependency) ------------------


def _keychain_service_name(key: str) -> str:
    return f"{ATLAS_KEYCHAIN_SERVICE_PREFIX}{key}"


def _protect_with_keychain(key: str, secret: str) -> None:
    service = _keychain_service_name(key)
    subprocess.run(
        ["security", "add-generic-password", "-U", "-a", key, "-s", service, "-w", secret],
        check=True,
        capture_output=True,
    )


def _unprotect_with_keychain(key: str) -> str:
    service = _keychain_service_name(key)
    result = subprocess.run(
        ["security", "find-generic-password", "-a", key, "-s", service, "-w"],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip("\n")


# --- Linux libsecret (via the `secret-tool` CLI, no extra Python dependency) --------------


def _unprotect_with_libsecret(key: str) -> str:
    result = subprocess.run(
        ["secret-tool", "lookup", "atlas-key", key],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip("\n")


def _protect_with_libsecret(key: str, secret: str) -> None:
    label = f"{ATLAS_SECRET_TOOL_LABEL_PREFIX}{key}"
    subprocess.run(
        ["secret-tool", "store", "--label", label, "atlas-key", key],
        input=secret,
        check=True,
        capture_output=True,
        text=True,
    )
