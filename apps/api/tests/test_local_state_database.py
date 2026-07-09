import json
from pathlib import Path

import pytest

from app.features.shared.services.db import _MIGRATIONS, LocalStateDatabase


def test_set_and_get_json_round_trips(tmp_path: Path):
    db = LocalStateDatabase(tmp_path / "atlas.db")

    db.set_json("shared_state", {"integrations": {"strava": {"connected": True}}})

    assert db.get_json("shared_state") == {"integrations": {"strava": {"connected": True}}}
    db.close()


def test_get_json_missing_key_returns_none(tmp_path: Path):
    db = LocalStateDatabase(tmp_path / "atlas.db")

    assert db.get_json("does_not_exist") is None
    db.close()


def test_set_json_overwrites_existing_key(tmp_path: Path):
    db = LocalStateDatabase(tmp_path / "atlas.db")

    db.set_json("shared_state", {"version": 1})
    db.set_json("shared_state", {"version": 2})

    assert db.get_json("shared_state") == {"version": 2}
    db.close()


def test_state_survives_reopening_the_same_file(tmp_path: Path):
    db_path = tmp_path / "atlas.db"

    first = LocalStateDatabase(db_path)
    first.set_json("shared_state", {"persisted": True})
    first.close()

    second = LocalStateDatabase(db_path)
    assert second.get_json("shared_state") == {"persisted": True}
    second.close()


def test_migration_creates_versioned_schema(tmp_path: Path):
    db_path = tmp_path / "atlas.db"
    db = LocalStateDatabase(db_path)
    db.close()

    import sqlite3

    connection = sqlite3.connect(str(db_path))
    version = connection.execute("PRAGMA user_version").fetchone()[0]
    tables = {
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        ).fetchall()
    }
    connection.close()

    assert version >= 1
    assert "app_state" in tables


def test_reopening_is_idempotent_and_does_not_reset_version(tmp_path: Path):
    db_path = tmp_path / "atlas.db"

    LocalStateDatabase(db_path).close()
    LocalStateDatabase(db_path).close()

    import sqlite3

    connection = sqlite3.connect(str(db_path))
    version = connection.execute("PRAGMA user_version").fetchone()[0]
    row_count = connection.execute("SELECT COUNT(*) FROM app_state").fetchone()[0]
    connection.close()

    assert version == len(_MIGRATIONS)
    assert row_count == 0


def test_export_all_returns_every_stored_key(tmp_path: Path):
    db = LocalStateDatabase(tmp_path / "atlas.db")

    db.set_many_json({"shared_state": {"a": 1}, "other_key": [1, 2, 3]})

    assert db.export_all() == {"shared_state": {"a": 1}, "other_key": [1, 2, 3]}
    db.close()


def test_sync_history_records_and_lists_most_recent_first(tmp_path: Path):
    db = LocalStateDatabase(tmp_path / "atlas.db")

    db.record_sync_event(source="strava", status="ok", detail={"activities": 3})
    db.record_sync_event(source="strava", status="ok", detail={"activities": 5})
    db.record_sync_event(source="health_connect", status="ok", detail={})

    strava_history = db.list_sync_history(source="strava")
    assert [entry["detail"]["activities"] for entry in strava_history] == [5, 3]

    all_history = db.list_sync_history()
    assert len(all_history) == 3
    db.close()


def test_sync_history_is_capped_per_source(tmp_path: Path):
    db = LocalStateDatabase(tmp_path / "atlas.db")

    for i in range(60):
        db.record_sync_event(source="strava", status="ok", detail={"i": i})

    history = db.list_sync_history(source="strava", limit=100)
    assert len(history) == 50
    assert history[0]["detail"]["i"] == 59
    db.close()


def test_planner_generation_history_records_and_lists_most_recent_first(tmp_path: Path):
    db = LocalStateDatabase(tmp_path / "atlas.db")

    db.record_planner_generation(reason="scheduled", plan_snapshot={"week": 1})
    db.record_planner_generation(reason="manual", plan_snapshot={"week": 2})

    history = db.list_planner_generation_history()
    assert [entry["reason"] for entry in history] == ["manual", "scheduled"]
    db.close()


def test_set_many_json_writes_multiple_keys_atomically(tmp_path: Path):
    db = LocalStateDatabase(tmp_path / "atlas.db")

    db.set_many_json({"a": {"x": 1}, "b": {"y": 2}})

    assert db.get_json("a") == {"x": 1}
    assert db.get_json("b") == {"y": 2}
    assert set(db.all_keys()) == {"a", "b"}
    db.close()


def test_is_empty_reflects_row_presence(tmp_path: Path):
    db = LocalStateDatabase(tmp_path / "atlas.db")

    assert db.is_empty() is True
    db.set_json("shared_state", {"anything": True})
    assert db.is_empty() is False
    db.close()


def test_corrupt_db_file_raises_rather_than_silently_losing_data(tmp_path: Path):
    db_path = tmp_path / "atlas.db"
    db_path.write_text("not a sqlite file", encoding="utf-8")

    with pytest.raises(Exception):
        db = LocalStateDatabase(db_path)
        db.get_json("shared_state")
