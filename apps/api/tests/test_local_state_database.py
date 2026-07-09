import json
from pathlib import Path

import pytest

from app.features.shared.services.db import LocalStateDatabase


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

    assert version == 1
    assert row_count == 0


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
