from fastapi import APIRouter, HTTPException

from app.features.shared.schemas.app import (
    PairedDevice,
    PairingConfirmRequest,
    PairingConfirmResponse,
    PairingStartResponse,
)
from app.features.shared.services.state import PairingRateLimitedError, shared_state

router = APIRouter(prefix="/pairing")


@router.post("/start", response_model=PairingStartResponse)
def start_pairing() -> PairingStartResponse:
    """Called from the desktop app when the user opens the phone-pairing screen.

    Generates a short-lived code shown on the desktop and typed into the companion mobile app.
    Requires the desktop to actually be reachable on the reported LAN addresses - see
    docs/packaging-and-installation.md's LAN pairing section for the ATLAS_API_HOST=0.0.0.0
    requirement.
    """
    try:
        return shared_state.start_device_pairing()
    except PairingRateLimitedError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc


@router.post("/confirm", response_model=PairingConfirmResponse)
def confirm_pairing(payload: PairingConfirmRequest) -> PairingConfirmResponse:
    """Called from the phone after the user types in the code shown on the desktop.

    Returns a long-lived device token, shown to the caller exactly once - the phone must store
    it locally and send it as a bearer credential on subsequent sync calls. Atlas never re-issues
    or displays a lost token; the user must re-pair the device.
    """
    try:
        return shared_state.confirm_device_pairing(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/devices", response_model=list[PairedDevice])
def list_paired_devices() -> list[PairedDevice]:
    return shared_state.get_paired_devices()


@router.delete("/devices/{device_id}", response_model=list[PairedDevice])
def revoke_paired_device(device_id: str) -> list[PairedDevice]:
    try:
        shared_state.revoke_paired_device(device_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return shared_state.get_paired_devices()
