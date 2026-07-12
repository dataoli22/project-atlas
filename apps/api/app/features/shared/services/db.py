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

    def upsert_meal_plan_entry(
        self,
        *,
        market_code: str,
        day: str,
        slot: str,
        dish_name: str,
        prep_focus: str,
        cook_time_minutes: int,
        leftover_plan: str,
        ingredients: list[dict],
        source: str,
    ) -> None:
        with self._transaction() as connection:
            connection.execute(
                """
                INSERT INTO meal_plan_entries (
                    market_code, day, slot, dish_name, prep_focus, cook_time_minutes,
                    leftover_plan, ingredients, source, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(market_code, day, slot) DO UPDATE SET
                    dish_name = excluded.dish_name,
                    prep_focus = excluded.prep_focus,
                    cook_time_minutes = excluded.cook_time_minutes,
                    leftover_plan = excluded.leftover_plan,
                    ingredients = excluded.ingredients,
                    source = excluded.source,
                    updated_at = excluded.updated_at
                """,
                (
                    market_code,
                    day,
                    slot,
                    dish_name,
                    prep_focus,
                    cook_time_minutes,
                    leftover_plan,
                    json.dumps(ingredients),
                    source,
                ),
            )

    def list_meal_plan_entries(self, *, market_code: str) -> list[dict]:
        rows = self._connection.execute(
            """
            SELECT day, slot, dish_name, prep_focus, cook_time_minutes, leftover_plan,
                   ingredients, source, updated_at
            FROM meal_plan_entries
            WHERE market_code = ?
            ORDER BY id ASC
            """,
            (market_code,),
        ).fetchall()
        return [
            {
                "day": row[0],
                "slot": row[1],
                "dish_name": row[2],
                "prep_focus": row[3],
                "cook_time_minutes": row[4],
                "leftover_plan": row[5],
                "ingredients": json.loads(row[6]),
                "source": row[7],
                "updated_at": row[8],
            }
            for row in rows
        ]

    def record_meal_swap(
        self,
        *,
        market_code: str,
        day: str,
        slot: str,
        previous_dish_name: str | None,
        new_dish_name: str,
        reason: str,
        changed_by: str,
    ) -> None:
        with self._transaction() as connection:
            connection.execute(
                """
                INSERT INTO meal_plan_swap_history (
                    market_code, day, slot, previous_dish_name, new_dish_name, reason,
                    changed_by, changed_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                """,
                (market_code, day, slot, previous_dish_name, new_dish_name, reason, changed_by),
            )
            connection.execute(
                """
                DELETE FROM meal_plan_swap_history
                WHERE market_code = ? AND id NOT IN (
                    SELECT id FROM meal_plan_swap_history
                    WHERE market_code = ? ORDER BY id DESC LIMIT ?
                )
                """,
                (market_code, market_code, _MEAL_SWAP_HISTORY_LIMIT_PER_MARKET),
            )

    def list_meal_swap_history(self, *, market_code: str, limit: int = 20) -> list[dict]:
        rows = self._connection.execute(
            """
            SELECT day, slot, previous_dish_name, new_dish_name, reason, changed_by, changed_at
            FROM meal_plan_swap_history
            WHERE market_code = ?
            ORDER BY id DESC LIMIT ?
            """,
            (market_code, limit),
        ).fetchall()
        return [
            {
                "day": row[0],
                "slot": row[1],
                "previous_dish_name": row[2],
                "new_dish_name": row[3],
                "reason": row[4],
                "changed_by": row[5],
                "changed_at": row[6],
            }
            for row in rows
        ]

    def record_health_sessions(self, *, source: str, sessions: list[dict]) -> None:
        """Appends real synced sessions (Strava activities, Health Connect/Samsung Health device
        sessions) to permanent history. Previously each sync call *overwrote* the in-memory
        "recent sessions" snapshot in shared_state, silently discarding everything from prior
        syncs - this is the fix, storing every session ever synced. UNIQUE(source, start_date,
        session_label) both dedupes a session re-synced verbatim (idempotent re-sync) and keeps
        genuinely distinct same-timestamp sessions if they have different labels."""
        if not sessions:
            return
        with self._transaction() as connection:
            for session in sessions:
                connection.execute(
                    """
                    INSERT INTO health_sessions (
                        source, session_label, session_type, duration_minutes, distance_km,
                        start_date, synced_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                    ON CONFLICT(source, start_date, session_label) DO UPDATE SET
                        session_type = excluded.session_type,
                        duration_minutes = excluded.duration_minutes,
                        distance_km = excluded.distance_km,
                        synced_at = excluded.synced_at
                    """,
                    (
                        source,
                        str(session.get("session_label", "")),
                        str(session.get("session_type", "")),
                        session.get("duration_minutes"),
                        session.get("distance_km"),
                        str(session.get("start_date", "")),
                    ),
                )

    def query_health_sessions(
        self,
        *,
        source: str | None = None,
        since: str | None = None,
        until: str | None = None,
        limit: int = 50,
    ) -> list[dict]:
        clauses = []
        params: list[object] = []
        if source is not None:
            clauses.append("source = ?")
            params.append(source)
        if since is not None:
            clauses.append("start_date >= ?")
            params.append(since)
        if until is not None:
            clauses.append("start_date <= ?")
            params.append(until)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        params.append(limit)
        rows = self._connection.execute(
            f"""
            SELECT source, session_label, session_type, duration_minutes, distance_km,
                   start_date, synced_at
            FROM health_sessions
            {where}
            ORDER BY start_date DESC
            LIMIT ?
            """,
            params,
        ).fetchall()
        return [
            {
                "source": row[0],
                "session_label": row[1],
                "session_type": row[2],
                "duration_minutes": row[3],
                "distance_km": row[4],
                "start_date": row[5],
                "synced_at": row[6],
            }
            for row in rows
        ]

    def record_health_metric_readings(
        self, *, source: str, recorded_at: str, readings: dict[str, float | int | str | None]
    ) -> None:
        """One row per (source, metric_name, recorded_at) per sync, rather than the previous
        overwrite-the-single-latest-scalar approach - lets `query_health_metric_history` answer
        "what was my resting HR on <date>", not just "what is it right now"."""
        entries = [(name, value) for name, value in readings.items() if value is not None]
        if not entries:
            return
        with self._transaction() as connection:
            for metric_name, value in entries:
                is_numeric = isinstance(value, (int, float)) and not isinstance(value, bool)
                connection.execute(
                    """
                    INSERT INTO health_metric_readings (
                        source, metric_name, value_numeric, value_text, recorded_at
                    )
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(source, metric_name, recorded_at) DO UPDATE SET
                        value_numeric = excluded.value_numeric,
                        value_text = excluded.value_text
                    """,
                    (
                        source,
                        metric_name,
                        float(value) if is_numeric else None,
                        None if is_numeric else str(value),
                        recorded_at,
                    ),
                )

    def query_health_metric_history(
        self,
        *,
        metric_name: str,
        source: str | None = None,
        since: str | None = None,
        until: str | None = None,
        limit: int = 50,
    ) -> list[dict]:
        clauses = ["metric_name = ?"]
        params: list[object] = [metric_name]
        if source is not None:
            clauses.append("source = ?")
            params.append(source)
        if since is not None:
            clauses.append("recorded_at >= ?")
            params.append(since)
        if until is not None:
            clauses.append("recorded_at <= ?")
            params.append(until)
        params.append(limit)
        rows = self._connection.execute(
            f"""
            SELECT source, metric_name, value_numeric, value_text, recorded_at
            FROM health_metric_readings
            WHERE {' AND '.join(clauses)}
            ORDER BY recorded_at DESC
            LIMIT ?
            """,
            params,
        ).fetchall()
        return [
            {
                "source": row[0],
                "metric_name": row[1],
                "value": row[2] if row[2] is not None else row[3],
                "recorded_at": row[4],
            }
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


def _migration_003_meal_plan_entries(connection: sqlite3.Connection) -> None:
    # Real per-meal rows, replacing the static per-market blueprint as the live source of truth.
    # The blueprint now only seeds these rows on first read (nutrition/service.py) - once a row
    # exists here, it's what the shopping list and cooking plan actually derive from, and what a
    # user/chat "swap this meal" edit mutates. UNIQUE(market_code, day, slot) makes seeding and
    # swapping both simple upserts - one current entry per day+slot per market, ever.
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS meal_plan_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            market_code TEXT NOT NULL,
            day TEXT NOT NULL,
            slot TEXT NOT NULL,
            dish_name TEXT NOT NULL,
            prep_focus TEXT NOT NULL,
            cook_time_minutes INTEGER NOT NULL,
            leftover_plan TEXT NOT NULL,
            ingredients TEXT NOT NULL,
            source TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(market_code, day, slot)
        )
        """
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_meal_plan_entries_market "
        "ON meal_plan_entries (market_code)"
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS meal_plan_swap_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            market_code TEXT NOT NULL,
            day TEXT NOT NULL,
            slot TEXT NOT NULL,
            previous_dish_name TEXT,
            new_dish_name TEXT NOT NULL,
            reason TEXT NOT NULL,
            changed_by TEXT NOT NULL,
            changed_at TEXT NOT NULL
        )
        """
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_meal_plan_swap_history_market "
        "ON meal_plan_swap_history (market_code, id DESC)"
    )


def _migration_004_health_history(connection: sqlite3.Connection) -> None:
    # Real accumulating history for synced health/fitness data. Previously each
    # store_{strava,health_connect,samsung_health}_sync call OVERWROTE the in-memory
    # "recent_sessions" list and metric scalars in shared_state on every sync, discarding
    # everything from prior syncs - there was no way to answer "what did I do last month" because
    # last month's data was gone the moment a new sync ran. This table is the fix: every synced
    # session/metric reading is appended (not replaced), so a real query layer (endurance's
    # health_query.py) has actual history to search. UNIQUE(source, start_date, session_label)
    # makes a verbatim re-sync of the same session idempotent rather than a duplicate row.
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS health_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            session_label TEXT NOT NULL,
            session_type TEXT NOT NULL,
            duration_minutes INTEGER,
            distance_km REAL,
            start_date TEXT NOT NULL,
            synced_at TEXT NOT NULL,
            UNIQUE(source, start_date, session_label)
        )
        """
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_health_sessions_start_date "
        "ON health_sessions (start_date DESC)"
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS health_metric_readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            metric_name TEXT NOT NULL,
            value_numeric REAL,
            value_text TEXT,
            recorded_at TEXT NOT NULL,
            UNIQUE(source, metric_name, recorded_at)
        )
        """
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_health_metric_readings_lookup "
        "ON health_metric_readings (metric_name, recorded_at DESC)"
    )


_MIGRATIONS = [
    _migration_001_initial_schema,
    _migration_002_history_tables,
    _migration_003_meal_plan_entries,
    _migration_004_health_history,
]

_SYNC_HISTORY_LIMIT_PER_SOURCE = 50
_PLANNER_HISTORY_LIMIT = 20
_MEAL_SWAP_HISTORY_LIMIT_PER_MARKET = 50
