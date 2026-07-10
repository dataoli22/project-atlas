import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Not yet wired into app startup - see alembic/README.atlas.md. This lets `app.core.config` be
# imported below without requiring apps/api to already be on sys.path (e.g. when Alembic is
# invoked as a standalone CLI from apps/api, which is the only supported way to run it today).
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Resolve the same on-disk SQLite file db.py's LocalStateDatabase already uses
# (ATLAS_LOCAL_DB_PATH / Settings.local_db_path), rather than hardcoding a path in alembic.ini or
# duplicating the env var name - there is exactly one local database file, and both migration
# systems (db.py's PRAGMA user_version one, and this one) must agree on where it lives.
if "PYTEST_CURRENT_TEST" not in os.environ:
    from app.core.config import get_settings

    db_path = Path(get_settings().local_db_path).resolve()
    config.set_main_option("sqlalchemy.url", f"sqlite:///{db_path.as_posix()}")

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = None

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
