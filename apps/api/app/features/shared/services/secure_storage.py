from __future__ import annotations

import base64
import os
import sys
from dataclasses import dataclass
from typing import TypedDict


class ProtectedSecretPayload(TypedDict):
    cipher_text: str
    scheme: str


@dataclass(frozen=True)
class LocalSecretProtector:
    scheme: str

    def protect(self, secret: str) -> ProtectedSecretPayload:
        if not secret:
            return {"scheme": self.scheme, "cipher_text": ""}

        if self.scheme == "dpapi":
            return {
                "scheme": self.scheme,
                "cipher_text": _protect_with_dpapi(secret),
            }

        return {
            "scheme": self.scheme,
            "cipher_text": base64.b64encode(secret.encode("utf-8")).decode("ascii"),
        }

    def unprotect(self, payload: ProtectedSecretPayload | None) -> str:
        if not payload:
            return ""

        cipher_text = payload.get("cipher_text", "")
        if not cipher_text:
            return ""

        if payload.get("scheme") == "dpapi":
            return _unprotect_with_dpapi(cipher_text)

        return base64.b64decode(cipher_text.encode("ascii")).decode("utf-8")


def build_local_secret_protector() -> LocalSecretProtector:
    if _supports_dpapi():
        return LocalSecretProtector(scheme="dpapi")
    return LocalSecretProtector(scheme="base64-fallback")


def _supports_dpapi() -> bool:
    if "PYTEST_CURRENT_TEST" in os.environ:
        return False
    return sys.platform == "win32"


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
