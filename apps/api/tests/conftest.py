from pathlib import Path
import sys

import pytest
from fastapi.testclient import TestClient


API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.main import app
from app.features.shared.services.state import shared_state


@pytest.fixture(autouse=True)
def restore_shared_state():
    with shared_state._lock:
        snapshot = {
            "preferences": shared_state._preferences.model_copy(deep=True),
            "profile": shared_state._profile.model_copy(deep=True),
            "localization": shared_state._localization.model_copy(deep=True),
            "ai_settings": shared_state._ai_settings.model_copy(deep=True),
            "integrations": {
                key: value.model_copy(deep=True) for key, value in shared_state._integrations.items()
            },
            "integration_runtime": {
                key: value.copy() for key, value in shared_state._integration_runtime.items()
            },
            "nutrition_runtime": {
                "swap_history": [dict(entry) for entry in shared_state._nutrition_runtime["swap_history"]],
                "last_refreshed_at": shared_state._nutrition_runtime["last_refreshed_at"],
                "refresh_due_at": shared_state._nutrition_runtime["refresh_due_at"],
                "refresh_reason": shared_state._nutrition_runtime["refresh_reason"],
                "pantry_items": list(shared_state._nutrition_runtime["pantry_items"]),
            },
            "app_lock": dict(shared_state._app_lock),
            "pairing": {
                "pending_code": shared_state._pairing["pending_code"],
                "pending_expires_at": shared_state._pairing["pending_expires_at"],
                "attempts": shared_state._pairing["attempts"],
                "devices": {key: dict(value) for key, value in shared_state._pairing["devices"].items()},
            },
            "ollama_api_key": shared_state._ollama_api_key,
            "groq_api_key": shared_state._groq_api_key,
            "brave_api_key": shared_state._brave_api_key,
        }

    yield

    with shared_state._lock:
        shared_state._preferences = snapshot["preferences"]
        shared_state._profile = snapshot["profile"]
        shared_state._localization = snapshot["localization"]
        shared_state._ai_settings = snapshot["ai_settings"]
        shared_state._integrations = snapshot["integrations"]
        shared_state._integration_runtime = snapshot["integration_runtime"]
        shared_state._nutrition_runtime = snapshot["nutrition_runtime"]
        shared_state._app_lock = snapshot["app_lock"]
        shared_state._pairing = snapshot["pairing"]
        shared_state._pairing_start_call_times = []
        shared_state._ollama_api_key = snapshot["ollama_api_key"]
        shared_state._groq_api_key = snapshot["groq_api_key"]
        shared_state._brave_api_key = snapshot["brave_api_key"]


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
