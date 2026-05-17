"""Reset/create the local development owner account.

Usage:
  python scripts/reset_owner_password.py

This script is for local development recovery only. Change credentials before production use.
"""
from __future__ import annotations

from datetime import datetime, timezone
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.main import db, hash_password, public_id, init_db

DEFAULT_EMAIL = "admin@example.com"
DEFAULT_PASSWORD = "Admin@12345"
DEFAULT_NAME = "المدير الرئيسي"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def main() -> None:
    init_db()
    password_hash, salt = hash_password(DEFAULT_PASSWORD)
    with db() as conn:
        existing = conn.execute("SELECT id FROM admins WHERE lower(email) = lower(?)", (DEFAULT_EMAIL,)).fetchone()
        if existing:
            conn.execute(
                """
                UPDATE admins
                SET full_name = ?, role = 'owner', password_hash = ?, password_salt = ?, is_active = TRUE, updated_at = ?
                WHERE id = ?
                """,
                (DEFAULT_NAME, password_hash, salt, now_iso(), existing["id"]),
            )
            action = "updated"
        else:
            conn.execute(
                """
                INSERT INTO admins (id, full_name, email, role, password_hash, password_salt, is_active, created_at, updated_at)
                VALUES (?, ?, ?, 'owner', ?, ?, TRUE, ?, ?)
                """,
                (public_id("admin"), DEFAULT_NAME, DEFAULT_EMAIL, password_hash, salt, now_iso(), now_iso()),
            )
            action = "created"
    print(f"Owner account {action} successfully.")
    print(f"Email: {DEFAULT_EMAIL}")
    print(f"Password: {DEFAULT_PASSWORD}")


if __name__ == "__main__":
    main()
