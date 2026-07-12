import os
import tempfile
from pathlib import Path
import sys

import pytest
from fastapi.testclient import TestClient


API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

# Must run before `from app.main import app` below - the shared_state singleton is constructed at
# import time, and SharedStateStore._persistence_disabled() (state.py) checks PYTEST_CURRENT_TEST,
# which pytest only sets once a specific test starts running - too late for a module-level import.
# Without this, the singleton picks up a real LocalStateDatabase pointed at the real dev-machine
# apps/api/.local/atlas.db, so DB-backed state (AI settings, paired devices, meal plans, etc.)
# genuinely persists across separate `pytest` invocations on a dev machine, causing tests whose
# assertions depend on fresh/default state to fail nondeterministically depending on what a
# previous manual run or `pytest` session happened to leave behind. Confirmed: this was the exact
# cause of 4 previously-flaky tests (test_ai_settings.py, test_pairing.py) - they pass reliably
# once each pytest session gets its own throwaway DB/state file.
_TEST_STATE_DIR = tempfile.mkdtemp(prefix="atlas-pytest-state-")
os.environ.setdefault("ATLAS_LOCAL_DB_PATH", str(Path(_TEST_STATE_DIR) / "atlas.db"))
os.environ.setdefault("ATLAS_LOCAL_STATE_PATH", str(Path(_TEST_STATE_DIR) / "shared-state.json"))

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
