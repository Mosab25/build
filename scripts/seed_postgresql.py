"""Seed PostgreSQL with the stabilized production defaults.

Usage:
  python scripts/seed_postgresql.py

Requires DATABASE_URL. The script is idempotent: it creates the owner account,
21 apartments, and default settings only when missing.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.utils.db_utils import db, execute, fetchone, fetchval, hash_password, now_iso, public_id


OWNER_EMAIL = "admin@example.com"
OWNER_PASSWORD = "Admin@12345"

DEFAULT_SETTINGS = {
    "office_name": "مكتب مصعب حسن العقاري",
    "office_phone": "01090073517",
    "whatsapp_number": "201090073517",
    "office_address": "أرض عبدالجليل",
    "currency": "EGP",
    "receipt_prefix": "RCPT",
    "statement_footer": "هذا المستند صادر إلكترونيًا من نظام إدارة الحجوزات.",
}


def seed_owner(conn) -> None:
    existing = fetchone(conn, "SELECT id FROM admins WHERE lower(email) = lower(%s)", (OWNER_EMAIL,))
    if existing:
        return
    password_hash, salt = hash_password(OWNER_PASSWORD)
    execute(
        conn,
        """
        INSERT INTO admins (
          id, full_name, email, role, password_hash, password_salt, is_active, created_at, updated_at
        ) VALUES (%s, %s, %s, 'owner', %s, %s, TRUE, %s, %s)
        """,
        (public_id("admin"), "مالك النظام", OWNER_EMAIL, password_hash, salt, now_iso(), now_iso()),
    )


def seed_settings(conn) -> None:
    for key, value in DEFAULT_SETTINGS.items():
        execute(
            conn,
            """
            INSERT INTO settings (key, value, updated_at)
            VALUES (%s, %s, %s)
            ON CONFLICT (key) DO NOTHING
            """,
            (key, value, now_iso()),
        )


def seed_apartments(conn) -> None:
    if (fetchval(conn, "SELECT COUNT(*) FROM apartments") or 0) > 0:
        return
    specs = {
        "A": (137, "بحري قبلي", "North/South Facing", 137 * 13500),
        "B": (125, "بحري", "North Facing", 125 * 14000),
        "C": (120, "قبلي", "South Facing", 120 * 13000),
    }
    for floor in range(1, 8):
        for apt_type, (area, direction_ar, direction_en, price) in specs.items():
            unit_code = f"{apt_type}{floor}01"
            execute(
                conn,
                """
                INSERT INTO apartments (
                  id, unit_code, floor_number, apartment_type, area, direction_ar, direction_en,
                  price, status, assigned_client_id, notes, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'available', NULL, NULL, %s, %s)
                """,
                (
                    f"apt_{unit_code}",
                    unit_code,
                    floor,
                    apt_type,
                    area,
                    direction_ar,
                    direction_en,
                    price,
                    now_iso(),
                    now_iso(),
                ),
            )


def main() -> None:
    with db() as conn:
        seed_owner(conn)
        seed_settings(conn)
        seed_apartments(conn)
    print("PostgreSQL seed completed.")
    print(f"Owner email: {OWNER_EMAIL}")
    print(f"Owner password: {OWNER_PASSWORD}")


if __name__ == "__main__":
    main()
