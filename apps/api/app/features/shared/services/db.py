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

    def get_daily_limit_count(self, *, limit_key: str, day: str) -> int:
        row = self._connection.execute(
            "SELECT call_count FROM daily_rate_limits WHERE limit_key = ? AND day = ?",
            (limit_key, day),
        ).fetchone()
        return row[0] if row else 0

    def check_and_increment_daily_limit(self, *, limit_key: str, max_per_day: int, day: str) -> bool:
        """Atomically checks the current UTC-day count for `limit_key` against `max_per_day` and,
        if under the cap, increments and returns True. Returns False without incrementing once
        the cap is hit for the day - callers should surface that as a clear "try again tomorrow"
        message, not silently degrade or fabricate a result."""
        with self._transaction() as connection:
            row = connection.execute(
                "SELECT call_count FROM daily_rate_limits WHERE limit_key = ? AND day = ?",
                (limit_key, day),
            ).fetchone()
            current_count = row[0] if row else 0
            if current_count >= max_per_day:
                return False
            connection.execute(
                """
                INSERT INTO daily_rate_limits (limit_key, day, call_count)
                VALUES (?, ?, 1)
                ON CONFLICT(limit_key, day) DO UPDATE SET call_count = call_count + 1
                """,
                (limit_key, day),
            )
            return True

    def get_nutrition_preferences(self) -> dict | None:
        row = self._connection.execute(
            "SELECT cuisines, shop_frequency_per_week, meal_types, avg_cook_time_minutes, updated_at, "
            "health_conditions, allergens, planning_note "
            "FROM nutrition_preferences WHERE id = 1",
        ).fetchone()
        if row is None:
            return None
        return {
            "cuisines": json.loads(row[0]),
            "shop_frequency_per_week": row[1],
            "meal_types": json.loads(row[2]),
            "avg_cook_time_minutes": row[3],
            "updated_at": row[4],
            "health_conditions": json.loads(row[5]) if row[5] else [],
            "allergens": json.loads(row[6]) if row[6] else [],
            "planning_note": row[7] or "",
        }

    def set_nutrition_preferences(
        self,
        *,
        cuisines: list[str],
        shop_frequency_per_week: int,
        meal_types: list[str],
        avg_cook_time_minutes: int,
        health_conditions: list[str],
        allergens: list[str],
        planning_note: str,
    ) -> None:
        with self._transaction() as connection:
            connection.execute(
                """
                INSERT INTO nutrition_preferences (
                    id, cuisines, shop_frequency_per_week, meal_types, avg_cook_time_minutes, updated_at,
                    health_conditions, allergens, planning_note
                )
                VALUES (1, ?, ?, ?, ?, datetime('now'), ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    cuisines = excluded.cuisines,
                    shop_frequency_per_week = excluded.shop_frequency_per_week,
                    meal_types = excluded.meal_types,
                    avg_cook_time_minutes = excluded.avg_cook_time_minutes,
                    updated_at = excluded.updated_at,
                    health_conditions = excluded.health_conditions,
                    allergens = excluded.allergens,
                    planning_note = excluded.planning_note
                """,
                (
                    json.dumps(cuisines),
                    shop_frequency_per_week,
                    json.dumps(meal_types),
                    avg_cook_time_minutes,
                    json.dumps(health_conditions),
                    json.dumps(allergens),
                    planning_note,
                ),
            )

    def get_endurance_goal(self) -> dict | None:
        row = self._connection.execute(
            "SELECT goal_type, target_distance_km, target_time_minutes, target_date, note, updated_at "
            "FROM endurance_goal WHERE id = 1",
        ).fetchone()
        if row is None:
            return None
        return {
            "goal_type": row[0],
            "target_distance_km": row[1],
            "target_time_minutes": row[2],
            "target_date": row[3],
            "note": row[4] or "",
            "updated_at": row[5],
        }

    def set_endurance_goal(
        self,
        *,
        goal_type: str,
        target_distance_km: float,
        target_time_minutes: float | None,
        target_date: str | None,
        note: str,
    ) -> None:
        with self._transaction() as connection:
            connection.execute(
                """
                INSERT INTO endurance_goal (
                    id, goal_type, target_distance_km, target_time_minutes, target_date, note, updated_at
                )
                VALUES (1, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(id) DO UPDATE SET
                    goal_type = excluded.goal_type,
                    target_distance_km = excluded.target_distance_km,
                    target_time_minutes = excluded.target_time_minutes,
                    target_date = excluded.target_date,
                    note = excluded.note,
                    updated_at = excluded.updated_at
                """,
                (goal_type, target_distance_km, target_time_minutes, target_date, note),
            )

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


def _migration_005_daily_rate_limits(connection: sqlite3.Connection) -> None:
    # A persisted (survives app restart), per-UTC-day counter - generic enough to reuse for any
    # future quota-limited external call, not just recipe search. The in-memory sliding-window
    # pattern pairing.py uses (a plain list of call timestamps) doesn't fit here: a 5/day cap
    # needs to survive the app being closed and reopened within the same day, which an in-memory
    # list can't do.
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS daily_rate_limits (
            limit_key TEXT NOT NULL,
            day TEXT NOT NULL,
            call_count INTEGER NOT NULL,
            PRIMARY KEY (limit_key, day)
        )
        """
    )


def _migration_006_nutrition_preferences(connection: sqlite3.Connection) -> None:
    # Single-row (id=1) singleton table for the user's saved nutrition preferences, following the
    # same idempotent CREATE TABLE IF NOT EXISTS + upsert-by-primary-key approach as
    # meal_plan_entries/daily_rate_limits above. A singleton (not one row per "user") because Atlas
    # is a single-device, single-profile local app - there is no multi-user identity anywhere else
    # in this schema either.
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS nutrition_preferences (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            cuisines TEXT NOT NULL,
            shop_frequency_per_week INTEGER NOT NULL,
            meal_types TEXT NOT NULL,
            avg_cook_time_minutes INTEGER NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )


def _migration_007_nutrition_preferences_health_allergens(connection: sqlite3.Connection) -> None:
    # Adds health-condition/allergen multi-selects and a free-text planning note to the existing
    # nutrition_preferences singleton (see migration 006) - ALTER TABLE ADD COLUMN rather than a
    # table rebuild since sqlite supports additive columns and this table only ever has one row.
    existing_columns = {
        row[1] for row in connection.execute("PRAGMA table_info(nutrition_preferences)").fetchall()
    }
    if "health_conditions" not in existing_columns:
        connection.execute("ALTER TABLE nutrition_preferences ADD COLUMN health_conditions TEXT")
    if "allergens" not in existing_columns:
        connection.execute("ALTER TABLE nutrition_preferences ADD COLUMN allergens TEXT")
    if "planning_note" not in existing_columns:
        connection.execute("ALTER TABLE nutrition_preferences ADD COLUMN planning_note TEXT")


def _migration_008_endurance_goal(connection: sqlite3.Connection) -> None:
    # Single-row (id=1) singleton table for the user's saved endurance goal (distance/time
    # target for a real event, e.g. "sprint triathlon" or a 5k), following the same idempotent
    # CREATE TABLE IF NOT EXISTS + upsert-by-primary-key approach as nutrition_preferences
    # (migration 006) above - same reasoning: Atlas is single-device/single-profile, so a
    # singleton row is enough.
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS endurance_goal (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            goal_type TEXT NOT NULL,
            target_distance_km REAL NOT NULL,
            target_time_minutes REAL,
            target_date TEXT,
            note TEXT,
            updated_at TEXT NOT NULL
        )
        """
    )


_MIGRATIONS = [
    _migration_001_initial_schema,
    _migration_002_history_tables,
    _migration_003_meal_plan_entries,
    _migration_004_health_history,
    _migration_005_daily_rate_limits,
    _migration_006_nutrition_preferences,
    _migration_007_nutrition_preferences_health_allergens,
    _migration_008_endurance_goal,
]

_SYNC_HISTORY_LIMIT_PER_SOURCE = 50
_PLANNER_HISTORY_LIMIT = 20
_MEAL_SWAP_HISTORY_LIMIT_PER_MARKET = 50
