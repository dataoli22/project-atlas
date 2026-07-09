import os

import pytest

from app.features.shared.schemas.app import (
    AISettingsUpdate,
    LocalizationSettingsUpdate,
    ProfileSettingsUpdate,
)
from app.features.shared.services.state import SharedStateStore


def test_export_backup_via_api_returns_current_state(client):
    response = client.get("/api/v1/backup/export")

    assert response.status_code == 200
    payload = response.json()
    assert payload["backup_format_version"] == 1
    assert isinstance(payload["app_state"], dict)


def test_import_backup_via_api_round_trips_an_export(client):
    exported = client.get("/api/v1/backup/export").json()

    response = client.post("/api/v1/backup/import", json=exported)

    assert response.status_code == 200
    assert "imported_at" in response.json()


def test_import_backup_via_api_rejects_unknown_format_version(client):
    response = client.post(
        "/api/v1/backup/import",
        json={"backup_format_version": 99, "exported_at": "2026-01-01T00:00:00Z", "app_state": {"shared_state": {}}},
    )

    assert response.status_code == 400
    assert "format version" in response.json()["detail"]


@pytest.fixture
def persisted_store(tmp_path, monkeypatch):
    """A SharedStateStore with real SQLite persistence enabled, isolated to tmp_path.

    The pytest-autouse `PYTEST_CURRENT_TEST` check that normally disables persistence in this
    suite is bypassed here on purpose, since this test exists specifically to verify the
    persistence round trip (profile/localization/ai settings/API keys previously never made it
    into the persisted payload - see state.py's _persist_state_unlocked).
    """
    monkeypatch.setattr(SharedStateStore, "_persistence_disabled", lambda self: False)
    monkeypatch.setenv("ATLAS_LOCAL_DB_PATH", str(tmp_path / "atlas.db"))
    monkeypatch.setenv("ATLAS_LOCAL_STATE_PATH", str(tmp_path / "shared-state.json"))
    from app.core.config import get_settings

    get_settings.cache_clear()
    yield SharedStateStore()
    get_settings.cache_clear()


def test_profile_localization_ai_settings_and_api_keys_survive_reload(persisted_store):
    store = persisted_store

    store.update_profile(ProfileSettingsUpdate(primary_goal="Run a marathon", profile_type="endurance"))
    store.update_localization(
        LocalizationSettingsUpdate(market="US", currency="USD", language="en", locale="en-US")
    )
    store.update_ai_settings(
        AISettingsUpdate(
            default_provider="groq",
            local_only_mode=False,
            self_hosted_distribution=True,
            allow_groq=True,
            ollama_base_url="http://localhost:11434",
            ollama_model="llama3.1:8b",
            ollama_embed_model="nomic-embed-text",
            groq_model="llama-3.1-8b-instant",
            groq_api_key="secret-groq-key",
            system_prompt_style="token-lean",
            guardrail_level="strict",
            max_context_items=6,
            max_context_tokens=2400,
            response_token_budget=450,
        )
    )

    reloaded = SharedStateStore()

    assert reloaded.get_profile().primary_goal == "Run a marathon"
    assert reloaded.get_localization().market == "US"
    ai_settings = reloaded.get_ai_settings()
    assert ai_settings.default_provider == "groq"
    assert ai_settings.allow_groq is True
    assert reloaded.get_groq_api_key() == "secret-groq-key"


def test_export_and_import_backup_round_trip(persisted_store):
    store = persisted_store
    store.update_profile(ProfileSettingsUpdate(primary_goal="Run a marathon"))

    backup = store.export_backup()
    assert backup["backup_format_version"] == 1
    assert "shared_state" in backup["app_state"]

    store.update_profile(ProfileSettingsUpdate(primary_goal="Something else"))
    assert store.get_profile().primary_goal == "Something else"

    store.import_backup(backup)

    assert store.get_profile().primary_goal == "Run a marathon"


def test_sync_and_planner_history_are_recorded(persisted_store):
    store = persisted_store
    store.connect_integration("strava")
    store.sync_integration("strava")

    history = store.get_sync_history(source="strava")
    assert len(history) == 1
    assert history[0]["status"] == "sync-stubbed"

    store.record_nutrition_refresh(
        outgoing_entry={"day": "monday"},
        last_refreshed_at="2026-01-01T00:00:00Z",
        refresh_due_at="2026-01-08T00:00:00Z",
        refresh_reason="scheduled",
    )

    planner_history = store.get_planner_generation_history()
    assert len(planner_history) == 1
    assert planner_history[0]["reason"] == "scheduled"
