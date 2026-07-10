# Alembic in Atlas — scaffolded, not wired in

This is infrastructure for a future need, not something the running app currently uses.
`app/features/shared/services/db.py`'s `LocalStateDatabase` still owns and migrates the real
schema (`app_state`, `connector_sync_history`, `planner_generation_history`) via its own
`PRAGMA user_version` + `_MIGRATIONS` list, exactly as it did before this scaffold was added. That
system works fine for a small, mostly-KV schema and stays authoritative.

## Why this exists anyway

`db.py`'s own docstring calls out the actual trigger for switching to Alembic: "If Atlas's local
schema grows complex enough to need relational integrity (e.g. a real plan-history table with
foreign keys), reach for Alembic-managed tables at that point." That point hasn't arrived —
nutrition and endurance are still stub data, not real relational models. Scaffolding this now
(config + a no-op baseline revision) means that when a real relational table does show up (a
recipe library with foreign keys into meals, say), whoever builds it can write one Alembic
revision instead of first doing this setup under time pressure.

## What's here

- `../alembic.ini` — `sqlalchemy.url` is deliberately left blank; `env.py` resolves the real path
  at runtime from `app.core.config.get_settings().local_db_path` (the same `ATLAS_LOCAL_DB_PATH`
  env var `db.py` already uses), so there is exactly one source of truth for where the local
  SQLite file lives.
- `env.py` — standard Alembic env, with the path resolution above added and `PYTEST_CURRENT_TEST`
  skipped (matches the same test-isolation gate used elsewhere in the app).
- `versions/..._baseline_adopt_alembic_alongside_.py` — revision zero, a deliberate no-op. See its
  own docstring.

## How to use this once it's actually needed

1. From `apps/api`: `alembic revision -m "add <table>"`, edit the generated file with
   `op.create_table(...)` (or hand-written SQL via `op.execute(...)`).
2. Run it with `alembic upgrade head` from `apps/api`.
3. Wire it into app startup (`main.py`, similar to how `LocalStateDatabase.__init__` runs its own
   migrations) once there's an actual Alembic-managed table for it to apply — don't call
   `alembic upgrade head` at startup while every real revision is still a no-op; there's nothing
   to gain and it adds a dependency to the startup path for zero benefit.
4. Keep `db.py`'s tables and any new Alembic-managed tables cleanly separated: `app_state`,
   `connector_sync_history`, and `planner_generation_history` stay owned by `db.py`. Don't migrate
   them into Alembic unless there's a concrete reason (e.g. they need a foreign key into a new
   Alembic-managed table) — moving working, tested code for its own sake isn't worth the risk to
   already-deployed users' local databases.
