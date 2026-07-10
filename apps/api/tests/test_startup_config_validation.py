from pathlib import Path

import pytest

from app.core.config import Settings, validate_startup_config


def _settings(**overrides) -> Settings:
    payload = {
        "local_db_path": "some/path/atlas.db",
        "local_state_path": "some/path/shared-state.json",
    }
    payload.update(overrides)
    return Settings(**payload)


def test_validate_startup_config_passes_for_writable_paths(tmp_path: Path):
    settings = _settings(
        local_db_path=str(tmp_path / "db" / "atlas.db"),
        local_state_path=str(tmp_path / "state" / "shared-state.json"),
    )

    validate_startup_config(settings)  # should not raise

    assert (tmp_path / "db").is_dir()
    assert (tmp_path / "state").is_dir()


def test_validate_startup_config_raises_clear_error_when_directory_is_a_file(tmp_path: Path):
    blocked = tmp_path / "blocked"
    blocked.write_text("this is a file, not a directory", encoding="utf-8")

    settings = _settings(local_db_path=str(blocked / "atlas.db"))

    with pytest.raises(RuntimeError) as exc_info:
        validate_startup_config(settings)

    assert "local_db_path" in str(exc_info.value)
    assert "ATLAS_LOCAL_DB_PATH" in str(exc_info.value)


def test_validate_startup_config_rejects_invalid_port(tmp_path: Path):
    settings = _settings(
        local_db_path=str(tmp_path / "db" / "atlas.db"),
        local_state_path=str(tmp_path / "state" / "shared-state.json"),
        api_port=99999,
    )

    with pytest.raises(RuntimeError, match="not a valid TCP port"):
        validate_startup_config(settings)
