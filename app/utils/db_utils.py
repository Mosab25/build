"""Database utilities for PostgreSQL connection and helpers.

The production database is PostgreSQL and is configured through DATABASE_URL.
This module keeps the existing legacy ``conn.execute(...).fetchone()``
call sites working while routing all runtime traffic to psycopg2.
"""
from __future__ import annotations

import os
import json
import hashlib
import hmac
import secrets
import uuid
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
except ImportError:
    pass

import psycopg2
import psycopg2.extras
import psycopg2.pool


POOL_MIN_CONNECTIONS = 1
POOL_MAX_CONNECTIONS = 3
SOLD_PAYMENT_THRESHOLD = 20_000
_pool_lock = threading.Lock()
_pool_semaphore = threading.BoundedSemaphore(POOL_MAX_CONNECTIONS)
_connection_pool: psycopg2.pool.ThreadedConnectionPool | None = None
_connection_pool_pid: int | None = None


def get_database_url() -> str:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is required. Create a .env file from .env.example, "
            "then set DATABASE_URL to your PostgreSQL connection string."
        )
    return database_url


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def get_connection_pool() -> psycopg2.pool.ThreadedConnectionPool:
    """Use a tiny thread-safe pool so Render/Neon do not pay connect cost on every query."""
    global _connection_pool, _connection_pool_pid, _pool_semaphore
    pid = os.getpid()
    with _pool_lock:
        if _connection_pool is None or _connection_pool_pid != pid:
            if _connection_pool is not None:
                try:
                    _connection_pool.closeall()
                except Exception:
                    pass
            _connection_pool = psycopg2.pool.ThreadedConnectionPool(
                POOL_MIN_CONNECTIONS,
                POOL_MAX_CONNECTIONS,
                get_database_url(),
            )
            _connection_pool_pid = pid
            _pool_semaphore = threading.BoundedSemaphore(POOL_MAX_CONNECTIONS)
        return _connection_pool


def get_db_connection():
    """Checkout one PostgreSQL connection from the process-local pool."""
    pool = get_connection_pool()
    _pool_semaphore.acquire()
    try:
        return pool.getconn()
    except Exception:
        _pool_semaphore.release()
        raise


def release_db_connection(conn, close: bool = False) -> None:
    """Return a connection to the pool; discard it if it was closed or errored."""
    if conn is None:
        return
    pid = os.getpid()
    try:
        with _pool_lock:
            pool = _connection_pool if _connection_pool_pid == pid else None
        if pool is None:
            conn.close()
            try:
                _pool_semaphore.release()
            except ValueError:
                pass
            return
        pool.putconn(conn, close=close or bool(getattr(conn, "closed", False)))
        _pool_semaphore.release()
    except Exception:
        try:
            conn.close()
        except Exception:
            pass
        try:
            _pool_semaphore.release()
        except ValueError:
            pass


def close_all_db_connections() -> None:
    """Close pooled connections during process shutdown or tests."""
    global _connection_pool, _connection_pool_pid, _pool_semaphore
    with _pool_lock:
        if _connection_pool is not None:
            _connection_pool.closeall()
            _connection_pool = None
            _connection_pool_pid = None
            _pool_semaphore = threading.BoundedSemaphore(POOL_MAX_CONNECTIONS)


class PGRow(dict):
    """Dictionary row with numeric indexing compatibility for older call sites."""

    def __init__(self, keys: list[str], values: tuple[Any, ...]):
        super().__init__(zip(keys, values))
        self._values = list(values)

    def __getitem__(self, key: Any) -> Any:
        if isinstance(key, int):
            return self._values[key]
        return super().__getitem__(key)


class PGCursor:
    def __init__(self, cursor):
        self.cursor = cursor
        self._keys: list[str] = []

    @property
    def rowcount(self) -> int:
        return self.cursor.rowcount

    def execute(self, query: str, params: tuple[Any, ...] | list[Any] | None = None) -> "PGCursor":
        converted = convert_sql(query)
        if not converted.strip():
            return self
        self.cursor.execute(converted, params or ())
        self._keys = [col.name for col in self.cursor.description] if self.cursor.description else []
        return self

    def fetchone(self) -> PGRow | None:
        row = self.cursor.fetchone()
        return PGRow(self._keys, tuple(row)) if row is not None else None

    def fetchall(self) -> list[PGRow]:
        return [PGRow(self._keys, tuple(row)) for row in self.cursor.fetchall()]

    def close(self) -> None:
        self.cursor.close()


class PGConnection:
    def __init__(self):
        self.conn = get_db_connection()
        self.conn.autocommit = False
        self._closed = False

    def cursor(self, *args, **kwargs):
        return self.conn.cursor(*args, **kwargs)

    def execute(self, query: str, params: tuple[Any, ...] | list[Any] | None = None) -> PGCursor:
        cursor = PGCursor(self.conn.cursor())
        return cursor.execute(query, params)

    def executescript(self, script: str) -> None:
        for statement in split_sql_script(script):
            converted = convert_sql(statement)
            if converted.strip():
                with self.conn.cursor() as cur:
                    cur.execute(converted)

    def commit(self) -> None:
        self.conn.commit()

    def rollback(self) -> None:
        self.conn.rollback()

    def close(self) -> None:
        if not self._closed:
            release_db_connection(self.conn)
            self._closed = True

    def __enter__(self) -> "PGConnection":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if exc_type:
            self.rollback()
        else:
            self.commit()
        self.close()


def split_sql_script(script: str) -> list[str]:
    statements: list[str] = []
    current: list[str] = []
    in_single = False
    in_double = False
    prev = ""
    for char in script:
        if char == "'" and not in_double and prev != "\\":
            in_single = not in_single
        elif char == '"' and not in_single and prev != "\\":
            in_double = not in_double
        if char == ";" and not in_single and not in_double:
            statement = "".join(current).strip()
            if statement:
                statements.append(statement)
            current = []
        else:
            current.append(char)
        prev = char
    tail = "".join(current).strip()
    if tail:
        statements.append(tail)
    return statements


def convert_sql(query: str) -> str:
    q = query.strip()
    if not q or q.upper().startswith("PRAGMA"):
        return ""
    q = q.replace(
        "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
        "INSERT INTO settings (key, value, updated_at) VALUES (%s, %s, %s) ON CONFLICT (key) DO NOTHING",
    )
    q = q.replace("ON CONFLICT(key)", "ON CONFLICT (key)")
    q = q.replace("?", "%s")
    return q


def db() -> PGConnection:
    return PGConnection()


def fetchone(conn, query, params=None):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(convert_sql(query), params or ())
        return dict(cur.fetchone()) if cur.rowcount and cur.description else None


def fetchall(conn, query, params=None):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(convert_sql(query), params or ())
        rows = cur.fetchall()
        return [dict(r) for r in rows]


def fetchval(conn, query, params=None):
    with conn.cursor() as cur:
        cur.execute(convert_sql(query), params or ())
        row = cur.fetchone()
        return row[0] if row else None


def execute(conn, query, params=None):
    with conn.cursor() as cur:
        cur.execute(convert_sql(query), params or ())


def executemany(conn, query, params_list):
    with conn.cursor() as cur:
        for params in params_list:
            cur.execute(convert_sql(query), params)


def json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), 180_000)
    return digest.hex(), salt


def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    digest, _ = hash_password(password, salt)
    return hmac.compare_digest(digest, stored_hash)


def public_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


def normalize_code(code: str) -> str:
    return (code or "").strip().upper()


def format_money(value: Any) -> str:
    return f"{float(value or 0):,.0f} جنيه"


def deal_number_next(conn) -> str:
    count = fetchval(conn, "SELECT COUNT(*) FROM deals") or 0
    return f"DEAL-{count + 1:04d}"


def status_title(value: str | None) -> str:
    mapping = {
        "available": "Available", "reserved": "Reserved", "sold": "Sold",
        "pending_payment": "Pending Payment", "pending_approval": "Pending Approval",
        "pending": "Pending", "confirmed": "Confirmed", "cancelled": "Cancelled", "reversed": "Reversed",
        "partially_paid": "Partially Paid", "fully_paid": "Fully Paid",
        "overdue": "Overdue", "cash": "Cash", "bank_transfer": "Bank Transfer",
        "installment": "Installment", "office_payment": "Office Payment",
        "other": "Other", "rejected": "Rejected", "upcoming": "Upcoming",
        "due": "Due", "paid": "Paid", "partially_paid_installment": "Partially Paid",
    }
    return mapping.get(value or "", value or "")


def status_db(value: str | None, kind: str) -> str:
    normalized = (value or "").strip().lower().replace(" ", "_").replace("-", "_")
    maps = {
        "apartment": {"available": "available", "reserved": "reserved", "sold": "sold",
                       "pending_payment": "pending_payment", "pending_approval": "pending_approval",
                       "frozen": "frozen"},
        "reservation": {"pending": "pending", "reserved": "reserved", "confirmed": "confirmed",
                         "sold": "sold", "cancelled": "cancelled"},
        "payment": {"pending": "pending", "partially_paid": "partially_paid",
                     "fully_paid": "fully_paid", "overdue": "overdue"},
        "payment_record": {"confirmed": "confirmed", "pending": "pending", "rejected": "rejected", "cancelled": "cancelled", "reversed": "reversed"},
        "method": {"cash": "cash", "bank_transfer": "bank_transfer", "installment": "installment",
                    "office_payment": "office_payment", "other": "other"},
        "installment": {"upcoming": "upcoming", "due": "due", "paid": "paid",
                         "partially_paid": "partially_paid", "overdue": "overdue", "cancelled": "cancelled"},
    }
    if normalized not in maps.get(kind, {}):
        raise ValueError(f"Invalid {kind} status: {value}")
    return maps[kind][normalized]


def audit(conn, admin_id, action_type, entity_type, entity_id, description, old_value=None, new_value=None):
    execute(conn,
        """INSERT INTO audit_logs (id, admin_id, action_type, entity_type, entity_id,
           old_value, new_value, description, created_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (public_id("log"), admin_id, action_type, entity_type, entity_id,
         json_dumps(old_value) if old_value is not None else None,
         json_dumps(new_value) if new_value is not None else None,
         description, now_iso()))


def get_setting(conn, key: str) -> str:
    row = fetchone(conn, "SELECT value FROM settings WHERE key = %s", (key,))
    return row["value"] if row else ""


def all_settings(conn) -> dict[str, str]:
    rows = fetchall(conn, "SELECT key, value FROM settings")
    return {r["key"]: r["value"] for r in rows}


def receipt_number(conn) -> str:
    settings = all_settings(conn)
    prefix = settings.get("receipt_prefix", "RCPT")
    count = (fetchval(conn, "SELECT COUNT(*) FROM payments WHERE receipt_number IS NOT NULL") or 0) + 1
    candidate = f"{prefix}-{count:04d}"
    while fetchone(conn, "SELECT id FROM payments WHERE receipt_number = %s", (candidate,)):
        count += 1
        candidate = f"{prefix}-{count:04d}"
    return candidate


def apartment_features(apartment_type: str) -> list[str]:
    if apartment_type == "A":
        return ["Wide layout", "Large area", "Good ventilation", "Private reservation", "Elevator access"]
    if apartment_type == "B":
        return ["North-facing unit", "Premium finishing", "Family-friendly space", "Elevator access"]
    return ["South-facing unit", "Good ventilation", "Family-friendly space", "Private reservation"]


def apartment_payload(row: dict) -> dict:
    return {
        "id": row["id"], "unitCode": row["unit_code"], "floorNumber": row["floor_number"],
        "apartmentType": row["apartment_type"], "area": row["area"],
        "directionAr": row["direction_ar"], "directionEn": row["direction_en"],
        "price": row["price"], "status": status_title(row["status"]),
        "assignedClientId": row.get("assigned_client_id"),
        "buildingName": "مشروع أرض عبدالجليل",
        "location": "أرض عبدالجليل",
        "notes": row.get("notes"), "features": apartment_features(row["apartment_type"]),
    }


def payment_payload(row: dict) -> dict:
    payload = {
        "id": row.get("id"),
        "clientId": row.get("client_id"),
        "apartmentId": row.get("apartment_id"),
        "date": row.get("payment_date"),
        "amount": row.get("amount"),
        "method": status_title(row.get("payment_method")),
        "status": status_title(row.get("payment_status")),
        "reference": row.get("receipt_number") or row.get("reference_number"),
        "receiptNumber": row.get("receipt_number"),
        "referenceNumber": row.get("reference_number"),
        "notes": row.get("notes"),
    }
    if "unit_code" in row:
        payload["unitCode"] = normalize_display_text(row.get("unit_code"))
    if "client_name" in row:
        payload["clientName"] = normalize_display_text(row.get("client_name"))
    return payload


def installment_payload(row: dict) -> dict:
    return {
        "id": row["id"], "installmentNumber": row["installment_number"],
        "dueDate": row["due_date"], "amount": row["amount"],
        "paidAmount": row["paid_amount"], "remainingAmount": row["remaining_amount"],
        "status": row["status"], "paymentId": row.get("payment_id"), "notes": row.get("notes"),
    }


def recalc_installments(conn, client_id):
    rows = fetchall(conn, "SELECT * FROM installments WHERE client_id = %s", (client_id,))
    today = datetime.now().date()
    for row in rows:
        amount = float(row["amount"] or 0)
        paid = float(row["paid_amount"] or 0)
        remaining = max(0, amount - paid)
        status = row["status"]
        if status != "cancelled":
            due_date = None
            if row["due_date"]:
                try:
                    due_date = datetime.fromisoformat(str(row["due_date"])).date()
                except Exception:
                    pass
            if remaining <= 0:
                status = "paid"
            elif paid > 0:
                status = "partially_paid"
            elif due_date and due_date < today:
                status = "overdue"
            elif due_date and due_date == today:
                status = "due"
            else:
                status = "upcoming"
        execute(conn,
            "UPDATE installments SET remaining_amount = %s, status = %s, updated_at = %s WHERE id = %s",
            (remaining, status, now_iso(), row["id"]))


def recalc_client(conn, client_id):
    client = fetchone(conn, "SELECT * FROM clients WHERE id = %s", (client_id,))
    if not client:
        return
    recalc_installments(conn, client_id)
    paid = fetchval(conn,
        "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE client_id = %s AND payment_status = 'confirmed'",
        (client_id,)) or 0
    try:
        link_summary = fetchone(conn, "SELECT COUNT(*) AS count, COALESCE(SUM(unit_price), 0) AS total FROM client_apartments WHERE client_id = %s AND status != 'cancelled'", (client_id,))
    except Exception:
        link_summary = None
    link_count = int((link_summary or {}).get("count") or 0)
    if link_count:
        total = float((link_summary or {}).get("total") or 0)
    elif client.get("apartment_id") or client["reservation_status"] == "cancelled":
        total = float(client.get("total_amount") or 0)
    else:
        total = 0
    remaining = max(0, total - float(paid))
    overdue_count = fetchval(conn,
        "SELECT COUNT(*) FROM installments WHERE client_id = %s AND status = 'overdue' AND remaining_amount > 0",
        (client_id,)) or 0
    if overdue_count:
        payment_status = "overdue"
    elif paid <= 0:
        payment_status = "pending"
    elif paid >= total and total > 0:
        payment_status = "fully_paid"
    else:
        payment_status = "partially_paid"
    next_reservation_status = None
    if client["reservation_status"] != "cancelled":
        next_reservation_status = "sold" if (total > 0 and float(paid) >= total) or float(paid) >= SOLD_PAYMENT_THRESHOLD else "reserved"
    if next_reservation_status:
        execute(conn,
            "UPDATE clients SET total_amount = %s, paid_amount = %s, remaining_amount = %s, payment_status = %s, reservation_status = %s, updated_at = %s WHERE id = %s",
            (total, paid, remaining, payment_status, next_reservation_status, now_iso(), client_id))
    else:
        execute(conn,
            "UPDATE clients SET total_amount = %s, paid_amount = %s, remaining_amount = %s, payment_status = %s, updated_at = %s WHERE id = %s",
            (total, paid, remaining, payment_status, now_iso(), client_id))
    sync_apartment_for_client(conn, client_id)


def sync_apartment_status(conn, apartment_id):
    apartment = fetchone(conn, "SELECT * FROM apartments WHERE id = %s", (apartment_id,))
    if not apartment or apartment.get("status") == "frozen":
        return
    active = active_client_for_apartment(conn, apartment_id)
    if active:
        paid_amount = float(active.get("paid_amount") or 0)
        total_amount = float(active.get("total_amount") or 0)
        is_sold = active.get("reservation_status") == "sold" or active.get("payment_status") == "fully_paid" or paid_amount >= SOLD_PAYMENT_THRESHOLD or (total_amount > 0 and paid_amount >= total_amount)
        execute(conn, "UPDATE apartments SET status = %s, assigned_client_id = %s, updated_at = %s WHERE id = %s", ("sold" if is_sold else "reserved", active["id"], now_iso(), apartment_id))
        return
    pending_deal = fetchone(conn, "SELECT id FROM deals WHERE apartment_id = %s AND status = 'pending_approval' LIMIT 1", (apartment_id,))
    if pending_deal:
        execute(conn, "UPDATE apartments SET status = %s, assigned_client_id = NULL, updated_at = %s WHERE id = %s", ("pending_approval", now_iso(), apartment_id))
        return
    execute(conn, "UPDATE apartments SET status = %s, assigned_client_id = NULL, updated_at = %s WHERE id = %s", ("available", now_iso(), apartment_id))


def sync_apartment_for_client(conn, client_id):
    client = fetchone(conn, "SELECT * FROM clients WHERE id = %s", (client_id,))
    if not client:
        return
    try:
        rows = fetchall(conn, "SELECT * FROM client_apartments WHERE client_id = %s AND status != 'cancelled'", (client_id,))
    except Exception:
        rows = []
    if not rows and client.get("apartment_id"):
        sync_apartment_status(conn, client["apartment_id"])
        return
    for row in rows:
        sync_apartment_status(conn, row["apartment_id"])
    released = fetchall(conn, "SELECT id FROM apartments WHERE assigned_client_id = %s AND id NOT IN (SELECT apartment_id FROM client_apartments WHERE client_id = %s AND status != 'cancelled')", (client_id, client_id))
    for row in released:
        sync_apartment_status(conn, row["id"])


def active_client_for_apartment(conn, apartment_id, exclude_client_id=None):
    if exclude_client_id:
        row = fetchone(conn,
            "SELECT c.* FROM client_apartments ca JOIN clients c ON c.id = ca.client_id WHERE ca.apartment_id = %s AND ca.status != 'cancelled' AND c.reservation_status != 'cancelled' AND c.id != %s LIMIT 1",
            (apartment_id, exclude_client_id))
        if row:
            return row
        return fetchone(conn,
            "SELECT * FROM clients WHERE apartment_id = %s AND reservation_status != 'cancelled' AND id != %s",
            (apartment_id, exclude_client_id))
    row = fetchone(conn,
        "SELECT c.* FROM client_apartments ca JOIN clients c ON c.id = ca.client_id WHERE ca.apartment_id = %s AND ca.status != 'cancelled' AND c.reservation_status != 'cancelled' LIMIT 1",
        (apartment_id,))
    if row:
        return row
    return fetchone(conn,
        "SELECT * FROM clients WHERE apartment_id = %s AND reservation_status != 'cancelled'",
        (apartment_id,))


def validate_assignment(conn, apartment_id, client_id=None):
    apartment = fetchone(conn, "SELECT * FROM apartments WHERE id = %s", (apartment_id,))
    if not apartment:
        return False, "الشقة غير موجودة."
    if apartment["status"] == "sold" and apartment.get("assigned_client_id") != client_id:
        return False, "لا يمكن تخصيص شقة مباعة لعميل جديد."
    other = active_client_for_apartment(conn, apartment_id, exclude_client_id=client_id)
    if other:
        return False, "هذه الشقة محجوزة بالفعل لعميل آخر."
    return True, None


def client_payload(conn, client, include_private=True):
    # Try to load linked apartments; fall back to legacy single-apartment field
    apartments_rows = []
    try:
        apartments_rows = fetchall(conn, "SELECT ca.id AS client_apartment_id, ca.apartment_id, ca.unit_price, ca.status AS ca_status, ca.assigned_at, a.unit_code, a.floor_number, a.apartment_type, a.area, a.direction_ar, a.direction_en, a.price AS apt_price, a.status AS apt_status, a.notes AS apt_notes FROM client_apartments ca LEFT JOIN apartments a ON a.id = ca.apartment_id WHERE ca.client_id = %s ORDER BY ca.assigned_at DESC", (client["id"],))
    except Exception:
        apt = fetchone(conn, "SELECT * FROM apartments WHERE id = %s", (client.get("apartment_id"),)) if client.get("apartment_id") else None
        apartments_rows = []
        if apt:
            apartments_rows = [{
                "apartment_id": apt["id"],
                "unit_code": apt["unit_code"],
                "floor_number": apt.get("floor_number"),
                "apartment_type": apt.get("apartment_type"),
                "area": apt.get("area"),
                "direction_ar": apt.get("direction_ar"),
                "direction_en": apt.get("direction_en"),
                "unit_price": apt["price"],
                "ca_status": apt["status"],
                "assigned_at": None,
            }]

    apartments = []
    for r in apartments_rows:
        apartments.append({
            "id": r.get("apartment_id"),
            "unitCode": r.get("unit_code"),
            "floorNumber": r.get("floor_number"),
            "apartmentType": r.get("apartment_type"),
            "area": r.get("area"),
            "directionAr": r.get("direction_ar"),
            "directionEn": r.get("direction_en"),
            "price": float(r.get("unit_price") or r.get("apt_price") or 0),
            "status": status_title(r.get("ca_status") or r.get("apt_status")),
            "assignedAt": r.get("assigned_at"),
        })

    payments = fetchall(conn, "SELECT payments.*, a.unit_code FROM payments LEFT JOIN apartments a ON a.id = payments.apartment_id WHERE payments.client_id = %s ORDER BY payments.payment_date DESC, payments.created_at DESC", (client["id"],))
    installments = fetchall(conn, "SELECT installments.*, a.unit_code FROM installments LEFT JOIN apartments a ON a.id = installments.apartment_id WHERE installments.client_id = %s ORDER BY installment_number ASC", (client["id"],))

    total = float(client.get("total_amount") or 0)
    paid = float(client.get("paid_amount") or 0)
    payment_progress = (paid / total * 100) if total > 0 else 0
    return {
        "id": client["id"], "code": client["client_code"], "name": client["full_name"],
        "phone": client.get("phone"), "email": client.get("email"),
        "nationalId": client.get("national_id") if include_private else None,
        "apartmentId": client.get("apartment_id"),
        "reservationStatus": status_title(client["reservation_status"]),
        "reservationDate": client["reservation_date"],
        "expectedDeliveryDate": client.get("expected_delivery_date"),
        "totalAmount": client["total_amount"], "paidAmount": client["paid_amount"],
        "remainingAmount": client["remaining_amount"],
        "paymentStatus": status_title(client["payment_status"]),
        "paymentProgress": payment_progress,
        "officeNotes": client.get("office_notes"),
        "apartment": apartments[0] if apartments else None,
        "apartments": apartments,
        "payments": [payment_payload(r) for r in payments],
        "installments": [installment_payload(r) for r in installments],
    }


def create_receipt_record(conn, payment_id, admin_id):
    payment = fetchone(conn, "SELECT * FROM payments WHERE id = %s", (payment_id,))
    if not payment or not payment.get("receipt_number"):
        return
    existing = fetchone(conn, "SELECT id FROM receipts WHERE payment_id = %s", (payment_id,))
    if existing:
        return
    execute(conn,
        """INSERT INTO receipts (id, payment_id, client_id, apartment_id, receipt_number,
           receipt_pdf_url, issued_at, issued_by, created_at)
           VALUES (%s, %s, %s, %s, %s, NULL, %s, %s, %s)""",
        (public_id("receipt"), payment_id, payment["client_id"], payment.get("apartment_id"),
         payment["receipt_number"], now_iso(), admin_id, now_iso()))
