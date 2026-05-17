"""Change an admin/owner email and password from the terminal.

Usage:
  python scripts/change_admin_credentials.py

The password is never echoed or stored as plain text.
"""
from __future__ import annotations

from getpass import getpass
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.main import db, hash_password, init_db, now_iso


def prompt_required(label: str) -> str:
    value = input(label).strip()
    while not value:
        print("هذا الحقل مطلوب.")
        value = input(label).strip()
    return value


def main() -> None:
    init_db()
    current_email = prompt_required("الإيميل الحالي للأدمن: ").lower()
    new_email = prompt_required("الإيميل الجديد: ").lower()

    password = getpass("الباسورد الجديد: ")
    confirm = getpass("تأكيد الباسورد الجديد: ")
    if password != confirm:
        raise SystemExit("تأكيد الباسورد غير مطابق.")
    if len(password) < 8:
        raise SystemExit("الباسورد لازم يكون 8 أحرف على الأقل.")

    password_hash, salt = hash_password(password)
    with db() as conn:
        admin = conn.execute("SELECT * FROM admins WHERE lower(email) = lower(?)", (current_email,)).fetchone()
        if not admin:
            raise SystemExit("لم يتم العثور على حساب بهذا الإيميل.")

        duplicate = conn.execute(
            "SELECT id FROM admins WHERE lower(email) = lower(?) AND id != ?",
            (new_email, admin["id"]),
        ).fetchone()
        if duplicate:
            raise SystemExit("الإيميل الجديد مستخدم بالفعل في حساب آخر.")

        conn.execute(
            """
            UPDATE admins
            SET email = ?, password_hash = ?, password_salt = ?,
                must_change_password = FALSE, updated_at = ?
            WHERE id = ?
            """,
            (new_email, password_hash, salt, now_iso(), admin["id"]),
        )

    print("تم تحديث إيميل وباسورد الأدمن بنجاح.")
    print(f"الإيميل الجديد: {new_email}")


if __name__ == "__main__":
    main()
