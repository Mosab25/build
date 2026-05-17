"""PostgreSQL schema initialization for the stabilized reservation system."""
from __future__ import annotations

from app.config import MIGRATIONS_DIR
from app.utils.db_utils import db
from scripts.seed_postgresql import seed_apartments, seed_owner, seed_settings


MIGRATION_PATH = MIGRATIONS_DIR / "001_postgresql_schema.sql"
SCHEMA_SQL = MIGRATION_PATH.read_text(encoding="utf-8")


def apply_migrations() -> None:
    """Apply all pending migrations in order."""
    with db() as conn:
        # Apply 002_assistant_hardening migration
        migration_002_path = MIGRATIONS_DIR / "002_assistant_hardening.sql"
        if migration_002_path.exists():
            migration_002_sql = migration_002_path.read_text(encoding="utf-8")
            conn.executescript(migration_002_sql)


def init_db() -> None:
    """Create PostgreSQL tables/indexes and seed required defaults."""
    with db() as conn:
        conn.executescript(SCHEMA_SQL)
        seed_owner(conn)
        seed_settings(conn)
        seed_apartments(conn)
    apply_migrations()


if __name__ == "__main__":
    init_db()
    print("PostgreSQL schema initialized.")
