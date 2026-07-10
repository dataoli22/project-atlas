from fastapi import Header, HTTPException

from app.core.config import Settings, get_settings
from app.features.shared.schemas.app import UserSummary
from app.features.shared.services.state import shared_state


def get_app_settings() -> Settings:
    return get_settings()


def get_current_user() -> UserSummary:
    return UserSummary(
        id="local-user",
        email="atlas@example.local",
        display_name="Atlas User",
    )


def require_paired_device_if_present(
    x_atlas_device_id: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> None:
    """Validate a paired-device bearer token when one is presented, otherwise allow the request.

    This endpoint has always been reachable without auth from the desktop UI itself (loopback,
    single-user, no accounts - see docs/production-todo.md section 3). Requiring a device token
    unconditionally would break every existing caller. Instead: a companion phone app identifies
    itself with `X-Atlas-Device-Id` + `Authorization: Bearer <token>`; when those headers are
    absent, the request is treated the same as any other local caller. This is intentionally
    permissive - see the LAN pairing section of docs/build-and-run/packaging-and-installation.md for the
    threat-model caveat that anyone able to reach a LAN-bound Atlas at all can still call
    unauthenticated endpoints.
    """
    if x_atlas_device_id is None and authorization is None:
        return

    if x_atlas_device_id is None or authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Device pairing headers were incomplete.")

    token = authorization.removeprefix("Bearer ").strip()
    if not shared_state.verify_device_token(x_atlas_device_id, token):
        raise HTTPException(status_code=401, detail="Device token is invalid or has been revoked.")
