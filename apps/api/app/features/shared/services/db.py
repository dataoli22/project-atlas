from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


class LocalStateDatabase:
    """SQLite-backed local state store.

    Atlas is local-first: this is a single-file, single-process, on-device store, not a
    client-server database. The schema is deliberately a small versioned key-value table
    (`app_state`) rather than one table per field. That keeps the migration surface tiny while
    still giving real transactional writes, corruption resistance (SQLite's own guarantees plus
    WAL mode), and a genuine upgrade path across releases via `PRAGMA user_version` - the same
    mechanism Alembic itself would end up driving for a file this size. If Atlas's local schema
    grows complex enough to need relational integrity (e.g. a real plan-history table with
    foreign keys), reach for Alembic-managed tables at that point; until then this stays simple
    and auditable.
    """

    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(str(self._db_path), check_same_thread=False)
        self._connection.execute("PRAGMA journal_mode=WAL")
        self._connection.execute("PRAGMA foreign_keys=ON")
        self._migrate()

    def close(self) -> None:
        self._connection.close()

    def get_json(self, key: str) -> dict | list | None:
        row = self._connection.execute(
            "SELECT value FROM app_state WHERE key = ?", (key,)
        ).fetchone()
        if row is None:
            return None
        return json.loads(row[0])

    def set_json(self, key: str, value: dict | list) -> None:
        payload = json.dumps(value)
        with self._transaction() as connection:
            connection.execute(
                """
                INSERT INTO app_state (key, value, updated_at)
                VALUES (?, ?, datetime('now'))
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
                """,
                (key, payload),
            )

    def set_many_json(self, values: dict[str, dict | list]) -> None:
        with self._transaction() as connection:
            for key, value in values.items():
                connection.execute(
                    """
                    INSERT INTO app_state (key, value, updated_at)
                    VALUES (?, ?, datetime('now'))
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
                    """,
                    (key, json.dumps(value)),
                )

    def all_keys(self) -> list[str]:
        rows = self._connection.execute("SELECT key FROM app_state").fetchall()
        return [row[0] for row in rows]

    def export_all(self) -> dict[str, dict | list]:
        rows = self._connection.execute("SELECT key, value FROM app_state").fetchall()
        return {key: json.loads(value) for key, value in rows}

    def record_sync_event(self, *, source: str, status: str, detail: dict | None = None) -> None:
        with self._transaction() as connection:
            connection.execute(
                """
                INSERT INTO connector_sync_history (source, status, detail, synced_at)
                VALUES (?, ?, ?, datetime('now'))
                """,
                (source, status, json.dumps(detail or {})),
            )
            connection.execute(
                """
                DELETE FROM connector_sync_history
                WHERE source = ? AND id NOT IN (
                    SELECT id FROM connector_sync_history
                    WHERE source = ? ORDER BY id DESC LIMIT ?
                )
                """,
                (source, source, _SYNC_HISTORY_LIMIT_PER_SOURCE),
            )

    def list_sync_history(self, *, source: str | None = None, limit: int = 50) -> list[dict]:
        if source is None:
            rows = self._connection.execute(
                "SELECT source, status, detail, synced_at FROM connector_sync_history "
                "ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
        else:
            rows = self._connection.execute(
                "SELECT source, status, detail, synced_at FROM connector_sync_history "
                "WHERE source = ? ORDER BY id DESC LIMIT ?",
                (source, limit),
            ).fetchall()
        return [
            {
                "source": row[0],
                "status": row[1],
                "detail": json.loads(row[2]) if row[2] else {},
                "synced_at": row[3],
            }
            for row in rows
        ]

    def record_planner_generation(self, *, reason: str, plan_snapshot: dict) -> None:
        with self._transaction() as connection:
            connection.execute(
                """
                INSERT INTO planner_generation_history (reason, plan_snapshot, generated_at)
                VALUES (?, ?, datetime('now'))
                """,
                (reason, json.dumps(plan_snapshot)),
            )
            connection.execute(
                """
                DELETE FROM planner_generation_history
                WHERE id NOT IN (
                    SELECT id FROM planner_generation_history ORDER BY id DESC LIMIT ?
                )
                """,
                (_PLANNER_HISTORY_LIMIT,),
            )

    def list_planner_generation_history(self, *, limit: int = 20) -> list[dict]:
        rows = self._connection.execute(
            "SELECT reason, plan_snapshot, generated_at FROM planner_generation_history "
            "ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [
            {"reason": row[0], "plan_snapshot": json.loads(row[1]), "generated_at": row[2]}
            for row in rows
        ]

    def is_empty(self) -> bool:
        row = self._connection.execute("SELECT COUNT(*) FROM app_state").fetchone()
        return row is None or row[0] == 0

    def health_check(self) -> tuple[bool, str]:
        """Cheap liveness probe for the /health endpoint - a real query, not just "is the
        connection object non-null", so a corrupted or locked file is actually caught."""
        try:
            self._connection.execute("SELECT 1").fetchone()
            return True, f"SQLite reachable at {self._db_path}."
        except sqlite3.Error as exc:
            return False, f"SQLite at {self._db_path} did not respond: {exc}"

    @contextmanager
    def _transaction(self) -> Iterator[sqlite3.Connection]:
        try:
            yield self._connection
            self._connection.commit()
        except Exception:
            self._connection.rollback()
            raise

    def _migrate(self) -> None:
        current_version = self._connection.execute("PRAGMA user_version").fetchone()[0]
        for target_version, migration in enumerate(_MIGRATIONS, start=1):
            if current_version < target_version:
                migration(self._connection)
                self._connection.execute(f"PRAGMA user_version = {target_version}")
        self._connection.commit()


def _migration_001_initial_schema(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS app_state (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )


def _migration_002_history_tables(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS connector_sync_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            status TEXT NOT NULL,
            detail TEXT NOT NULL,
            synced_at TEXT NOT NULL
        )
        """
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_connector_sync_history_source "
        "ON connector_sync_history (source, id DESC)"
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS planner_generation_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reason TEXT NOT NULL,
            plan_snapshot TEXT NOT NULL,
            generated_at TEXT NOT NULL
        )
        """
    )


_MIGRATIONS = [
    _migration_001_initial_schema,
    _migration_002_history_tables,
]

_SYNC_HISTORY_LIMIT_PER_SOURCE = 50
_PLANNER_HISTORY_LIMIT = 20
