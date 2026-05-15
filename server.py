from __future__ import annotations

import csv
import hashlib
import hmac
import io
import json
import os
import secrets
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from flask import Flask, Response, g, jsonify, request, send_file, send_from_directory
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from db_utils import db, get_database_url, get_db_connection as checkout_db_connection, release_db_connection
from bootstrap_owner import bootstrap_owner_account

try:
    import arabic_reshaper
    from bidi.algorithm import get_display
except Exception:  # pragma: no cover - PDF still works with plain text fallback.
    arabic_reshaper = None
    get_display = None


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
DATABASE_URL = get_database_url()
APP_ENV = os.environ.get("APP_ENV", "development").strip().lower()
SECRET_KEY = os.environ.get("SECRET_KEY") or ("dev-secret-change-me" if APP_ENV != "production" else "")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is required when APP_ENV=production.")
MEDIA_DIR = BASE_DIR / "media"
GENERATED_DIR = BASE_DIR / "generated"
INDEX_PATH = BASE_DIR / "index.html"
UPLOAD_DIR = BASE_DIR / os.environ.get("UPLOAD_FOLDER", "uploads")
REQUIRED_MEDIA_FILES = (
    "facade.jpg",
    "apartment-1.jpg",
    "apartment-2.jpg",
    "apartment-3.jpg",
    "project-video.mp4",
)
ALLOWED_UPDATE_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "mp4", "webm"}
MAX_UPDATE_UPLOAD_MB = 80

SESSION_COOKIE = "real_estate_admin_session"
SESSION_DAYS = 14
CLIENT_RATE_LIMIT_SECONDS = 60
CLIENT_RATE_LIMIT_ATTEMPTS = 12

app = Flask(__name__)
app.config["SECRET_KEY"] = SECRET_KEY
app.config["UPLOAD_FOLDER"] = str(UPLOAD_DIR)
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 31536000  # Cache static assets for faster repeat loads.

PUBLIC_CACHE_TTL_SECONDS = 60
public_response_cache: dict[str, tuple[float, Any]] = {}
public_cache_lock = threading.Lock()


def get_db_connection():
    """Request-scoped checkout for raw DB use; teardown returns it to the shared pool."""
    if "db_connection" not in g:
        g.db_connection = checkout_db_connection()
    return g.db_connection


@app.teardown_appcontext
def return_db_connection(_: BaseException | None = None) -> None:
    """Return any request-scoped DB connection to the pool after Flask finishes the request."""
    conn = g.pop("db_connection", None)
    if conn is not None:
        release_db_connection(conn)


def cached_public_json(cache_key: str, loader, ttl: int = PUBLIC_CACHE_TTL_SECONDS) -> Response:
    """Keep hot public responses in memory briefly so first paint is not blocked by repeated DB reads."""
    now = time.time()
    with public_cache_lock:
        cached = public_response_cache.get(cache_key)
        if cached and cached[0] > now:
            return jsonify(cached[1])
    payload = loader()
    with public_cache_lock:
        public_response_cache[cache_key] = (time.time() + ttl, payload)
    return jsonify(payload)


def env_flag(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "t", "yes", "y", "on"}


def request_page(default: int = 1) -> int:
    try:
        return max(1, int(request.args.get("page", default)))
    except (TypeError, ValueError):
        return default


def request_limit(default: int = 20, maximum: int = 100) -> int:
    try:
        return min(maximum, max(1, int(request.args.get("limit", default))))
    except (TypeError, ValueError):
        return default


def pagination_meta(total: int, page: int, limit: int) -> dict[str, int | bool]:
    return {
        "page": page,
        "limit": limit,
        "total": total,
        "hasMore": page * limit < total,
    }


def paginated_payload(key: str, items: list[Any], total: int, page: int, limit: int) -> dict[str, Any]:
    meta = pagination_meta(total, page, limit)
    return {
        "items": items,
        key: items,
        **meta,
        "pagination": meta,
    }


def ensure_runtime_directories() -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def missing_required_media_files() -> list[str]:
    return [f"media/{name}" for name in REQUIRED_MEDIA_FILES if not (MEDIA_DIR / name).exists()]


@app.after_request
def normalize_json_response(response: Response) -> Response:
    if response.mimetype == "application/json":
        try:
            payload = response.get_json(silent=True)
            if payload is not None:
                encoded = json.dumps(deep_normalize(payload), ensure_ascii=False).encode("utf-8")
                response.set_data(encoded)
                response.headers["Content-Length"] = str(len(encoded))
        except Exception:
            pass
    return response

# Serve static files from media directory
@app.route('/media/<path:filename>')
def serve_media(filename):
    return send_from_directory(MEDIA_DIR, filename)

# Serve static files from uploads directory
@app.route('/uploads/<path:filename>')
def serve_uploads(filename):
    return send_from_directory(UPLOAD_DIR, filename)

client_code_attempts: dict[str, list[float]] = {}
login_attempts: dict[str, list[float]] = {}

LOGIN_RATE_LIMIT_SECONDS = 15 * 60  # 15 minutes
LOGIN_RATE_LIMIT_ATTEMPTS = 5  # 5 attempts
SOLD_PAYMENT_THRESHOLD = 20_000


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def row_to_dict(row: Any | None) -> dict[str, Any] | None:
    return dict(row) if row else None


def rows_to_dicts(rows: list[Any]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


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


def mojibake_bytes(value: str) -> bytes | None:
    raw = bytearray()
    for char in value:
        codepoint = ord(char)
        if codepoint <= 255:
            raw.append(codepoint)
            continue
        try:
            raw.extend(char.encode("cp1252"))
        except UnicodeError:
            return None
    return bytes(raw)


def normalize_display_text(text: Any) -> str:
    value = str(text if text is not None else "")
    for _ in range(4):
        repaired = value
        raw = mojibake_bytes(value)
        if raw is not None:
            try:
                candidate = raw.decode("utf-8")
            except UnicodeError:
                candidate = value
            if candidate != value:
                repaired = candidate
        if repaired == value:
            for encoding in ("latin1", "cp1252"):
                try:
                    candidate = value.encode(encoding).decode("utf-8")
                except UnicodeError:
                    continue
                if candidate != value:
                    repaired = candidate
                    break
        if repaired == value:
            break
        value = repaired
    value = value.replace("\u00c3\u201a\u00c2\u00b2", "²").replace("\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u20ac\u009d", "—")
    return value


def deep_normalize(value: Any) -> Any:
    if isinstance(value, str):
        return normalize_display_text(value)
    if isinstance(value, list):
        return [deep_normalize(item) for item in value]
    if isinstance(value, dict):
        return {key: deep_normalize(item) for key, item in value.items()}
    return value


def status_title(value: str | None) -> str:
    mapping = {
        "available": "Available",
        "reserved": "Reserved",
        "sold": "Sold",
        "pending_payment": "Pending Payment",
        "pending_approval": "Pending Approval",
        "frozen": "Frozen",
        "pending": "Pending",
        "confirmed": "Confirmed",
        "cancelled": "Cancelled",
        "partially_paid": "Partially Paid",
        "fully_paid": "Fully Paid",
        "overdue": "Overdue",
        "cash": "Cash",
        "bank_transfer": "Bank Transfer",
        "installment": "Installment",
        "office_payment": "Office Payment",
        "other": "Other",
        "rejected": "Rejected",
        "upcoming": "Upcoming",
        "due": "Due",
        "paid": "Paid",
        "partially_paid_installment": "Partially Paid",
        "draft": "Draft",
        "pending_approval": "Pending Approval",
        "revision_requested": "Revision Required",
        "approved": "Approved",
        "finalized": "Finalized",
        "draft_contract": "Draft Contract",
        "final_contract": "Final Contract",
        "issued": "Issued",
    }
    return mapping.get(value or "", value or "")


def status_label_ar(value: str | None) -> str:
    mapping = {
        "available": "متاحة",
        "reserved": "محجوزة",
        "sold": "مباعة",
        "pending_payment": "في انتظار السداد",
        "pending_approval": "بانتظار موافقة الإدارة",
        "frozen": "مجمدة",
        "pending": "قيد المراجعة",
        "confirmed": "مؤكد",
        "cancelled": "ملغاة",
        "partially_paid": "مدفوع جزئيًا",
        "fully_paid": "مدفوع بالكامل",
        "overdue": "متأخر السداد",
        "cash": "نقدًا",
        "bank_transfer": "تحويل بنكي",
        "installment": "قسط",
        "office_payment": "دفع في المكتب",
        "other": "أخرى",
        "rejected": "مرفوض",
        "upcoming": "قادم",
        "due": "مستحق",
        "paid": "مدفوع",
        "partially_paid_installment": "مدفوع جزئيًا",
        "draft": "مسودة",
        "pending_approval": "بانتظار موافقة الإدارة",
        "revision_requested": "مطلوب تعديل",
        "approved": "تمت الموافقة",
        "finalized": "تم الإنهاء",
        "draft_contract": "عقد مسودة",
        "final_contract": "العقد النهائي",
        "issued": "صادر",
        "Available": "متاحة",
        "Reserved": "محجوزة",
        "Sold": "مباعة",
        "Pending Payment": "في انتظار السداد",
        "Pending Approval": "بانتظار موافقة الإدارة",
        "Frozen": "مجمدة",
        "Pending": "قيد المراجعة",
        "Confirmed": "مؤكد",
        "Cancelled": "ملغاة",
        "Partially Paid": "مدفوع جزئيًا",
        "Fully Paid": "مدفوع بالكامل",
        "Overdue": "متأخر السداد",
        "Cash": "نقدًا",
        "Bank Transfer": "تحويل بنكي",
        "Installment": "قسط",
        "Office Payment": "دفع في المكتب",
        "Other": "أخرى",
        "Rejected": "مرفوض",
        "Upcoming": "قادم",
        "Due": "مستحق",
        "Paid": "مدفوع",
        "Draft": "مسودة",
        "Pending Approval": "بانتظار موافقة الإدارة",
        "Revision Required": "مطلوب تعديل",
        "Approved": "تمت الموافقة",
        "Finalized": "تم الإنهاء",
        "Draft Contract": "عقد مسودة",
        "Final Contract": "العقد النهائي",
        "Issued": "صادر",
    }
    return normalize_display_text(mapping.get(value or "", value or ""))


def status_db(value: str | None, kind: str) -> str:
    normalized = (value or "").strip().lower().replace(" ", "_").replace("-", "_")
    maps = {
        "apartment": {
            "available": "available",
            "reserved": "reserved",
            "sold": "sold",
            "pending_payment": "pending_payment",
            "pending_approval": "pending_approval",
            "frozen": "frozen",
        },
        "reservation": {
            "pending": "pending",
            "reserved": "reserved",
            "confirmed": "confirmed",
            "sold": "sold",
            "cancelled": "cancelled",
        },
        "payment": {
            "pending": "pending",
            "partially_paid": "partially_paid",
            "fully_paid": "fully_paid",
            "overdue": "overdue",
        },
        "payment_record": {
            "confirmed": "confirmed",
            "pending": "pending",
            "rejected": "rejected",
            "cancelled": "cancelled",
        },
        "method": {
            "cash": "cash",
            "bank_transfer": "bank_transfer",
            "installment": "installment",
            "office_payment": "office_payment",
            "other": "other",
        },
        "installment": {
            "upcoming": "upcoming",
            "due": "due",
            "paid": "paid",
            "partially_paid": "partially_paid",
            "overdue": "overdue",
            "cancelled": "cancelled",
        },
    }
    if normalized not in maps[kind]:
        raise ValueError(f"Invalid {kind} status: {value}")
    return maps[kind][normalized]


def init_db() -> None:
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS admins (
              id TEXT PRIMARY KEY,
              full_name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              role TEXT NOT NULL CHECK(role IN ('owner','admin','accountant','viewer','assistant')),
              password_hash TEXT NOT NULL,
              password_salt TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS admin_sessions (
              id TEXT PRIMARY KEY,
              admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
              expires_at TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS apartments (
              id TEXT PRIMARY KEY,
              unit_code TEXT NOT NULL UNIQUE,
              floor_number INTEGER NOT NULL,
              apartment_type TEXT NOT NULL CHECK(apartment_type IN ('A','B','C')),
              area INTEGER NOT NULL,
              direction_ar TEXT NOT NULL,
              direction_en TEXT NOT NULL,
              price REAL NOT NULL DEFAULT 0,
              status TEXT NOT NULL CHECK(status IN ('available','reserved','sold','pending_payment','pending_approval','frozen')),
              assigned_client_id TEXT,
              notes TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS clients (
              id TEXT PRIMARY KEY,
              full_name TEXT NOT NULL,
              phone TEXT,
              email TEXT,
              national_id TEXT,
              client_code TEXT NOT NULL UNIQUE,
              portfolio_code TEXT,
              apartment_id TEXT REFERENCES apartments(id),
              reservation_status TEXT NOT NULL CHECK(reservation_status IN ('pending','reserved','confirmed','sold','cancelled')),
              reservation_date TEXT NOT NULL,
              expected_delivery_date TEXT,
              total_amount REAL NOT NULL DEFAULT 0,
              paid_amount REAL NOT NULL DEFAULT 0,
              remaining_amount REAL NOT NULL DEFAULT 0,
              payment_status TEXT NOT NULL CHECK(payment_status IN ('pending','partially_paid','fully_paid','overdue')),
              office_notes TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_active_apartment
              ON clients(apartment_id)
              WHERE apartment_id IS NOT NULL AND reservation_status != 'cancelled';

            CREATE TABLE IF NOT EXISTS payments (
              id TEXT PRIMARY KEY,
              client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
              apartment_id TEXT REFERENCES apartments(id),
              amount REAL NOT NULL CHECK(amount > 0),
              payment_date TEXT NOT NULL,
              payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','bank_transfer','installment','office_payment','other')),
              payment_status TEXT NOT NULL CHECK(payment_status IN ('confirmed','pending','rejected')),
              receipt_number TEXT UNIQUE,
              reference_number TEXT,
              notes TEXT,
              created_by TEXT REFERENCES admins(id),
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS installments (
              id TEXT PRIMARY KEY,
              client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
              apartment_id TEXT REFERENCES apartments(id),
              installment_number INTEGER NOT NULL,
              due_date TEXT NOT NULL,
              amount REAL NOT NULL CHECK(amount >= 0),
              paid_amount REAL NOT NULL DEFAULT 0,
              remaining_amount REAL NOT NULL DEFAULT 0,
              status TEXT NOT NULL CHECK(status IN ('upcoming','due','paid','partially_paid','overdue','cancelled')),
              payment_id TEXT REFERENCES payments(id),
              notes TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS receipts (
              id TEXT PRIMARY KEY,
              payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
              client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
              apartment_id TEXT REFERENCES apartments(id),
              receipt_number TEXT NOT NULL UNIQUE,
              receipt_pdf_url TEXT,
              issued_at TEXT NOT NULL,
              issued_by TEXT REFERENCES admins(id),
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
              id TEXT PRIMARY KEY,
              admin_id TEXT REFERENCES admins(id),
              action_type TEXT NOT NULL,
              entity_type TEXT NOT NULL,
              entity_id TEXT,
              old_value TEXT,
              new_value TEXT,
              description TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS project_updates (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              description TEXT NOT NULL,
              update_date TEXT NOT NULL,
              stage TEXT NOT NULL,
              media_type TEXT NOT NULL,
              media_url TEXT,
              thumbnail_url TEXT,
              status TEXT NOT NULL DEFAULT 'draft',
              display_order INTEGER DEFAULT 0,
              created_by TEXT NOT NULL REFERENCES admins(id),
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS media_assets (
              id TEXT PRIMARY KEY,
              asset_key TEXT NOT NULL UNIQUE,
              title TEXT NOT NULL,
              media_type TEXT NOT NULL CHECK(media_type IN ('image','video')),
              file_url TEXT NOT NULL,
              thumbnail_url TEXT,
              display_order INTEGER NOT NULL DEFAULT 0,
              is_active BOOLEAN NOT NULL DEFAULT TRUE,
              created_by TEXT REFERENCES admins(id),
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS deals (
              id TEXT PRIMARY KEY,
              deal_number TEXT UNIQUE,
              assistant_id TEXT NOT NULL REFERENCES admins(id),
              client_name TEXT NOT NULL,
              client_phone TEXT,
              apartment_id TEXT REFERENCES apartments(id),
              proposed_total REAL NOT NULL DEFAULT 0,
              notes TEXT,
              status TEXT NOT NULL CHECK(status IN ('draft','pending_approval','revision_requested','approved','rejected','finalized','cancelled')),
              owner_notes TEXT,
              approved_by TEXT REFERENCES admins(id),
              approved_at TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS contracts (
              id TEXT PRIMARY KEY,
              contract_number TEXT UNIQUE,
              deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
              contract_type TEXT NOT NULL CHECK(contract_type IN ('draft_contract','final_contract')),
              status TEXT NOT NULL CHECK(status IN ('draft','issued')),
              pdf_url TEXT,
              issued_by TEXT REFERENCES admins(id),
              issued_at TEXT,
              created_at TEXT NOT NULL
            );
            """
        )
        ensure_admin_role_schema(conn)
        ensure_apartment_status_schema(conn)
        ensure_clients_portfolio_schema(conn)
        ensure_client_apartments_schema(conn)
        ensure_deals_owner_schema(conn)
        ensure_contracts_schema(conn)
        ensure_runtime_indexes(conn)
    seed_defaults()
    if env_flag("REPAIR_MOJIBAKE_ON_STARTUP", False):
        with db() as conn:
            repair_mojibake_data(conn)


def ensure_admin_role_schema(conn) -> None:
    conn.execute("ALTER TABLE admins ADD COLUMN IF NOT EXISTS phone TEXT")
    conn.execute("ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE")
    conn.execute("ALTER TABLE admins ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE")
    conn.execute("ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_login_at TEXT")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_admins_is_active ON admins(is_active)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_admins_last_login_at ON admins(last_login_at DESC)")
    # Make sure assistant role is accepted on existing PostgreSQL databases.
    try:
        rows = conn.execute(
            """
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'admins'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%%role%%'
            """
        ).fetchall()
        for row in rows:
            conn.execute(f"ALTER TABLE admins DROP CONSTRAINT IF EXISTS {row['conname']}")
        conn.execute("ALTER TABLE admins ADD CONSTRAINT chk_admins_role CHECK(role IN ('owner','admin','accountant','viewer','assistant'))")
    except Exception:
        # Constraint maintenance is best-effort for existing databases.
        pass


def ensure_apartment_status_schema(conn) -> None:
    conn.execute("ALTER TABLE apartments ADD COLUMN IF NOT EXISTS assigned_client_id TEXT")
    conn.execute("ALTER TABLE apartments ADD COLUMN IF NOT EXISTS notes TEXT")
    try:
        rows = conn.execute(
            """
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'apartments'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%%status%%'
            """
        ).fetchall()
        for row in rows:
            conn.execute(f"ALTER TABLE apartments DROP CONSTRAINT IF EXISTS {row['conname']}")
        conn.execute("ALTER TABLE apartments ADD CONSTRAINT chk_apartments_status CHECK(status IN ('available','reserved','sold','pending_payment','pending_approval','frozen'))")
    except Exception:
        pass


def ensure_clients_portfolio_schema(conn) -> None:
    conn.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS portfolio_code TEXT")
    conn.execute(
        """
        UPDATE clients
        SET portfolio_code = COALESCE(portfolio_code, split_part(client_code, '-', 1))
        WHERE portfolio_code IS NULL
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_clients_portfolio_code ON clients(portfolio_code)")


def ensure_deals_owner_schema(conn) -> None:
    conn.execute("ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_number TEXT")
    conn.execute("ALTER TABLE deals ADD COLUMN IF NOT EXISTS client_id TEXT")
    conn.execute("ALTER TABLE deals ADD COLUMN IF NOT EXISTS down_payment REAL NOT NULL DEFAULT 0")
    conn.execute("ALTER TABLE deals ADD COLUMN IF NOT EXISTS payment_plan TEXT")
    conn.execute("ALTER TABLE deals ADD COLUMN IF NOT EXISTS submitted_at TEXT")
    conn.execute("ALTER TABLE deals ADD COLUMN IF NOT EXISTS finalized_at TEXT")
    try:
        rows = conn.execute(
            """
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'deals'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%%status%%'
            """
        ).fetchall()
        conn.execute("ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_status_check")
        conn.execute("ALTER TABLE deals DROP CONSTRAINT IF EXISTS chk_deals_status")
        for row in rows:
            conn.execute(f"ALTER TABLE deals DROP CONSTRAINT IF EXISTS {row['conname']}")
        conn.execute("ALTER TABLE deals ADD CONSTRAINT chk_deals_status CHECK(status IN ('draft','pending_approval','revision_requested','approved','rejected','finalized','cancelled'))")
    except Exception:
        pass
    conn.execute("CREATE INDEX IF NOT EXISTS idx_deals_client_id ON deals(client_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status)")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_deals_deal_number ON deals(deal_number) WHERE deal_number IS NOT NULL")


def ensure_contracts_schema(conn) -> None:
    conn.execute("ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_number TEXT")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_contract_number ON contracts(contract_number) WHERE contract_number IS NOT NULL")


def ensure_client_apartments_schema(conn) -> None:
    # New linking table for clients -> apartments (simple, migration-friendly)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS client_apartments (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      apartment_id TEXT NOT NULL REFERENCES apartments(id),
      unit_price REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      assigned_at TEXT NOT NULL,
      created_by TEXT REFERENCES admins(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    """)
    try:
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_client_apartments_apartment_id ON client_apartments(apartment_id) WHERE status != 'cancelled'")
    except Exception:
        pass
    # Migrate legacy single apartment links from clients.apartment_id
    rows = conn.execute("SELECT id, apartment_id, total_amount FROM clients WHERE apartment_id IS NOT NULL").fetchall()
    for row in rows:
        exists = conn.execute("SELECT id FROM client_apartments WHERE client_id = ? AND apartment_id = ?", (row["id"], row["apartment_id"])).fetchone()
        if exists:
            continue
        price = float(row.get("total_amount") or 0)
        conn.execute(
            "INSERT INTO client_apartments (id, client_id, apartment_id, unit_price, status, assigned_at, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, NULL, ?, ?)",
            (public_id("cap"), row["id"], row["apartment_id"], price, now_iso(), now_iso(), now_iso()),
        )
    # Release any apartments that are not referenced in client_apartments
    conn.execute("UPDATE apartments SET assigned_client_id = NULL WHERE assigned_client_id IS NOT NULL AND assigned_client_id NOT IN (SELECT client_id FROM client_apartments WHERE status != 'cancelled')")


def ensure_runtime_indexes(conn) -> None:
    conn.execute("CREATE INDEX IF NOT EXISTS idx_clients_client_code ON clients(client_code)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_clients_national_id ON clients(national_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_clients_apartment_id ON clients(apartment_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_deals_assistant_id ON deals(assistant_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_payments_payment_status ON payments(payment_status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_installments_client_id ON installments(client_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_payments_client_status ON payments(client_id, payment_status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_installments_client_status ON installments(client_id, status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_installments_due_date ON installments(due_date)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_project_updates_status ON project_updates(status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)")


def repair_mojibake_data(conn: Any) -> None:
    updates: list[tuple[str, str, str]] = [
        ("admins", "full_name", "id"),
        ("apartments", "direction_ar", "id"),
        ("apartments", "notes", "id"),
        ("clients", "full_name", "id"),
        ("clients", "phone", "id"),
        ("clients", "email", "id"),
        ("clients", "national_id", "id"),
        ("clients", "office_notes", "id"),
        ("payments", "notes", "id"),
        ("payments", "reference_number", "id"),
        ("installments", "notes", "id"),
        ("deals", "client_name", "id"),
        ("deals", "client_phone", "id"),
        ("deals", "payment_plan", "id"),
        ("deals", "notes", "id"),
        ("deals", "owner_notes", "id"),
        ("audit_logs", "description", "id"),
        ("project_updates", "title", "id"),
        ("project_updates", "description", "id"),
        ("settings", "value", "key"),
    ]
    for table, column, key_column in updates:
        rows = conn.execute(f"SELECT {key_column} AS row_id, {column} AS value FROM {table}").fetchall()
        for row in rows:
            value = row["value"]
            if value is None:
                continue
            repaired = normalize_display_text(value)
            if repaired != value:
                conn.execute(
                    f"UPDATE {table} SET {column} = ? WHERE {key_column} = ?",
                    (repaired, row["row_id"]),
                )


def seed_defaults() -> None:
    with db() as conn:
        count = conn.execute("SELECT COUNT(*) FROM admins").fetchone()[0]
        if count == 0:
            password_hash, salt = hash_password("Admin@12345")
            conn.execute(
                """
                INSERT INTO admins (id, full_name, email, role, password_hash, password_salt, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (public_id("admin"), "مالك النظام", "admin@example.com", "owner", password_hash, salt, now_iso(), now_iso()),
            )

        settings = {
            "office_name": "مكتب مصعب حسن العقاري",
            "office_phone": "01090073517",
            "whatsapp_number": "201090073517",
            "office_address": "أرض عبدالجليل",
            "currency": "EGP",
            "receipt_prefix": "RCPT",
            "statement_footer": "هذا المستند صادر إلكترونيًا من نظام إدارة الحجوزات.",
        }
        for key, value in settings.items():
            conn.execute(
                "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
                (key, value, now_iso()),
            )

        apt_count = conn.execute("SELECT COUNT(*) FROM apartments").fetchone()[0]
        if apt_count == 0:
            specs = {
                "A": (137, "بحري قبلي", "North/South Facing", 137 * 13500),
                "B": (125, "بحري", "North Facing", 125 * 14000),
                "C": (120, "قبلي", "South Facing", 120 * 13000),
            }
            for floor in range(1, 8):
                for apt_type, (area, direction_ar, direction_en, base_price) in specs.items():
                    unit_code = f"{apt_type}{floor}01"
                    conn.execute(
                        """
                        INSERT INTO apartments (
                          id, unit_code, floor_number, apartment_type, area, direction_ar, direction_en,
                          price, status, assigned_client_id, notes, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', NULL, NULL, ?, ?)
                        """,
                        (
                            f"apt_{unit_code}",
                            unit_code,
                            floor,
                            apt_type,
                            area,
                            direction_ar,
                            direction_en,
                            base_price,
                            now_iso(),
                            now_iso(),
                        ),
                    )


def bootstrap_runtime() -> None:
    ensure_runtime_directories()
    init_db()
    bootstrap_owner_account()


bootstrap_runtime()


def current_admin() -> dict[str, Any] | None:
    session_id = request.cookies.get(SESSION_COOKIE)
    if not session_id:
        return None
    with db() as conn:
        row = conn.execute(
            """
            SELECT admins.* FROM admin_sessions
            JOIN admins ON admins.id = admin_sessions.admin_id
            WHERE admin_sessions.id = ? AND admin_sessions.expires_at > ? AND admins.is_active = TRUE
            """,
            (session_id, now_iso()),
        ).fetchone()
        return row_to_dict(row)


def require_admin(roles: set[str] | None = None) -> dict[str, Any] | Response:
    admin = current_admin()
    if not admin:
        return jsonify({"error": "unauthorized", "message": "يجب تسجيل الدخول أولاً."}), 401
    password_change_allowed = {
        "/api/admin/me",
        "/api/admin/logout",
        "/api/admin/profile",
        "/api/admin/change-password",
        "/api/admin/account",
    }
    if admin.get("must_change_password") and request.path not in password_change_allowed:
        return jsonify({"error": "password_change_required", "message": "يجب تغيير كلمة المرور قبل استخدام النظام."}), 403
    if roles and admin["role"] not in roles:
        return jsonify({"error": "forbidden", "message": "ليس لديك صلاحية لتنفيذ هذه العملية."}), 403
    return admin


def admin_public_payload(row: dict[str, Any] | dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "fullName": normalize_display_text(row["full_name"]),
        "email": normalize_display_text(row["email"]),
        "role": row["role"],
        "phone": normalize_display_text(row.get("phone") or ""),
        "isActive": bool(row.get("is_active", True)),
        "mustChangePassword": bool(row.get("must_change_password", False)),
        "lastLoginAt": row.get("last_login_at"),
        "createdAt": row.get("created_at"),
    }


def is_truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "t", "yes", "y", "on"}


def can_manage_users(admin: dict[str, Any]) -> bool:
    return admin["role"] in {"owner", "admin"}


def owner_count(conn: Any) -> int:
    return conn.execute("SELECT COUNT(*) FROM admins WHERE role = 'owner'").fetchone()[0]


def protected_account_response() -> Response:
    return jsonify({"error": "protected_account", "message": "لا يمكن إيقاف هذا الحساب."}), 403


def ensure_user_manageable(admin: dict[str, Any], target: dict[str, Any], *, action: str) -> Response | None:
    if not can_manage_users(admin):
        return jsonify({"error": "forbidden", "message": "ليس لديك صلاحية لتنفيذ هذه العملية."}), 403
    if action == "disable":
        if target["id"] == admin["id"] or target["role"] == "owner":
            return protected_account_response()
    if action in {"update", "reset_password"} and target["role"] == "owner" and admin["role"] != "owner":
        return jsonify({"error": "forbidden", "message": "ليس لديك صلاحية لتنفيذ هذه العملية."}), 403
    if action == "reset_password" and target["role"] == "owner":
        return jsonify({"error": "protected_account", "message": "لا يمكن إعادة تعيين كلمة مرور هذا الحساب."}), 403
    return None


def audit(conn: Any, admin_id: str | None, action_type: str, entity_type: str, entity_id: str | None, description: str, old_value: Any = None, new_value: Any = None) -> None:
    conn.execute(
        """
        INSERT INTO audit_logs (id, admin_id, action_type, entity_type, entity_id, old_value, new_value, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            public_id("log"),
            admin_id,
            action_type,
            entity_type,
            entity_id,
            json_dumps(old_value) if old_value is not None else None,
            json_dumps(new_value) if new_value is not None else None,
            description,
            now_iso(),
        ),
    )


def recalc_installments(conn: Any, client_id: str) -> None:
    rows = conn.execute("SELECT * FROM installments WHERE client_id = ?", (client_id,)).fetchall()
    today = datetime.now().date()
    for row in rows:
        amount = float(row["amount"] or 0)
        paid = float(row["paid_amount"] or 0)
        remaining = max(0, amount - paid)
        status = row["status"]
        if status != "cancelled":
            due_date = datetime.fromisoformat(row["due_date"]).date() if row["due_date"] else None
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
        conn.execute(
            "UPDATE installments SET remaining_amount = ?, status = ?, updated_at = ? WHERE id = ?",
            (remaining, status, now_iso(), row["id"]),
        )


def recalc_client(conn: Any, client_id: str) -> None:
    client = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
    if not client:
        return
    recalc_installments(conn, client_id)
    paid = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE client_id = ? AND payment_status = 'confirmed'",
        (client_id,),
    ).fetchone()[0] or 0
    # Prefer summing linked apartments when available
    total_from_links = None
    try:
        total_from_links = conn.execute(
            "SELECT COALESCE(SUM(unit_price), 0) FROM client_apartments WHERE client_id = ? AND status != 'cancelled'",
            (client_id,),
        ).fetchone()[0]
    except Exception:
        total_from_links = None
    total = float(total_from_links) if total_from_links is not None else float(client.get("total_amount") or 0)

    remaining = max(0, total - float(paid))
    overdue_count = conn.execute(
        "SELECT COUNT(*) FROM installments WHERE client_id = ? AND status = 'overdue' AND remaining_amount > 0",
        (client_id,),
    ).fetchone()[0] or 0
    if overdue_count:
        payment_status = "overdue"
    elif float(paid) <= 0:
        payment_status = "pending"
    elif float(paid) >= total and total > 0:
        payment_status = "fully_paid"
    else:
        payment_status = "partially_paid"
    paid_amount = float(paid or 0)
    next_reservation_status = None
    if client["reservation_status"] != "cancelled":
        next_reservation_status = "sold" if paid_amount >= SOLD_PAYMENT_THRESHOLD or (total > 0 and paid_amount >= total) else "reserved"
    if next_reservation_status:
        conn.execute(
            """
            UPDATE clients
            SET paid_amount = ?, remaining_amount = ?, payment_status = ?, reservation_status = ?, updated_at = ?
            WHERE id = ?
            """,
            (paid, remaining, payment_status, next_reservation_status, now_iso(), client_id),
        )
    else:
        conn.execute(
            """
            UPDATE clients
            SET paid_amount = ?, remaining_amount = ?, payment_status = ?, updated_at = ?
            WHERE id = ?
            """,
            (paid, remaining, payment_status, now_iso(), client_id),
        )
    sync_apartment_for_client(conn, client_id)


def sync_apartment_for_client(conn: Any, client_id: str) -> None:
    client = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
    if not client:
        return
    # If client_apartments table exists, update each linked apartment; otherwise fall back to legacy single-apartment logic.
    try:
        rows = conn.execute("SELECT * FROM client_apartments WHERE client_id = ? AND status != 'cancelled'", (client_id,)).fetchall()
    except Exception:
        # legacy behavior
        if not client.get("apartment_id"):
            return
        apartment_status = "available"
        assigned_client_id = None
        if client["reservation_status"] != "cancelled":
            assigned_client_id = client["id"]
            paid_amount = float(client["paid_amount"] or 0)
            if paid_amount >= SOLD_PAYMENT_THRESHOLD or client["payment_status"] == "fully_paid":
                apartment_status = "sold"
            elif client["payment_status"] in ("pending", "overdue"):
                apartment_status = "pending_payment"
            else:
                apartment_status = "reserved"
        conn.execute(
            "UPDATE apartments SET status = ?, assigned_client_id = ?, updated_at = ? WHERE id = ?",
            (apartment_status, assigned_client_id, now_iso(), client["apartment_id"]),
        )
        return
    assigned_ids = [r["apartment_id"] for r in rows if r.get("apartment_id")]
    for ca in rows:
        apartment_id = ca["apartment_id"]
        apartment_status = "available"
        assigned_client_id = None
        if client["reservation_status"] != "cancelled":
            assigned_client_id = client["id"]
            paid_amount = float(client["paid_amount"] or 0)
            if paid_amount >= SOLD_PAYMENT_THRESHOLD or client["payment_status"] == "fully_paid":
                apartment_status = "sold"
            elif client["payment_status"] in ("pending", "overdue"):
                apartment_status = "pending_payment"
            else:
                apartment_status = "reserved"
        conn.execute(
            "UPDATE apartments SET status = ?, assigned_client_id = ?, updated_at = ? WHERE id = ?",
            (apartment_status, assigned_client_id, now_iso(), apartment_id),
        )
    # Release any apartments previously assigned to this client but no longer linked
    conn.execute(
        "UPDATE apartments SET status = 'available', assigned_client_id = NULL, updated_at = ? WHERE assigned_client_id = ? AND id NOT IN (SELECT apartment_id FROM client_apartments WHERE client_id = ? AND status != 'cancelled')",
        (now_iso(), client_id, client_id),
    )


def active_client_for_apartment(conn: Any, apartment_id: str, exclude_client_id: str | None = None) -> dict[str, Any] | None:
    if exclude_client_id:
        return conn.execute(
            """
            SELECT * FROM clients
            WHERE apartment_id = ? AND reservation_status != 'cancelled' AND id != ?
            """,
            (apartment_id, exclude_client_id),
        ).fetchone()
    return conn.execute(
        "SELECT * FROM clients WHERE apartment_id = ? AND reservation_status != 'cancelled'",
        (apartment_id,),
    ).fetchone()


def normalized_client_name(name: Any) -> str:
    return " ".join(normalize_display_text(name).strip().casefold().split())


def unique_portfolio_code(conn: Any) -> str:
    while True:
        candidate = normalize_code(f"RES-{secrets.token_hex(3).upper()}")
        existing = conn.execute(
            """
            SELECT id FROM clients
            WHERE UPPER(client_code) = ? OR UPPER(COALESCE(portfolio_code, client_code)) = ?
            """,
            (candidate, candidate),
        ).fetchone()
        if not existing:
            return candidate


def existing_portfolio_for_client_name(conn: Any, name: str) -> str | None:
    normalized = normalized_client_name(name)
    if not normalized:
        return None
    rows = conn.execute(
        """
        SELECT client_code, portfolio_code, full_name
        FROM clients
        WHERE reservation_status != 'cancelled'
        ORDER BY created_at ASC
        """
    ).fetchall()
    for row in rows:
        if normalized_client_name(row["full_name"]) == normalized:
            return normalize_code(row["portfolio_code"] or row["client_code"] or "")
    return None


def consolidate_client_portfolios(conn: Any) -> None:
    rows = conn.execute(
        """
        SELECT id, full_name, client_code, portfolio_code
        FROM clients
        WHERE reservation_status != 'cancelled'
        ORDER BY created_at ASC
        """
    ).fetchall()
    groups: dict[str, list[Any]] = {}
    for row in rows:
        key = normalized_client_name(row["full_name"])
        if not key:
            continue
        groups.setdefault(key, []).append(row)

    for group in groups.values():
        if not group:
            continue
        existing_codes = []
        for row in group:
            code = normalize_code(row["portfolio_code"] or row["client_code"] or "")
            if code and code not in existing_codes:
                existing_codes.append(code)
        if len(existing_codes) == 1:
            portfolio_code = existing_codes[0]
        elif len(group) > 1:
            portfolio_code = unique_portfolio_code(conn)
        else:
            portfolio_code = existing_codes[0] if existing_codes else unique_portfolio_code(conn)
        for row in group:
            if normalize_code(row["portfolio_code"] or "") != portfolio_code:
                conn.execute(
                    "UPDATE clients SET portfolio_code = ?, updated_at = ? WHERE id = ?",
                    (portfolio_code, now_iso(), row["id"]),
                )


def validate_assignment(conn: Any, apartment_id: str, client_id: str | None = None) -> tuple[bool, str | None]:
    apartment = conn.execute("SELECT * FROM apartments WHERE id = ?", (apartment_id,)).fetchone()
    if not apartment:
        return False, "الشقة غير موجودة."
    if apartment["status"] in {"sold", "reserved", "pending_approval", "frozen"} and apartment["assigned_client_id"] != client_id:
        return False, "هذه الشقة غير متاحة للحجز أو بانتظار إجراء آخر."
    other = active_client_for_apartment(conn, apartment_id, exclude_client_id=client_id)
    if other:
        return False, "هذه الشقة محجوزة بالفعل لعميل آخر."
    return True, None


def client_payload(conn: Any, client: dict[str, Any], include_private: bool = True) -> dict[str, Any]:
    # Load apartments linked to the client (client_apartments) when available
    apartments_rows = []
    try:
        apartments_rows = conn.execute(
            "SELECT ca.id AS client_apartment_id, ca.apartment_id AS apartment_id, ca.unit_price AS unit_price, ca.status AS ca_status, ca.assigned_at AS assigned_at, a.unit_code, a.floor_number, a.apartment_type, a.area, a.direction_ar, a.direction_en, a.price AS apt_price, a.status AS apt_status, a.notes AS apt_notes FROM client_apartments ca LEFT JOIN apartments a ON a.id = ca.apartment_id WHERE ca.client_id = ? ORDER BY ca.assigned_at DESC",
            (client["id"],),
        ).fetchall()
    except Exception:
        # fallback to legacy single apartment
        apt = conn.execute("SELECT * FROM apartments WHERE id = ?", (client.get("apartment_id"),)).fetchone() if client.get("apartment_id") else None
        apartments_rows = []
        if apt:
            apartments_rows = [{"apartment_id": apt["id"], "unit_code": apt["unit_code"], "unit_price": apt["price"], "ca_status": apt["status"], "assigned_at": None}]

    apartments = []
    for row in apartments_rows:
        apartments.append({
            "id": row.get("apartment_id"),
            "unitCode": row.get("unit_code"),
            "price": float(row.get("unit_price") or row.get("apt_price") or 0),
            "status": status_title(row.get("ca_status") or row.get("apt_status")),
            "assignedAt": row.get("assigned_at"),
        })

    payments = conn.execute("SELECT payments.*, apartments.unit_code FROM payments LEFT JOIN apartments ON apartments.id = payments.apartment_id WHERE payments.client_id = ? ORDER BY payments.payment_date DESC, payments.created_at DESC", (client["id"],)).fetchall()
    installments = conn.execute("SELECT installments.*, apartments.unit_code FROM installments LEFT JOIN apartments ON apartments.id = installments.apartment_id WHERE installments.client_id = ? ORDER BY installment_number ASC", (client["id"],)).fetchall()

    portfolio_code = client["portfolio_code"] or client["client_code"]
    return {
        "id": client["id"],
        "code": portfolio_code,
        "portfolioCode": portfolio_code,
        "reservationCode": normalize_display_text(client["client_code"]),
        "name": normalize_display_text(client["full_name"]),
        "phone": normalize_display_text(client["phone"]),
        "email": normalize_display_text(client["email"]),
        "nationalId": normalize_display_text(client["national_id"]) if include_private else None,
        "apartmentId": client.get("apartment_id"),
        "reservationStatus": status_title(client["reservation_status"]),
        "reservationDate": client["reservation_date"],
        "expectedDeliveryDate": client.get("expected_delivery_date"),
        "totalAmount": client["total_amount"],
        "paidAmount": client["paid_amount"],
        "remainingAmount": client["remaining_amount"],
        "paymentStatus": status_title(client["payment_status"]),
        "officeNotes": normalize_display_text(client.get("office_notes")),
        "apartment": apartments[0] if apartments else None,
        "apartments": apartments,
        "payments": [payment_payload(row) for row in payments],
        "installments": [installment_payload(row) for row in installments],
    }


def admin_client_list_payload(client: dict[str, Any], apartment: dict[str, Any] | None = None, location: str = "") -> dict[str, Any]:
    portfolio_code = client["portfolio_code"] or client["client_code"]
    return {
        "id": client["id"],
        "code": portfolio_code,
        "portfolioCode": portfolio_code,
        "reservationCode": normalize_display_text(client["client_code"]),
        "name": normalize_display_text(client["full_name"]),
        "phone": normalize_display_text(client["phone"]),
        "email": normalize_display_text(client["email"]),
        "nationalId": normalize_display_text(client["national_id"]),
        "apartmentId": client["apartment_id"],
        "reservationStatus": status_title(client["reservation_status"]),
        "reservationDate": client["reservation_date"],
        "expectedDeliveryDate": client["expected_delivery_date"],
        "totalAmount": client["total_amount"],
        "paidAmount": client["paid_amount"],
        "remainingAmount": client["remaining_amount"],
        "paymentStatus": status_title(client["payment_status"]),
        "officeNotes": normalize_display_text(client["office_notes"]),
        "apartment": apartment_payload(apartment, location=location) if apartment else None,
    }


def joined_apartment_row(row: dict[str, Any]) -> dict[str, Any] | None:
    if not row.get("apt_id"):
        return None
    return {
        "id": row["apt_id"],
        "unit_code": row["apt_unit_code"],
        "floor_number": row["apt_floor_number"],
        "apartment_type": row["apt_apartment_type"],
        "area": row["apt_area"],
        "direction_ar": row["apt_direction_ar"],
        "direction_en": row["apt_direction_en"],
        "price": row["apt_price"],
        "status": row["apt_status"],
        "assigned_client_id": row["apt_assigned_client_id"],
        "notes": row["apt_notes"],
    }


def rows_for_portfolio_code(conn: Any, code: str) -> list[dict[str, Any]]:
    normalized = normalize_code(code)
    return conn.execute(
        """
        SELECT * FROM clients
        WHERE reservation_status != 'cancelled'
          AND (
            UPPER(client_code) = ?
            OR UPPER(COALESCE(portfolio_code, client_code)) = ?
          )
        ORDER BY reservation_date ASC, created_at ASC
        """,
        (normalized, normalized),
    ).fetchall()


def portfolio_payload(conn: Any, rows: list[dict[str, Any]], include_private: bool = False) -> dict[str, Any]:
    unit_payloads = [client_payload(conn, row, include_private=include_private) for row in rows]
    primary = unit_payloads[0]
    total_amount = sum(float(item["totalAmount"] or 0) for item in unit_payloads)
    paid_amount = sum(float(item["paidAmount"] or 0) for item in unit_payloads)
    remaining_amount = max(0, total_amount - paid_amount)
    payment_status = "Partially Paid"
    if remaining_amount <= 0 and total_amount > 0:
        payment_status = "Fully Paid"
    elif paid_amount <= 0:
        payment_status = "Pending"
    if any((item.get("paymentStatus") or "").lower() == "overdue" for item in unit_payloads):
        payment_status = "Overdue"

    all_payments = []
    all_installments = []
    for item in unit_payloads:
        for payment in item.get("payments", []):
            payment["unitCode"] = item.get("apartment", {}).get("unitCode")
            all_payments.append(payment)
        for installment in item.get("installments", []):
            installment["unitCode"] = item.get("apartment", {}).get("unitCode")
            all_installments.append(installment)
    all_payments.sort(key=lambda x: (x.get("date") or "", x.get("id") or ""), reverse=True)
    all_installments.sort(key=lambda x: ((x.get("dueDate") or ""), x.get("installmentNumber") or 0))

    return {
        "id": primary["id"],
        "code": primary["portfolioCode"],
        "portfolioCode": primary["portfolioCode"],
        "name": primary["name"],
        "phone": primary["phone"],
        "email": primary["email"],
        "reservationStatus": primary["reservationStatus"],
        "reservationDate": primary["reservationDate"],
        "expectedDeliveryDate": primary["expectedDeliveryDate"],
        "officeNotes": primary["officeNotes"],
        "totalAmount": total_amount,
        "paidAmount": paid_amount,
        "remainingAmount": remaining_amount,
        "paymentStatus": payment_status,
        "apartments": [
            {
                "clientId": item["id"],
                "reservationCode": item["reservationCode"],
                "reservationStatus": item["reservationStatus"],
                "paymentStatus": item["paymentStatus"],
                "totalAmount": item["totalAmount"],
                "paidAmount": item["paidAmount"],
                "remainingAmount": item["remainingAmount"],
                "apartment": item.get("apartment"),
            }
            for item in unit_payloads
        ],
        "apartment": primary.get("apartment"),
        "payments": all_payments,
        "installments": all_installments,
    }


def apartment_payload(row: dict[str, Any] | dict[str, Any], location: str | None = None) -> dict[str, Any]:
    return {
        "id": row["id"],
        "unitCode": row["unit_code"],
        "floorNumber": row["floor_number"],
        "apartmentType": row["apartment_type"],
        "area": row["area"],
        "directionAr": normalize_display_text(row["direction_ar"]),
        "directionEn": row["direction_en"],
        "price": row["price"],
        "status": status_title(row["status"]),
        "assignedClientId": row["assigned_client_id"],
        "buildingName": "مشروع أرض عبدالجليل",
        "location": location if location is not None else get_setting("office_address"),
        "notes": normalize_display_text(row["notes"]),
        "features": apartment_features(row["apartment_type"]),
    }


def apartment_features(apartment_type: str) -> list[str]:
    if apartment_type == "A":
        return ["Wide layout", "Large area", "Good ventilation", "Private reservation", "Elevator access"]
    if apartment_type == "B":
        return ["North-facing unit", "Premium finishing", "Family-friendly space", "Elevator access"]
    return ["South-facing unit", "Good ventilation", "Family-friendly space", "Private reservation"]


def payment_payload(row: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "id": row["id"],
        "clientId": row["client_id"],
        "apartmentId": row["apartment_id"],
        "date": row["payment_date"],
        "amount": row["amount"],
        "method": status_title(row["payment_method"]),
        "status": status_title(row["payment_status"]),
        "reference": normalize_display_text(row["receipt_number"] or row["reference_number"]),
        "receiptNumber": normalize_display_text(row["receipt_number"]),
        "referenceNumber": normalize_display_text(row["reference_number"]),
        "notes": normalize_display_text(row["notes"]),
    }
    if "client_name" in row:
        payload["clientName"] = normalize_display_text(row["client_name"])
    if "unit_code" in row:
        payload["unitCode"] = normalize_display_text(row["unit_code"])
    return payload


def installment_payload(row: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "id": row["id"],
        "clientId": row["client_id"],
        "apartmentId": row["apartment_id"],
        "installmentNumber": row["installment_number"],
        "dueDate": row["due_date"],
        "amount": row["amount"],
        "paidAmount": row["paid_amount"],
        "remainingAmount": row["remaining_amount"],
        "status": row["status"],
        "paymentId": row["payment_id"],
        "notes": row["notes"],
    }
    if "client_name" in row:
        payload["clientName"] = normalize_display_text(row["client_name"])
    if "unit_code" in row:
        payload["unitCode"] = normalize_display_text(row["unit_code"])
    return payload


def deal_payload(conn: Any, row: dict[str, Any]) -> dict[str, Any]:
    columns = set(row.keys())
    apartment = conn.execute("SELECT * FROM apartments WHERE id = ?", (row["apartment_id"],)).fetchone() if row["apartment_id"] else None
    assistant = conn.execute("SELECT id, full_name, email, role, created_at FROM admins WHERE id = ?", (row["assistant_id"],)).fetchone()
    contracts = conn.execute("SELECT * FROM contracts WHERE deal_id = ? ORDER BY created_at DESC", (row["id"],)).fetchall()
    client = conn.execute(
        "SELECT client_code, portfolio_code FROM clients WHERE id = ?",
        (row["client_id"],),
    ).fetchone() if "client_id" in columns and row["client_id"] else None
    proposed_total = float(row["proposed_total"] or 0)
    down_payment = float(row["down_payment"] or 0) if "down_payment" in columns else 0
    return {
        "id": row["id"],
        "assistantId": row["assistant_id"],
        "assistant": admin_public_payload(assistant) if assistant else None,
        "clientId": row["client_id"] if "client_id" in columns else None,
        "reservationCode": normalize_display_text(client["client_code"]) if client else None,
        "portfolioCode": normalize_display_text(client["portfolio_code"] or client["client_code"]) if client else None,
        "clientName": row["client_name"],
        "clientPhone": row["client_phone"],
        "apartmentId": row["apartment_id"],
        "apartment": apartment_payload(apartment) if apartment else None,
        "proposedTotal": proposed_total,
        "downPayment": down_payment,
        "remainingAmount": max(0, proposed_total - down_payment),
        "paymentPlan": row["payment_plan"] if "payment_plan" in columns else None,
        "notes": row["notes"],
        "status": row["status"],
        "ownerNotes": row["owner_notes"],
        "approvedBy": row["approved_by"],
        "approvedAt": row["approved_at"],
        "submittedAt": row["submitted_at"] if "submitted_at" in columns else None,
        "finalizedAt": row["finalized_at"] if "finalized_at" in columns else None,
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "contracts": [contract_payload(contract) for contract in contracts],
        "riskWarnings": deal_risk_review(conn, row),
    }


def contract_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "dealId": row["deal_id"],
        "contractType": row["contract_type"],
        "status": row["status"],
        "pdfUrl": row["pdf_url"],
        "issuedBy": row["issued_by"],
        "issuedAt": row["issued_at"],
        "createdAt": row["created_at"],
    }


def setting_json(conn: Any, key: str, default: Any) -> Any:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    if not row:
        return default
    try:
        return json.loads(row["value"])
    except (TypeError, json.JSONDecodeError):
        return default


def upsert_setting(conn: Any, key: str, value: Any) -> None:
    stored = json_dumps(value) if isinstance(value, (dict, list)) else str(value)
    conn.execute(
        """
        INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        """,
        (key, stored, now_iso()),
    )


def owner_settings_payload(conn: Any) -> dict[str, Any]:
    settings = all_settings(conn)
    contract_template = setting_json(conn, "contract_template", {})
    if "footer_text" not in contract_template and settings.get("statement_footer"):
        contract_template["footer_text"] = settings.get("statement_footer")
    system_settings = setting_json(conn, "system_settings", {})
    if "receipt_prefix" not in system_settings:
        system_settings["receipt_prefix"] = settings.get("receipt_prefix", "RCPT")
    return {
        "office": {
            "office_name": settings.get("office_name", ""),
            "office_phone": settings.get("office_phone", ""),
            "whatsapp_number": settings.get("whatsapp_number", ""),
            "office_address": settings.get("office_address", ""),
            "office_email": settings.get("office_email", ""),
            "currency": settings.get("currency", "EGP"),
            "office_logo": settings.get("office_logo", ""),
        },
        "contractTemplate": contract_template,
        "priceSettings": setting_json(conn, "price_settings", {}),
        "permissionSettings": setting_json(conn, "permission_settings", {}),
        "systemSettings": system_settings,
        "mediaSettings": setting_json(conn, "media_settings", {}),
    }


def owner_dashboard_summary_payload(conn: Any) -> dict[str, Any]:
    for client in conn.execute("SELECT id FROM clients").fetchall():
        recalc_client(conn, client["id"])
    total_apartments = conn.execute("SELECT COUNT(*) FROM apartments").fetchone()[0]
    available = conn.execute("SELECT COUNT(*) FROM apartments WHERE status = 'available'").fetchone()[0]
    reserved = conn.execute("SELECT COUNT(*) FROM apartments WHERE status = 'reserved'").fetchone()[0]
    sold = conn.execute("SELECT COUNT(*) FROM apartments WHERE status = 'sold'").fetchone()[0]
    pending_deals = conn.execute("SELECT COUNT(*) FROM deals WHERE status = 'pending_approval'").fetchone()[0]
    revision_deals = conn.execute("SELECT COUNT(*) FROM deals WHERE status = 'revision_requested'").fetchone()[0]
    total_sales = conn.execute(
        "SELECT COALESCE(SUM(total_amount), 0) FROM clients WHERE reservation_status != 'cancelled'"
    ).fetchone()[0]
    total_collected = conn.execute(
        "SELECT COALESCE(SUM(paid_amount), 0) FROM clients WHERE reservation_status != 'cancelled'"
    ).fetchone()[0]
    total_remaining = conn.execute(
        "SELECT COALESCE(SUM(remaining_amount), 0) FROM clients WHERE reservation_status != 'cancelled'"
    ).fetchone()[0]
    overdue_installments = conn.execute(
        "SELECT COUNT(*) FROM installments WHERE status = 'overdue' AND remaining_amount > 0"
    ).fetchone()[0]
    pending_payments = conn.execute("SELECT COUNT(*) FROM payments WHERE payment_status = 'pending'").fetchone()[0]
    active_assistants = conn.execute("SELECT COUNT(*) FROM admins WHERE role = 'assistant'").fetchone()[0]
    return {
        "totalApartments": total_apartments,
        "availableApartments": available,
        "reservedApartments": reserved,
        "soldApartments": sold,
        "pendingDeals": pending_deals,
        "revisionDeals": revision_deals,
        "totalSales": total_sales,
        "totalCollected": total_collected,
        "totalRemaining": total_remaining,
        "overdueInstallments": overdue_installments,
        "pendingPayments": pending_payments,
        "activeAssistants": active_assistants,
    }


def owner_alerts_payload(conn: Any) -> list[dict[str, Any]]:
    summary = owner_dashboard_summary_payload(conn)
    alerts: list[dict[str, Any]] = []
    if summary["pendingDeals"]:
        alerts.append({"type": "deal", "severity": "warning", "count": summary["pendingDeals"], "message": "يوجد ديل جديد بانتظار الموافقة."})
    if summary["overdueInstallments"]:
        alerts.append({"type": "installment", "severity": "danger", "count": summary["overdueInstallments"], "message": "يوجد قسط متأخر السداد."})
    if summary["pendingPayments"]:
        alerts.append({"type": "payment", "severity": "warning", "count": summary["pendingPayments"], "message": "توجد دفعة قيد المراجعة."})
    pending_units = conn.execute("SELECT COUNT(*) FROM apartments WHERE status = 'pending_approval'").fetchone()[0]
    if pending_units:
        alerts.append({"type": "apartment", "severity": "info", "count": pending_units, "message": "توجد شقة بانتظار موافقة الإدارة."})
    if summary["revisionDeals"]:
        alerts.append({"type": "revision", "severity": "info", "count": summary["revisionDeals"], "message": "يوجد ديل مطلوب تعديله من المساعد."})
    return alerts


def assistant_performance_payload(conn: Any) -> list[dict[str, Any]]:
    assistants = conn.execute("SELECT id, full_name, email, role, created_at FROM admins WHERE role = 'assistant' ORDER BY full_name").fetchall()
    result: list[dict[str, Any]] = []
    for assistant in assistants:
        counts = {
            row["status"]: row["count"]
            for row in conn.execute(
                "SELECT status, COUNT(*) AS count FROM deals WHERE assistant_id = ? GROUP BY status",
                (assistant["id"],),
            ).fetchall()
        }
        approved = counts.get("approved", 0) + counts.get("finalized", 0)
        rejected = counts.get("rejected", 0)
        decided = approved + rejected
        result.append(
            {
                "assistant": admin_public_payload(assistant),
                "totalDeals": sum(counts.values()),
                "approvedDeals": approved,
                "rejectedDeals": rejected,
                "pendingDeals": counts.get("pending_approval", 0),
                "revisionDeals": counts.get("revision_requested", 0),
                "successRate": round((approved / decided) * 100) if decided else 0,
            }
        )
    return result


def deal_risk_review(conn: Any, row: dict[str, Any]) -> list[dict[str, str]]:
    risks: list[dict[str, str]] = []
    columns = set(row.keys())
    apartment = conn.execute("SELECT * FROM apartments WHERE id = ?", (row["apartment_id"],)).fetchone() if row["apartment_id"] else None
    price_settings = setting_json(conn, "price_settings", {})
    proposed_total = float(row["proposed_total"] or 0)
    down_payment = float(row["down_payment"] or 0) if "down_payment" in columns else 0
    if apartment:
        minimum_key = f"min_price_{apartment['area']}"
        minimum_price = float(price_settings.get(minimum_key) or 0)
        if minimum_price and proposed_total < minimum_price:
            risks.append({"severity": "danger", "message": "السعر أقل من الحد الأدنى المحدد."})
        duplicate_pending = conn.execute(
            """
            SELECT COUNT(*) FROM deals
            WHERE apartment_id = ? AND id != ? AND status IN ('pending_approval','approved')
            """,
            (apartment["id"], row["id"]),
        ).fetchone()[0]
        if duplicate_pending:
            risks.append({"severity": "warning", "message": "الشقة عليها ديل آخر بانتظار الموافقة أو معتمد."})
    minimum_down_percent = float(price_settings.get("minimum_down_payment_percent") or 0)
    if minimum_down_percent and proposed_total > 0 and down_payment < (proposed_total * minimum_down_percent / 100):
        risks.append({"severity": "warning", "message": "المقدم أقل من النسبة المطلوبة."})
    if proposed_total > 0 and (proposed_total - down_payment) / proposed_total >= 0.75:
        risks.append({"severity": "info", "message": "يوجد مبلغ كبير متبقي."})
    if not row["notes"]:
        risks.append({"severity": "info", "message": "لا توجد ملاحظات توضح تفاصيل الديل."})
    return risks


def unique_client_code(conn: Any, unit_code: str | None = None) -> str:
    prefix = f"RES-{unit_code}" if unit_code else "RES"
    while True:
        candidate = f"{prefix}-{secrets.token_hex(3).upper()}"
        if not conn.execute("SELECT id FROM clients WHERE upper(client_code) = upper(?)", (candidate,)).fetchone():
            return candidate


def activate_client_for_deal(conn: Any, deal: dict[str, Any], admin_id: str) -> str | None:
    if not deal["apartment_id"]:
        return None
    apartment = conn.execute("SELECT * FROM apartments WHERE id = ?", (deal["apartment_id"],)).fetchone()
    if not apartment:
        return None
    existing_client_id = deal["client_id"] if "client_id" in set(deal.keys()) else None
    active_client = active_client_for_apartment(conn, apartment["id"], exclude_client_id=existing_client_id)
    if active_client:
        raise ValueError("هذه الشقة محجوزة بالفعل لعميل آخر.")
    client_id = existing_client_id
    if not client_id:
        client_id = public_id("client")
        client_code = unique_client_code(conn, apartment["unit_code"])
        conn.execute(
            """
            INSERT INTO clients (
              id, full_name, phone, email, national_id, client_code, portfolio_code, apartment_id,
              reservation_status, reservation_date, expected_delivery_date, total_amount, paid_amount,
              remaining_amount, payment_status, office_notes, created_at, updated_at
            ) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, 'reserved', ?, NULL, ?, 0, ?, 'pending', ?, ?, ?)
            """,
            (
                client_id,
                deal["client_name"],
                deal["client_phone"],
                client_code,
                client_code,
                apartment["id"],
                datetime.now().date().isoformat(),
                float(deal["proposed_total"] or apartment["price"] or 0),
                float(deal["proposed_total"] or apartment["price"] or 0),
                "تم إنشاء ملف العميل تلقائيًا بعد موافقة المالك على الديل.",
                now_iso(),
                now_iso(),
            ),
        )
    else:
        conn.execute(
            """
            UPDATE clients
            SET full_name = ?, phone = ?, apartment_id = ?, reservation_status = 'reserved',
                total_amount = ?, remaining_amount = MAX(0, ? - paid_amount), updated_at = ?
            WHERE id = ?
            """,
            (
                deal["client_name"],
                deal["client_phone"],
                apartment["id"],
                float(deal["proposed_total"] or apartment["price"] or 0),
                float(deal["proposed_total"] or apartment["price"] or 0),
                now_iso(),
                client_id,
            ),
        )
    conn.execute("UPDATE deals SET client_id = ?, updated_at = ? WHERE id = ?", (client_id, now_iso(), deal["id"]))
    conn.execute(
        "UPDATE apartments SET status = 'reserved', assigned_client_id = ?, updated_at = ? WHERE id = ?",
        (client_id, now_iso(), apartment["id"]),
    )
    audit(conn, admin_id, "activate", "client", client_id, f"تم تفعيل كود الحجز للعميل {deal['client_name']}")
    return client_id


def release_apartment_for_deal(conn: Any, deal: dict[str, Any], admin_id: str | None = None) -> bool:
    if not deal["apartment_id"]:
        return False
    apartment = conn.execute("SELECT status FROM apartments WHERE id = ?", (deal["apartment_id"],)).fetchone()
    if apartment and apartment["status"] == "sold":
        return False
    active_client = active_client_for_apartment(conn, deal["apartment_id"], exclude_client_id=deal["client_id"] if "client_id" in set(deal.keys()) else None)
    active_deal = conn.execute(
        """
        SELECT id FROM deals
        WHERE apartment_id = ? AND id != ? AND status IN ('pending_approval','approved','finalized')
        LIMIT 1
        """,
        (deal["apartment_id"], deal["id"]),
    ).fetchone()
    if not active_client and not active_deal:
        conn.execute("UPDATE apartments SET status = 'available', assigned_client_id = NULL, updated_at = ? WHERE id = ?", (now_iso(), deal["apartment_id"]))
        if admin_id:
            audit(conn, admin_id, "release_apartment", "apartment", deal["apartment_id"], "تم تحرير الشقة بعد إلغاء الديل", {"deal_id": deal["id"]}, {"status": "available"})
        return True
    return False


def deal_has_payments(conn: Any, deal: dict[str, Any]) -> bool:
    client_id = deal["client_id"] if "client_id" in set(deal.keys()) else None
    if client_id and conn.execute("SELECT id FROM payments WHERE client_id = ? LIMIT 1", (client_id,)).fetchone():
        return True
    if deal["apartment_id"] and conn.execute("SELECT id FROM payments WHERE apartment_id = ? LIMIT 1", (deal["apartment_id"],)).fetchone():
        return True
    return False


def client_has_payments(conn: Any, client_id: str) -> bool:
    return bool(conn.execute("SELECT id FROM payments WHERE client_id = ? LIMIT 1", (client_id,)).fetchone())


def client_has_deals(conn: Any, client_id: str) -> bool:
    return bool(conn.execute("SELECT id FROM deals WHERE client_id = ? LIMIT 1", (client_id,)).fetchone())


def verify_admin_confirmation_password(admin: dict[str, Any], password: str) -> bool:
    if not password:
        return False
    with db() as conn:
        row = conn.execute("SELECT password_hash, password_salt FROM admins WHERE id = ?", (admin["id"],)).fetchone()
        if not row:
            return False
        return verify_password(password, row["password_hash"], row["password_salt"])


def get_setting(key: str) -> str:
    with db() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        return normalize_display_text(row["value"]) if row else ""


def all_settings(conn: Any | None = None) -> dict[str, str]:
    owns = conn is None
    conn = conn or db()
    try:
        return {row["key"]: normalize_display_text(row["value"]) for row in conn.execute("SELECT * FROM settings").fetchall()}
    finally:
        if owns:
            conn.close()


def receipt_number(conn: Any) -> str:
    settings = all_settings(conn)
    prefix = settings.get("receipt_prefix", "RCPT")
    count = conn.execute("SELECT COUNT(*) FROM payments WHERE receipt_number IS NOT NULL").fetchone()[0] + 1
    candidate = f"{prefix}-{count:04d}"
    while conn.execute("SELECT id FROM payments WHERE receipt_number = ?", (candidate,)).fetchone():
        count += 1
        candidate = f"{prefix}-{count:04d}"
    return candidate


def ar_text(text: Any) -> str:
    text = normalize_display_text(text)
    if arabic_reshaper and get_display:
        try:
            return get_display(arabic_reshaper.reshape(text))
        except Exception:
            return text
    return text


def register_arabic_font() -> str:
    candidates = [
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/tahoma.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for font_path in candidates:
        if font_path.exists():
            try:
                pdfmetrics.registerFont(TTFont("ArabicUI", str(font_path)))
                return "ArabicUI"
            except Exception:
                pass
    return "Helvetica"


PDF_FONT = register_arabic_font()


def draw_rtl_line(c: canvas.Canvas, text: str, x: float, y: float, size: int = 11, bold: bool = False) -> None:
    c.setFont(PDF_FONT, size)
    c.drawRightString(x, y, ar_text(text))


def generate_pdf(title: str, sections: list[tuple[str, list[str]]], filename: str, footer: str) -> Path:
    path = GENERATED_DIR / filename
    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    y = height - 24 * mm
    c.setFillColor(colors.HexColor("#171512"))
    draw_rtl_line(c, title, width - 20 * mm, y, 18)
    y -= 10 * mm
    c.setStrokeColor(colors.HexColor("#d9b565"))
    c.line(20 * mm, y, width - 20 * mm, y)
    y -= 10 * mm
    for section_title, lines in sections:
        if y < 35 * mm:
            draw_rtl_line(c, footer, width - 20 * mm, 18 * mm, 9)
            c.showPage()
            y = height - 24 * mm
        c.setFillColor(colors.HexColor("#9c6f38"))
        draw_rtl_line(c, section_title, width - 20 * mm, y, 14)
        y -= 8 * mm
        c.setFillColor(colors.HexColor("#171512"))
        for line in lines:
            if y < 25 * mm:
                draw_rtl_line(c, footer, width - 20 * mm, 18 * mm, 9)
                c.showPage()
                y = height - 24 * mm
            draw_rtl_line(c, line, width - 20 * mm, y, 11)
            y -= 7 * mm
        y -= 4 * mm
    c.setFillColor(colors.HexColor("#62584a"))
    draw_rtl_line(c, footer, width - 20 * mm, 18 * mm, 9)
    c.save()
    return path


def format_money(value: Any) -> str:
    return f"{float(value or 0):,.0f} جنيه"


def rate_limited(ip: str) -> bool:
    now = time.time()
    attempts = [ts for ts in client_code_attempts.get(ip, []) if now - ts < CLIENT_RATE_LIMIT_SECONDS]
    attempts.append(now)
    client_code_attempts[ip] = attempts
    return len(attempts) > CLIENT_RATE_LIMIT_ATTEMPTS


def login_rate_limited(identifier: str) -> bool:
    """Check recent failed login attempts without counting the current request."""
    now = time.time()
    attempts = [ts for ts in login_attempts.get(identifier, []) if now - ts < LOGIN_RATE_LIMIT_SECONDS]
    login_attempts[identifier] = attempts
    return len(attempts) >= LOGIN_RATE_LIMIT_ATTEMPTS


def record_login_failure(identifier: str) -> None:
    now = time.time()
    attempts = [ts for ts in login_attempts.get(identifier, []) if now - ts < LOGIN_RATE_LIMIT_SECONDS]
    attempts.append(now)
    login_attempts[identifier] = attempts


def clear_login_failures(identifier: str) -> None:
    login_attempts.pop(identifier, None)


@app.get("/")
def index() -> Response:
    return send_file(INDEX_PATH, max_age=0)


@app.get("/health")
def health() -> Response:
    return cached_public_json("health", lambda: {"status": "ok"})


@app.get("/ping")
def ping() -> tuple[str, int]:
    """Ultra-light keep-alive endpoint for uptime monitors; intentionally avoids the database."""
    return "ok", 200


@app.get("/api/health-db")
def health_db() -> Response:
    try:
        with db() as conn:
            conn.execute("SELECT 1").fetchone()
        return jsonify({"status": "ok", "database": "ok"})
    except Exception:
        return jsonify({"status": "error", "database": "unavailable"}), 503


@app.get("/favicon.ico")
def favicon() -> Response:
    return send_from_directory(BASE_DIR / "static", "favicon.ico", mimetype="image/vnd.microsoft.icon")


@app.get("/generated/<path:filename>")
def generated(filename: str) -> Response:
    return send_from_directory(GENERATED_DIR, filename)


@app.get("/api/public/overview")
def public_overview() -> Response:
    def load_public_overview() -> dict[str, Any]:
        with db() as conn:
            settings = all_settings(conn)
            location = settings.get("office_address", "")
            apartments = [apartment_payload(row, location=location) for row in conn.execute("SELECT * FROM apartments ORDER BY floor_number, apartment_type").fetchall()]
            return {
                "settings": {
                    "officeName": settings.get("office_name"),
                    "officePhone": settings.get("office_phone"),
                    "whatsappNumber": settings.get("whatsapp_number"),
                    "officeAddress": settings.get("office_address"),
                    "currency": settings.get("currency", "EGP"),
                },
                "summary": {
                    "totalApartments": len(apartments),
                    "availableApartments": sum(1 for apt in apartments if apt["status"] == "Available"),
                    "reservedApartments": sum(1 for apt in apartments if apt["status"] in {"Reserved", "Pending Approval", "Pending Payment"}),
                    "soldApartments": sum(1 for apt in apartments if apt["status"] == "Sold"),
                    "floors": 7,
                    "areas": [137, 125, 120],
                },
                "apartments": apartments,
            }

    return cached_public_json("public_overview", load_public_overview)


@app.get("/api/client/reservation/<code>")
def client_reservation(code: str) -> Response:
    normalized = normalize_code(code)
    if not normalized:
        return jsonify({"error": "invalid_code", "message": "لم نتمكن من التحقق من كود الحجز. يرجى التأكد من الكود والمحاولة مرة أخرى أو التواصل مع المكتب."}), 400
    with db() as conn:
        rows = rows_for_portfolio_code(conn, normalized)
        if not rows:
            return jsonify({"error": "invalid_code", "message": "لم نتمكن من التحقق من كود الحجز. يرجى التأكد من الكود والمحاولة مرة أخرى أو التواصل مع المكتب."}), 404
        for row in rows:
            recalc_client(conn, row["id"])
        refreshed_rows = rows_for_portfolio_code(conn, normalized)
        return jsonify({"client": portfolio_payload(conn, refreshed_rows, include_private=False)})


@app.post("/api/client/verify-code")
def verify_client_code() -> Response:
    if rate_limited(request.remote_addr or "unknown"):
        return jsonify({"error": "rate_limited", "message": "يرجى المحاولة لاحقًا."}), 429
    payload = request.get_json(silent=True) or {}
    code = normalize_code(payload.get("code", ""))
    if not code:
        return jsonify({"error": "invalid_code", "message": "لم نتمكن من التحقق من كود الحجز. يرجى التأكد من الكود والمحاولة مرة أخرى أو التواصل مع المكتب."}), 400
    with db() as conn:
        rows = rows_for_portfolio_code(conn, code)
        if not rows:
            return jsonify({"error": "invalid_code", "message": "لم نتمكن من التحقق من كود الحجز. يرجى التأكد من الكود والمحاولة مرة أخرى أو التواصل مع المكتب."}), 404
        for row in rows:
            recalc_client(conn, row["id"])
        refreshed_rows = rows_for_portfolio_code(conn, code)
        settings = all_settings(conn)
        return jsonify(
            {
                "client": portfolio_payload(conn, refreshed_rows, include_private=False),
                "settings": {
                    "officeName": settings.get("office_name"),
                    "officePhone": settings.get("office_phone"),
                    "whatsappNumber": settings.get("whatsapp_number"),
                },
            }
        )


@app.post("/api/admin/login")
def admin_login() -> Response:
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    ip = request.remote_addr or "unknown"
    login_identifier = email or ip
    
    with db() as conn:
        admin = conn.execute("SELECT * FROM admins WHERE lower(email) = ?", (email,)).fetchone()
        
        # Failed login - invalid credentials
        if not admin or not verify_password(password, admin["password_hash"], admin["password_salt"]):
            if login_rate_limited(login_identifier):
                return jsonify({"error": "rate_limited", "message": "عدد محاولات تسجيل الدخول كبير. يرجى المحاولة لاحقًا."}), 429
            record_login_failure(login_identifier)
            audit(conn, None, "login_failed", "admin", None, f"محاولة دخول فاشلة من {ip} بريد: {email}")
            return jsonify({"error": "invalid_login", "message": "بيانات تسجيل الدخول غير صحيحة."}), 401
        
        # Account is disabled
        if not admin["is_active"]:
            audit(conn, admin["id"], "login_inactive", "admin", admin["id"], f"محاولة دخول لحساب موقوف من {ip}")
            return jsonify({"error": "inactive_user", "message": "تم إيقاف هذا الحساب. يرجى التواصل مع الإدارة."}), 403
        
        # Successful login - create session and update last_login_at
        session_id = public_id("session")
        expires_at = (datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)).isoformat(timespec="seconds")
        conn.execute(
            "INSERT INTO admin_sessions (id, admin_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (session_id, admin["id"], expires_at, now_iso()),
        )
        
        # Update last_login_at
        conn.execute(
            "UPDATE admins SET last_login_at = ? WHERE id = ?",
            (now_iso(), admin["id"]),
        )
        clear_login_failures(login_identifier)
        
        audit(conn, admin["id"], "login_success", "admin", admin["id"], f"تم تسجيل دخول الإدارة من {ip}")
        
        response_payload = {"admin": admin_public_payload(admin)}
        
        # Add must_change_password flag if needed
        if admin.get("must_change_password"):
            response_payload["must_change_password"] = True
        
        response = jsonify(response_payload)
        response.set_cookie(
            SESSION_COOKIE,
            session_id,
            httponly=True,
            secure=APP_ENV == "production",
            samesite="Lax",
            max_age=SESSION_DAYS * 86400,
        )
        return response


@app.post("/api/admin/logout")
def admin_logout() -> Response:
    session_id = request.cookies.get(SESSION_COOKIE)
    with db() as conn:
        if session_id:
            conn.execute("DELETE FROM admin_sessions WHERE id = ?", (session_id,))
    response = jsonify({"ok": True})
    response.delete_cookie(SESSION_COOKIE)
    return response


@app.get("/api/admin/me")
def admin_me() -> Response:
    admin = current_admin()
    if not admin:
        return jsonify({"admin": None}), 401
    return jsonify({"admin": admin_public_payload(admin)})


@app.get("/api/admin/bootstrap")
def admin_bootstrap() -> Response:
    admin = require_admin()
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        settings = all_settings(conn)
        summary = {
            "totalClients": conn.execute("SELECT COUNT(*) FROM clients WHERE reservation_status != 'cancelled'").fetchone()[0],
            "totalApartments": conn.execute("SELECT COUNT(*) FROM apartments").fetchone()[0],
            "availableApartments": conn.execute("SELECT COUNT(*) FROM apartments WHERE status = 'available'").fetchone()[0],
            "reservedApartments": conn.execute("SELECT COUNT(*) FROM apartments WHERE status IN ('reserved','pending_payment','pending_approval')").fetchone()[0],
            "soldApartments": conn.execute("SELECT COUNT(*) FROM apartments WHERE status = 'sold'").fetchone()[0],
            "pendingApproval": conn.execute("SELECT COUNT(*) FROM deals WHERE status = 'pending_approval'").fetchone()[0],
            "totalSales": conn.execute("SELECT COALESCE(SUM(total_amount), 0) FROM clients WHERE reservation_status != 'cancelled'").fetchone()[0],
            "totalPaid": conn.execute("SELECT COALESCE(SUM(paid_amount), 0) FROM clients WHERE reservation_status != 'cancelled'").fetchone()[0],
            "totalCollected": conn.execute("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_status = 'confirmed'").fetchone()[0],
            "totalRemaining": conn.execute("SELECT COALESCE(SUM(remaining_amount), 0) FROM clients WHERE reservation_status != 'cancelled'").fetchone()[0],
            "overdueInstallments": conn.execute("SELECT COUNT(*) FROM installments WHERE status = 'overdue' AND remaining_amount > 0").fetchone()[0],
            "overdueClients": conn.execute("SELECT COUNT(*) FROM clients WHERE payment_status = 'overdue'").fetchone()[0],
            "upcomingInstallments": conn.execute("SELECT COUNT(*) FROM installments WHERE status IN ('upcoming','due')").fetchone()[0],
            "pendingPayments": conn.execute("SELECT COUNT(*) FROM payments WHERE payment_status = 'pending'").fetchone()[0],
            "pendingDeals": conn.execute("SELECT COUNT(*) FROM deals WHERE status = 'pending_approval'").fetchone()[0],
        }
        return jsonify(
            {
                "admin": admin_public_payload(admin),
                "summary": summary,
                "settings": {
                    "office_name": settings.get("office_name"),
                    "office_phone": settings.get("office_phone"),
                    "whatsapp_number": settings.get("whatsapp_number"),
                    "office_address": settings.get("office_address"),
                    "currency": settings.get("currency", "EGP"),
                },
                "rolePermissions": {
                    "canManageUsers": can_manage_users(admin),
                    "canManagePayments": admin["role"] in {"owner", "admin", "accountant"},
                    "canManageDeals": admin["role"] in {"owner", "admin", "assistant"},
                },
            }
        )


@app.get("/api/admin/dashboard-summary")
def admin_dashboard_summary() -> Response:
    admin = require_admin()
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        summary = {
            "totalClients": conn.execute("SELECT COUNT(*) FROM clients WHERE reservation_status != 'cancelled'").fetchone()[0],
            "totalApartments": conn.execute("SELECT COUNT(*) FROM apartments").fetchone()[0],
            "availableApartments": conn.execute("SELECT COUNT(*) FROM apartments WHERE status = 'available'").fetchone()[0],
            "reservedApartments": conn.execute("SELECT COUNT(*) FROM apartments WHERE status IN ('reserved','pending_payment','pending_approval')").fetchone()[0],
            "soldApartments": conn.execute("SELECT COUNT(*) FROM apartments WHERE status = 'sold'").fetchone()[0],
            "pendingApproval": conn.execute("SELECT COUNT(*) FROM deals WHERE status = 'pending_approval'").fetchone()[0],
            "totalSales": conn.execute("SELECT COALESCE(SUM(total_amount), 0) FROM clients WHERE reservation_status != 'cancelled'").fetchone()[0],
            "totalPaid": conn.execute("SELECT COALESCE(SUM(paid_amount), 0) FROM clients WHERE reservation_status != 'cancelled'").fetchone()[0],
            "totalCollected": conn.execute("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_status = 'confirmed'").fetchone()[0],
            "totalRemaining": conn.execute("SELECT COALESCE(SUM(remaining_amount), 0) FROM clients WHERE reservation_status != 'cancelled'").fetchone()[0],
            "overdueInstallments": conn.execute("SELECT COUNT(*) FROM installments WHERE status = 'overdue' AND remaining_amount > 0").fetchone()[0],
            "overdueClients": conn.execute("SELECT COUNT(*) FROM clients WHERE payment_status = 'overdue'").fetchone()[0],
            "upcomingInstallments": conn.execute("SELECT COUNT(*) FROM installments WHERE status IN ('upcoming','due')").fetchone()[0],
            "pendingPayments": conn.execute("SELECT COUNT(*) FROM payments WHERE payment_status = 'pending'").fetchone()[0],
        }
        return jsonify({"summary": summary})


@app.get("/api/admin/apartments")
def list_admin_apartments() -> Response:
    admin = require_admin()
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        settings = all_settings(conn)
        rows = conn.execute("SELECT * FROM apartments ORDER BY floor_number, apartment_type").fetchall()
        return jsonify({"apartments": [apartment_payload(row, location=settings.get("office_address", "")) for row in rows]})


@app.post("/api/admin/apartments")
def create_admin_apartment() -> Response:
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    unit_code = normalize_code(payload.get("unit_code") or payload.get("unitCode") or "")
    apartment_type = (payload.get("apartment_type") or payload.get("apartmentType") or "").strip().upper()
    if not unit_code or apartment_type not in {"A", "B", "C"}:
        return jsonify({"error": "validation", "message": "لا يمكن تنفيذ العملية. يرجى مراجعة البيانات."}), 400
    defaults = {
        "A": (137, "بحري قبلي", "North/South Facing"),
        "B": (125, "بحري", "North Facing"),
        "C": (120, "قبلي", "South Facing"),
    }
    area, direction_ar, direction_en = defaults[apartment_type]
    with db() as conn:
        if conn.execute("SELECT id FROM apartments WHERE UPPER(unit_code) = ?", (unit_code,)).fetchone():
            return jsonify({"error": "duplicate_unit", "message": "رقم الشقة مستخدم بالفعل."}), 409
        apartment_id = public_id("apt")
        conn.execute(
            """
            INSERT INTO apartments (
              id, unit_code, floor_number, apartment_type, area, direction_ar, direction_en,
              price, status, assigned_client_id, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
            """,
            (
                apartment_id,
                unit_code,
                int(payload.get("floor_number") or payload.get("floorNumber") or 1),
                apartment_type,
                int(payload.get("area") or area),
                payload.get("direction_ar") or payload.get("directionAr") or direction_ar,
                payload.get("direction_en") or payload.get("directionEn") or direction_en,
                float(payload.get("price") or 0),
                status_db(payload.get("status") or "available", "apartment"),
                payload.get("notes"),
                now_iso(),
                now_iso(),
            ),
        )
        audit(conn, admin["id"], "create", "apartment", apartment_id, f"تم إضافة الشقة {unit_code}", None, payload)
        row = conn.execute("SELECT * FROM apartments WHERE id = ?", (apartment_id,)).fetchone()
        return jsonify({"apartment": apartment_payload(row)}), 201


@app.get("/api/admin/clients")
def list_admin_clients() -> Response:
    admin = require_admin()
    if not isinstance(admin, dict):
        return admin
    page = request_page()
    limit = request_limit()
    offset = (page - 1) * limit
    with db() as conn:
        total = conn.execute("SELECT COUNT(*) FROM clients").fetchone()[0]
        settings = all_settings(conn)
        rows = conn.execute("SELECT * FROM clients ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset)).fetchall()
        items = [client_payload(conn, row, include_private=False) for row in rows]
        return jsonify(paginated_payload("clients", items, total, page, limit))


@app.post("/api/admin/clients")
def add_client() -> Response:
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    name = (payload.get("full_name") or payload.get("name") or "").strip()
    apartment_id = payload.get("apartment_id") or payload.get("apartmentId")
    if not name:
        return jsonify({"error": "validation", "message": "هذا الحقل مطلوب."}), 400
    if not apartment_id:
        return jsonify({"error": "validation", "message": "يجب اختيار شقة."}), 400
    with db() as conn:
        ok, message = validate_assignment(conn, apartment_id)
        if not ok:
            return jsonify({"error": "assignment", "message": message}), 409
        apartment = conn.execute("SELECT * FROM apartments WHERE id = ?", (apartment_id,)).fetchone()

        shared_client_id = payload.get("shared_client_id") or payload.get("sharedClientId")
        explicit_code = normalize_code(payload.get("client_code") or payload.get("code") or "")
        explicit_portfolio = normalize_code(payload.get("portfolio_code") or payload.get("portfolioCode") or "")

        portfolio_code = explicit_portfolio
        if shared_client_id and not portfolio_code:
            shared = conn.execute("SELECT client_code, portfolio_code FROM clients WHERE id = ?", (shared_client_id,)).fetchone()
            if shared:
                portfolio_code = normalize_code(shared["portfolio_code"] or shared["client_code"] or "")
        if not portfolio_code:
            portfolio_code = explicit_code or existing_portfolio_for_client_name(conn, name) or unique_portfolio_code(conn)

        client_code = explicit_code if (explicit_code and not shared_client_id and not explicit_portfolio) else ""
        if not client_code:
            client_code = normalize_code(f"{portfolio_code}-{apartment['unit_code']}-{secrets.token_hex(2).upper()}")
        while conn.execute("SELECT id FROM clients WHERE UPPER(client_code) = ?", (client_code,)).fetchone():
            client_code = normalize_code(f"{portfolio_code}-{apartment['unit_code']}-{secrets.token_hex(2).upper()}")

        client_id = public_id("client")
        reservation_status = status_db(payload.get("reservation_status") or "confirmed", "reservation")
        total_amount = float(payload.get("total_amount") or apartment["price"] or 0)
        conn.execute(
            """
            INSERT INTO clients (
              id, full_name, phone, email, national_id, client_code, portfolio_code, apartment_id, reservation_status,
              reservation_date, expected_delivery_date, total_amount, paid_amount, remaining_amount,
              payment_status, office_notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'pending', ?, ?, ?)
            """,
            (
                client_id,
                name,
                payload.get("phone"),
                payload.get("email"),
                payload.get("national_id"),
                client_code,
                portfolio_code,
                apartment_id,
                reservation_status,
                payload.get("reservation_date") or datetime.now().date().isoformat(),
                payload.get("expected_delivery_date"),
                total_amount,
                total_amount,
                payload.get("office_notes"),
                now_iso(),
                now_iso(),
            ),
        )
        recalc_client(conn, client_id)
        audit(conn, admin["id"], "create", "client", client_id, f"تم إضافة عميل جديد: {name}", None, payload)
        row = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
        return jsonify({"client": client_payload(conn, row)})


@app.patch("/api/admin/clients/<client_id>")
def update_client(client_id: str) -> Response:
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    with db() as conn:
        old = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not old:
            return jsonify({"error": "not_found", "message": "العميل غير موجود."}), 404
        apartment_id = payload.get("apartment_id") or payload.get("apartmentId") or old["apartment_id"]
        ok, message = validate_assignment(conn, apartment_id, client_id=client_id)
        if not ok:
            return jsonify({"error": "assignment", "message": message}), 409
        apartment = conn.execute("SELECT * FROM apartments WHERE id = ?", (apartment_id,)).fetchone()
        reservation_status = status_db(payload.get("reservation_status") or old["reservation_status"], "reservation")
        total_amount = float(payload.get("total_amount") or old["total_amount"] or apartment["price"] or 0)
        conn.execute(
            """
            UPDATE clients SET
              full_name = ?, phone = ?, email = ?, national_id = ?, apartment_id = ?, reservation_status = ?,
              reservation_date = ?, expected_delivery_date = ?, total_amount = ?, office_notes = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                (payload.get("full_name") or payload.get("name") or old["full_name"]).strip(),
                payload.get("phone", old["phone"]),
                payload.get("email", old["email"]),
                payload.get("national_id", old["national_id"]),
                apartment_id,
                reservation_status,
                payload.get("reservation_date", old["reservation_date"]),
                payload.get("expected_delivery_date", old["expected_delivery_date"]),
                total_amount,
                payload.get("office_notes", old["office_notes"]),
                now_iso(),
                client_id,
            ),
        )
        if old["apartment_id"] and old["apartment_id"] != apartment_id:
            conn.execute("UPDATE apartments SET status = 'available', assigned_client_id = NULL, updated_at = ? WHERE id = ?", (now_iso(), old["apartment_id"]))
        recalc_client(conn, client_id)
        row = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
        audit(conn, admin["id"], "update", "client", client_id, "تم تعديل بيانات العميل", dict(old), payload)
        return jsonify({"client": client_payload(conn, row)})


@app.delete("/api/admin/clients/<client_id>")
def delete_client(client_id: str) -> Response:
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    if request.args.get("confirm") != "true":
        return jsonify({"error": "confirmation_required", "message": "لا يمكن حذف العميل بدون تأكيد."}), 409
    with db() as conn:
        old = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not old:
            return jsonify({"error": "not_found", "message": "العميل غير موجود."}), 404
        if client_has_payments(conn, client_id):
            return jsonify({"error": "validation", "message": "لا يمكن حذف عميل مرتبط بمدفوعات. يمكن إلغاء الحجز فقط مع الاحتفاظ بالسجل."}), 409
        if client_has_deals(conn, client_id):
            return jsonify({"error": "validation", "message": "لا يمكن حذف عميل مرتبط بديل. يمكن إلغاء الحجز فقط مع الاحتفاظ بالسجل."}), 409
        apartment_id = old["apartment_id"]
        audit(conn, admin["id"], "delete", "client", client_id, f"تم حذف العميل: {old['full_name']}", dict(old), None)
        conn.execute("DELETE FROM clients WHERE id = ?", (client_id,))
        if apartment_id:
            conn.execute(
                """
                UPDATE apartments
                SET status = 'available', assigned_client_id = NULL, updated_at = ?
                WHERE id = ? AND assigned_client_id = ?
                """,
                (now_iso(), apartment_id, client_id),
            )
        return jsonify({"ok": True})


@app.post("/api/admin/clients/<client_id>/delete")
def delete_client_via_post(client_id: str) -> Response:
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    if payload.get("confirm") is not True:
        return jsonify({"error": "confirmation_required", "message": "لا يمكن حذف العميل بدون تأكيد."}), 409
    with db() as conn:
        old = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not old:
            return jsonify({"error": "not_found", "message": "العميل غير موجود."}), 404
        if client_has_payments(conn, client_id):
            return jsonify({"error": "validation", "message": "لا يمكن حذف عميل مرتبط بمدفوعات. يمكن إلغاء الحجز فقط مع الاحتفاظ بالسجل."}), 409
        if client_has_deals(conn, client_id):
            return jsonify({"error": "validation", "message": "لا يمكن حذف عميل مرتبط بديل. يمكن إلغاء الحجز فقط مع الاحتفاظ بالسجل."}), 409
        apartment_id = old["apartment_id"]
        audit(conn, admin["id"], "delete", "client", client_id, f"تم حذف العميل: {old['full_name']}", dict(old), None)
        conn.execute("DELETE FROM clients WHERE id = ?", (client_id,))
        if apartment_id:
            conn.execute(
                """
                UPDATE apartments
                SET status = 'available', assigned_client_id = NULL, updated_at = ?
                WHERE id = ? AND assigned_client_id = ?
                """,
                (now_iso(), apartment_id, client_id),
            )
        return jsonify({"ok": True})


@app.post("/api/admin/assign-apartment")
def assign_apartment() -> Response:
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    client_id = payload.get("client_id") or payload.get("clientId")
    apartment_id = payload.get("apartment_id") or payload.get("apartmentId")
    with db() as conn:
        ok, message = validate_assignment(conn, apartment_id, client_id=client_id)
        if not ok:
            return jsonify({"error": "assignment", "message": message}), 409
        old = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not old:
            return jsonify({"error": "not_found", "message": "العميل غير موجود."}), 404
        apartment = conn.execute("SELECT * FROM apartments WHERE id = ?", (apartment_id,)).fetchone()
        conn.execute(
            "UPDATE clients SET apartment_id = ?, total_amount = ?, updated_at = ? WHERE id = ?",
            (apartment_id, apartment["price"], now_iso(), client_id),
        )
        if old["apartment_id"] and old["apartment_id"] != apartment_id:
            conn.execute("UPDATE apartments SET status = 'available', assigned_client_id = NULL, updated_at = ? WHERE id = ?", (now_iso(), old["apartment_id"]))
        recalc_client(conn, client_id)
        audit(conn, admin["id"], "assign", "apartment", apartment_id, f"تم تخصيص الشقة {apartment['unit_code']} للعميل", dict(old), payload)
        return jsonify({"ok": True})


@app.get("/api/admin/clients/<client_id>/financial-summary")
def client_financial_summary(client_id: str) -> Response:
    admin = require_admin()
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        client = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not client:
            return jsonify({"error": "not_found", "message": "العميل غير موجود."}), 404
        
        # Get linked apartments
        try:
            apartments = conn.execute(
                "SELECT ca.*, a.unit_code, a.price AS apartment_price FROM client_apartments ca LEFT JOIN apartments a ON a.id = ca.apartment_id WHERE ca.client_id = ? AND ca.status != 'cancelled'",
                (client_id,),
            ).fetchall()
        except Exception:
            apartments = []
        
        # Calculate totals
        total_amount = sum(float(apt.get("unit_price") or apt.get("apartment_price") or 0) for apt in apartments) if apartments else float(client.get("total_amount") or 0)
        paid_amount = conn.execute("SELECT SUM(amount) FROM payments WHERE client_id = ? AND payment_status = 'confirmed'", (client_id,)).fetchone()[0] or 0
        remaining_amount = total_amount - paid_amount
        progress = (paid_amount / total_amount * 100) if total_amount > 0 else 0
        
        # Determine status
        if paid_amount == 0:
            payment_status = "pending"
        elif paid_amount >= total_amount:
            payment_status = "fully_paid"
        else:
            payment_status = "partially_paid"
        
        # Check for overdue
        overdue_installments = conn.execute(
            "SELECT COUNT(*) FROM installments WHERE client_id = ? AND status = 'pending' AND due_date < ?",
            (client_id, now_iso()[:10]),
        ).fetchone()[0]
        if overdue_installments > 0:
            payment_status = "overdue"
        
        return jsonify({
            "financial_summary": {
                "client_id": client_id,
                "total_amount": total_amount,
                "paid_amount": paid_amount,
                "remaining_amount": remaining_amount,
                "progress": progress,
                "payment_status": payment_status,
                "apartments_count": len(apartments),
                "apartments": [{"id": apt["apartment_id"], "unit_code": apt.get("unit_code"), "price": float(apt.get("unit_price") or apt.get("apartment_price") or 0)} for apt in apartments],
            }
        })


@app.patch("/api/admin/apartments/<apartment_id>")
def update_apartment(apartment_id: str) -> Response:
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    with db() as conn:
        old = conn.execute("SELECT * FROM apartments WHERE id = ?", (apartment_id,)).fetchone()
        if not old:
            return jsonify({"error": "not_found", "message": "الشقة غير موجودة."}), 404
        status = status_db(payload.get("status") or old["status"], "apartment")
        active = active_client_for_apartment(conn, apartment_id)
        if status == "available" and active:
            return jsonify({"error": "validation", "message": "لا يمكن جعل الشقة متاحة قبل إلغاء أو نقل الحجز النشط."}), 409
        conn.execute(
            "UPDATE apartments SET price = ?, status = ?, notes = ?, updated_at = ? WHERE id = ?",
            (float(payload.get("price", old["price"])), status, payload.get("notes", old["notes"]), now_iso(), apartment_id),
        )
        audit(conn, admin["id"], "update", "apartment", apartment_id, "تم تعديل بيانات الشقة", dict(old), payload)
        row = conn.execute("SELECT * FROM apartments WHERE id = ?", (apartment_id,)).fetchone()
        return jsonify({"apartment": apartment_payload(row)})


@app.post("/api/admin/payments")
def add_payment() -> Response:
    admin = require_admin({"owner", "admin", "accountant"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    amount = float(payload.get("amount") or 0)
    if amount <= 0:
        return jsonify({"error": "validation", "message": "قيمة الدفعة يجب أن تكون أكبر من صفر."}), 400
    payment_date = payload.get("payment_date") or payload.get("date")
    if not payment_date:
        return jsonify({"error": "validation", "message": "تاريخ الدفع مطلوب."}), 400
    if not (payload.get("payment_method") or payload.get("method")):
        return jsonify({"error": "validation", "message": "طريقة الدفع مطلوبة."}), 400
    client_id = payload.get("client_id") or payload.get("clientId")
    apartment_id = payload.get("apartment_id") or payload.get("apartmentId") or None
    with db() as conn:
        client = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not client:
            return jsonify({"error": "not_found", "message": "العميل غير موجود."}), 404
        # Validate apartment reference if provided
        if apartment_id:
            apt = conn.execute("SELECT * FROM apartments WHERE id = ?", (apartment_id,)).fetchone()
            if not apt:
                return jsonify({"error": "not_found", "message": "الشقة المرجعية غير موجودة."}), 404
            if apt.get("assigned_client_id") and apt.get("assigned_client_id") != client_id:
                return jsonify({"error": "assignment", "message": "هذه الشقة مرتبطة بعميل آخر."}), 409
        if amount > float(client["remaining_amount"] or client["total_amount"]) and not payload.get("allow_overpay"):
            return jsonify({"error": "overpay", "message": "المبلغ المدخل أكبر من المبلغ المتبقي."}), 409
        payment_status = status_db(payload.get("payment_status") or payload.get("status") or "confirmed", "payment_record")
        receipt = payload.get("receipt_number") or (receipt_number(conn) if payment_status == "confirmed" else None)
        if receipt and conn.execute("SELECT id FROM payments WHERE receipt_number = ?", (receipt,)).fetchone():
            return jsonify({"error": "duplicate_receipt", "message": "رقم الإيصال مستخدم بالفعل."}), 409
        payment_id = public_id("pay")
        conn.execute(
            """
            INSERT INTO payments (
              id, client_id, apartment_id, amount, payment_date, payment_method, payment_status,
              receipt_number, reference_number, notes, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payment_id,
                client_id,
                apartment_id,
                amount,
                payment_date,
                status_db(payload.get("payment_method") or payload.get("method") or "cash", "method"),
                payment_status,
                receipt,
                payload.get("reference_number") or payload.get("reference"),
                payload.get("notes"),
                admin["id"],
                now_iso(),
                now_iso(),
            ),
        )
        recalc_client(conn, client_id)
        if payment_status == "confirmed" and receipt:
            create_receipt_record(conn, payment_id, admin["id"])
        new_row = conn.execute("SELECT * FROM payments WHERE id = ?", (payment_id,)).fetchone()
        audit(conn, admin["id"], "create", "payment", payment_id, f"تم إضافة دفعة بقيمة {format_money(amount)}", None, dict(new_row))
        return jsonify({"payment": payment_payload(new_row)})


@app.get("/api/admin/payments")
def list_admin_payments() -> Response:
    admin = require_admin({"owner", "admin", "accountant", "viewer"})
    if not isinstance(admin, dict):
        return admin
    page = request_page()
    limit = request_limit()
    offset = (page - 1) * limit
    with db() as conn:
        total = conn.execute("SELECT COUNT(*) FROM payments").fetchone()[0]
        rows = conn.execute(
            """
            SELECT payments.*, clients.full_name AS client_name, apartments.unit_code
            FROM payments
            LEFT JOIN clients ON clients.id = payments.client_id
            LEFT JOIN apartments ON apartments.id = payments.apartment_id
            ORDER BY payments.payment_date DESC, payments.created_at DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()
        return jsonify(paginated_payload("payments", [payment_payload(row) for row in rows], total, page, limit))


@app.patch("/api/admin/payments/<payment_id>")
def update_payment(payment_id: str) -> Response:
    admin = require_admin({"owner", "admin", "accountant"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    with db() as conn:
        old = conn.execute("SELECT * FROM payments WHERE id = %s", (payment_id,)).fetchone()
        if not old:
            return jsonify({"error": "not_found", "message": "الدفعة غير موجودة."}), 404
        amount = float(payload.get("amount", old["amount"]))
        if amount <= 0:
            return jsonify({"error": "validation", "message": "قيمة الدفعة يجب أن تكون أكبر من صفر."}), 400
        client = conn.execute("SELECT * FROM clients WHERE id = %s", (old["client_id"],)).fetchone()
        old_confirmed = float(old["amount"] or 0) if old["payment_status"] == "confirmed" else 0
        remaining_for_edit = float(client["remaining_amount"] or 0) + old_confirmed if client else amount
        if amount > remaining_for_edit and not payload.get("allow_overpay"):
            return jsonify({"error": "overpay", "message": "المبلغ المدخل أكبر من المبلغ المتبقي."}), 409
        payment_status = status_db(payload.get("payment_status") or payload.get("status") or old["payment_status"], "payment_record")
        receipt = payload.get("receipt_number") or old["receipt_number"] or (receipt_number(conn) if payment_status == "confirmed" else None)
        if receipt:
            duplicate = conn.execute("SELECT id FROM payments WHERE receipt_number = %s AND id != %s", (receipt, payment_id)).fetchone()
            if duplicate:
                return jsonify({"error": "duplicate_receipt", "message": "رقم الإيصال مستخدم بالفعل."}), 409
        apartment_id = payload.get("apartment_id") or payload.get("apartmentId") or old.get("apartment_id")
        conn.execute(
            """
            UPDATE payments SET amount = %s, payment_date = %s, payment_method = %s, payment_status = %s,
              receipt_number = %s, reference_number = %s, notes = %s, apartment_id = %s, updated_at = %s
            WHERE id = %s
            """,
            (
                amount,
                payload.get("payment_date") or payload.get("date") or old["payment_date"],
                status_db(payload.get("payment_method") or payload.get("method") or old["payment_method"], "method"),
                payment_status,
                receipt,
                payload.get("reference_number") or payload.get("reference") or old["reference_number"],
                payload.get("notes", old["notes"]),
                apartment_id,
                now_iso(),
                payment_id,
            ),
        )
        recalc_client(conn, old["client_id"])
        # Manage receipts
        new_row = conn.execute("SELECT * FROM payments WHERE id = %s", (payment_id,)).fetchone()
        if new_row["payment_status"] == "confirmed" and new_row.get("receipt_number"):
            create_receipt_record(conn, payment_id, admin["id"])
        else:
            conn.execute("DELETE FROM receipts WHERE payment_id = %s", (payment_id,))
        audit(conn, admin["id"], "update", "payment", payment_id, "تم تعديل دفعة", dict(old), dict(new_row))
        return jsonify({"payment": payment_payload(new_row)})


@app.delete("/api/admin/payments/<payment_id>")
def delete_payment(payment_id: str) -> Response:
    admin = require_admin({"owner", "admin", "accountant"})
    if not isinstance(admin, dict):
        return admin
    if request.args.get("confirm") != "true":
        return jsonify({"error": "confirmation_required", "message": "لا يمكن حذف هذه الدفعة بدون تأكيد."}), 409
    reason = request.args.get("reason") or None
    with db() as conn:
        old = conn.execute("SELECT * FROM payments WHERE id = ?", (payment_id,)).fetchone()
        if not old:
            return jsonify({"error": "not_found", "message": "الدفعة غير موجودة."}), 404
        # Protect confirmed payments: prefer cancelling over hard delete
        if old["payment_status"] == "confirmed":
            if admin["role"] != "owner":
                return jsonify({"error": "forbidden", "message": "ليس لديك صلاحية حذف دفعة مؤكدة."}), 403
            if not reason:
                return jsonify({"error": "reason_required", "message": "سبب الحذف مطلوب."}), 400
            conn.execute("UPDATE payments SET payment_status = ?, notes = ?, updated_at = ? WHERE id = ?", ("cancelled", (old.get("notes") or "") + "\nCancelled: " + reason, now_iso(), payment_id))
            conn.execute("DELETE FROM receipts WHERE payment_id = ?", (payment_id,))
            recalc_client(conn, old["client_id"])
            new_row = conn.execute("SELECT * FROM payments WHERE id = ?", (payment_id,)).fetchone()
            audit(conn, admin["id"], "cancel", "payment", payment_id, f"تم إلغاء دفعة: {reason}", dict(old), dict(new_row))
            return jsonify({"ok": True})
        # Non-confirmed payments can be deleted
        conn.execute("DELETE FROM payments WHERE id = ?", (payment_id,))
        conn.execute("DELETE FROM receipts WHERE payment_id = ?", (payment_id,))
        recalc_client(conn, old["client_id"])
        audit(conn, admin["id"], "delete", "payment", payment_id, "تم حذف دفعة", dict(old), None)
        return jsonify({"ok": True})


@app.post("/api/admin/payments/<payment_id>/cancel")
def cancel_payment(payment_id: str) -> Response:
    admin = require_admin({"owner", "admin", "accountant"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    reason = (payload.get("reason") or "").strip()
    if not reason:
        return jsonify({"error": "validation", "message": "سبب الإلغاء مطلوب."}), 400
    with db() as conn:
        old = conn.execute("SELECT * FROM payments WHERE id = ?", (payment_id,)).fetchone()
        if not old:
            return jsonify({"error": "not_found", "message": "الدفعة غير موجودة."}), 404
        if old["payment_status"] == "cancelled":
            return jsonify({"payment": payment_payload(old)})
        if admin["role"] != "owner" and old["payment_status"] == "confirmed":
            return jsonify({"error": "forbidden", "message": "ليس لديك صلاحية لإلغاء دفعة مؤكدة."}), 403
        # Mark as cancelled instead of hard delete
        conn.execute(
            "UPDATE payments SET payment_status = ?, notes = ?, updated_at = ? WHERE id = ?",
            ("cancelled", (old.get("notes") or "") + f"\nCancelled: {reason}", now_iso(), payment_id),
        )
        conn.execute("DELETE FROM receipts WHERE payment_id = ?", (payment_id,))
        recalc_client(conn, old["client_id"])
        new_row = conn.execute("SELECT * FROM payments WHERE id = ?", (payment_id,)).fetchone()
        audit(conn, admin["id"], "cancel", "payment", payment_id, f"تم إلغاء دفعة: {reason}", dict(old), dict(new_row))
        return jsonify({"payment": payment_payload(new_row)})


@app.post("/api/admin/clients/<client_id>/apartments")
def add_apartment_to_client(client_id: str) -> Response:
    admin = require_admin({"owner", "admin", "accountant"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    apartment_id = payload.get("apartment_id") or payload.get("apartmentId")
    if not apartment_id:
        return jsonify({"error": "validation", "message": "معرف الشقة مطلوب."}), 400
    with db() as conn:
        client = conn.execute("SELECT * FROM clients WHERE id = %s", (client_id,)).fetchone()
        if not client:
            return jsonify({"error": "not_found", "message": "العميل غير موجود."}), 404
        apartment = conn.execute("SELECT * FROM apartments WHERE id = %s", (apartment_id,)).fetchone()
        if not apartment:
            return jsonify({"error": "not_found", "message": "الشقة غيرموجودة."}), 404
        # Check if apartment is already linked to another active client
        existing_link = conn.execute(
            "SELECT client_id FROM client_apartments WHERE apartment_id = %s AND status != 'cancelled'",
            (apartment_id,),
        ).fetchone()
        if existing_link and existing_link["client_id"] != client_id:
            return jsonify({"error": "validation", "message": "هذه الشقة مرتبطة بعميل آخر."}), 409
        # Add the link
        ensure_client_apartments_schema(conn)
        link_id = public_id("cap")
        unit_price = float(payload.get("unit_price") or payload.get("unitPrice") or apartment["price"] or 0)
        conn.execute(
            """
            INSERT INTO client_apartments (id, client_id, apartment_id, unit_price, status, assigned_at, created_by, created_at, updated_at)
            VALUES (%s, %s, %s, %s, 'active', %s, %s, %s, %s)
            """,
            (link_id, client_id, apartment_id, unit_price, now_iso(), admin["id"], now_iso(), now_iso()),
        )
        recalc_client(conn, client_id)
        audit(conn, admin["id"], "link_apartment", "client", client_id, f"تمت إضافة شقة {apartment['unit_code']} للعميل", None, {"apartment_id": apartment_id, "unit_price": unit_price})
        row = conn.execute("SELECT * FROM clients WHERE id = %s", (client_id,)).fetchone()
        return jsonify({"client": client_payload(conn, row)})


@app.delete("/api/admin/clients/<client_id>/apartments/<apartment_id>")
def remove_apartment_from_client(client_id: str, apartment_id: str) -> Response:
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    reason = (payload.get("reason") or "").strip()
    with db() as conn:
        client = conn.execute("SELECT * FROM clients WHERE id = %s", (client_id,)).fetchone()
        if not client:
            return jsonify({"error": "not_found", "message": "العميل غير موجود."}), 404
        # Mark the link as cancelled instead of deleting
        conn.execute(
            "UPDATE client_apartments SET status = 'cancelled', updated_at = %s WHERE client_id = %s AND apartment_id = %s",
            (now_iso(), client_id, apartment_id),
        )
        # Check if any other client has this apartment linked
        other_client = conn.execute(
            "SELECT client_id FROM client_apartments WHERE apartment_id = %s AND client_id != %s AND status != 'cancelled'",
            (apartment_id, client_id),
        ).fetchone()
        if not other_client:
            # Release apartment if no other confirmed payments
            has_confirmed_payments = conn.execute(
                "SELECT id FROM payments WHERE apartment_id = %s AND payment_status = 'confirmed'",
                (apartment_id,),
            ).fetchone()
            if not has_confirmed_payments:
                conn.execute(
                    "UPDATE apartments SET status = 'available', assigned_client_id = NULL, updated_at = %s WHERE id = %s",
                    (now_iso(), apartment_id),
                )
        recalc_client(conn, client_id)
        audit(conn, admin["id"], "unlink_apartment", "client", client_id, f"تمت إزالة شقة من العميل (السبب: {reason})" if reason else "تمت إزالة شقة من العميل", {"apartment_id": apartment_id}, None)
        row = conn.execute("SELECT * FROM clients WHERE id = %s", (client_id,)).fetchone()
        return jsonify({"client": client_payload(conn, row)})


@app.patch("/api/admin/clients/<client_id>/apartments/<apartment_id>/price")
def update_apartment_price(client_id: str, apartment_id: str) -> Response:
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    unit_price = payload.get("unit_price") or payload.get("unitPrice")
    reason = (payload.get("reason") or "").strip()
    if unit_price is None:
        return jsonify({"error": "validation", "message": "السعر الجديد مطلوب."}), 400
    try:
        unit_price = float(unit_price)
    except (ValueError, TypeError):
        return jsonify({"error": "validation", "message": "السعر يجب أن يكون رقمًا."}), 400
    if unit_price < 0:
        return jsonify({"error": "validation", "message": "السعر يجب أن يكون أكبر من أو يساوي صفر."}), 400
    if not reason:
        return jsonify({"error": "validation", "message": "سبب التعديل مطلوب."}), 400
    with db() as conn:
        client = conn.execute("SELECT * FROM clients WHERE id = %s", (client_id,)).fetchone()
        if not client:
            return jsonify({"error": "not_found", "message": "العميل غير موجود."}), 404
        apartment = conn.execute("SELECT * FROM apartments WHERE id = %s", (apartment_id,)).fetchone()
        if not apartment:
            return jsonify({"error": "not_found", "message": "الشقة غير موجودة."}), 404
        # Get current link
        link = conn.execute(
            "SELECT * FROM client_apartments WHERE client_id = %s AND apartment_id = %s AND status != 'cancelled'",
            (client_id, apartment_id)
        ).fetchone()
        if not link:
            return jsonify({"error": "not_found", "message": "الشقة غير مرتبطة بهذا العميل."}), 404
        old_price = float(link.get("unit_price") or 0)
        # Update the price
        conn.execute(
            "UPDATE client_apartments SET unit_price = %s, updated_at = %s WHERE client_id = %s AND apartment_id = %s",
            (unit_price, now_iso(), client_id, apartment_id)
        )
        # Recalculate client totals
        recalc_client(conn, client_id)
        # Audit log
        audit(conn, admin["id"], "update_apartment_price", "client_apartment", link["id"],
              f"تم تعديل سعر شقة {apartment['unit_code']} للعميل {client['full_name']}: {reason}",
              {"old_price": old_price, "unit_price": old_price},
              {"new_price": unit_price, "unit_price": unit_price})
        row = conn.execute("SELECT * FROM clients WHERE id = %s", (client_id,)).fetchone()
        return jsonify({"client": client_payload(conn, row)})


def create_receipt_record(conn: Any, payment_id: str, admin_id: str | None) -> None:
    payment = conn.execute("SELECT * FROM payments WHERE id = ?", (payment_id,)).fetchone()
    if not payment or not payment["receipt_number"]:
        return
    existing = conn.execute("SELECT id FROM receipts WHERE payment_id = ?", (payment_id,)).fetchone()
    if existing:
        return
    conn.execute(
        """
        INSERT INTO receipts (id, payment_id, client_id, apartment_id, receipt_number, receipt_pdf_url, issued_at, issued_by, created_at)
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)
        """,
        (public_id("receipt"), payment_id, payment["client_id"], payment["apartment_id"], payment["receipt_number"], now_iso(), admin_id, now_iso()),
    )


@app.post("/api/admin/installments")
def add_installment() -> Response:
    admin = require_admin({"owner", "admin", "accountant"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    client_id = payload.get("client_id") or payload.get("clientId")
    with db() as conn:
        client = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not client:
            return jsonify({"error": "not_found", "message": "العميل غير موجود."}), 404
        due_date = payload.get("due_date") or payload.get("dueDate")
        if not due_date:
            return jsonify({"error": "validation", "message": "تاريخ الاستحقاق مطلوب."}), 400
        amount = float(payload.get("amount") or 0)
        if amount <= 0:
            return jsonify({"error": "validation", "message": "قيمة القسط غير صحيحة."}), 400
        paid = float(payload.get("paid_amount") or 0)
        remaining = max(0, amount - paid)
        installment_id = public_id("inst")
        conn.execute(
            """
            INSERT INTO installments (
              id, client_id, apartment_id, installment_number, due_date, amount, paid_amount,
              remaining_amount, status, payment_id, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'upcoming', ?, ?, ?, ?)
            """,
            (
                installment_id,
                client_id,
                client["apartment_id"],
                int(payload.get("installment_number") or payload.get("installmentNumber") or 1),
                due_date,
                amount,
                paid,
                remaining,
                payload.get("payment_id") or payload.get("paymentId"),
                payload.get("notes"),
                now_iso(),
                now_iso(),
            ),
        )
        recalc_client(conn, client_id)
        audit(conn, admin["id"], "create", "installment", installment_id, "تم إضافة قسط", None, payload)
        row = conn.execute("SELECT * FROM installments WHERE id = ?", (installment_id,)).fetchone()
        return jsonify({"installment": installment_payload(row)})


@app.get("/api/admin/installments")
def list_admin_installments() -> Response:
    admin = require_admin({"owner", "admin", "accountant", "viewer"})
    if not isinstance(admin, dict):
        return admin
    page = request_page()
    limit = request_limit()
    offset = (page - 1) * limit
    with db() as conn:
        total = conn.execute("SELECT COUNT(*) FROM installments").fetchone()[0]
        rows = conn.execute(
            """
            SELECT installments.*, clients.full_name AS client_name, apartments.unit_code
            FROM installments
            LEFT JOIN clients ON clients.id = installments.client_id
            LEFT JOIN apartments ON apartments.id = installments.apartment_id
            ORDER BY installments.due_date ASC, installments.installment_number ASC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()
        return jsonify(paginated_payload("installments", [installment_payload(row) for row in rows], total, page, limit))


@app.patch("/api/admin/installments/<installment_id>")
def update_installment(installment_id: str) -> Response:
    admin = require_admin({"owner", "admin", "accountant"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    with db() as conn:
        old = conn.execute("SELECT * FROM installments WHERE id = ?", (installment_id,)).fetchone()
        if not old:
            return jsonify({"error": "not_found", "message": "القسط غير موجود."}), 404
        amount = float(payload.get("amount", old["amount"]))
        paid = float(payload.get("paid_amount", old["paid_amount"]))
        remaining = max(0, amount - paid)
        status = payload.get("status") or old["status"]
        conn.execute(
            """
            UPDATE installments SET installment_number = ?, due_date = ?, amount = ?, paid_amount = ?,
              remaining_amount = ?, status = ?, payment_id = ?, notes = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                int(payload.get("installment_number", old["installment_number"])),
                payload.get("due_date", old["due_date"]),
                amount,
                paid,
                remaining,
                status_db(status, "installment"),
                payload.get("payment_id", old["payment_id"]),
                payload.get("notes", old["notes"]),
                now_iso(),
                installment_id,
            ),
        )
        recalc_client(conn, old["client_id"])
        audit(conn, admin["id"], "update", "installment", installment_id, "تم تعديل قسط", dict(old), payload)
        row = conn.execute("SELECT * FROM installments WHERE id = ?", (installment_id,)).fetchone()
        return jsonify({"installment": installment_payload(row)})


@app.delete("/api/admin/installments/<installment_id>")
def delete_installment(installment_id: str) -> Response:
    admin = require_admin({"owner", "admin", "accountant"})
    if not isinstance(admin, dict):
        return admin
    if request.args.get("confirm") != "true":
        return jsonify({"error": "confirmation_required", "message": "لا يمكن حذف هذا القسط بدون تأكيد."}), 409
    with db() as conn:
        old = conn.execute("SELECT * FROM installments WHERE id = ?", (installment_id,)).fetchone()
        if not old:
            return jsonify({"error": "not_found", "message": "القسط غير موجود."}), 404
        conn.execute("DELETE FROM installments WHERE id = ?", (installment_id,))
        recalc_client(conn, old["client_id"])
        audit(conn, admin["id"], "delete", "installment", installment_id, "تم حذف قسط", dict(old), None)
        return jsonify({"ok": True})


@app.get("/api/admin/audit-logs")
def audit_logs() -> Response:
    admin = require_admin({"owner", "admin", "viewer", "accountant"})
    if not isinstance(admin, dict):
        return admin
    page = request_page()
    limit = request_limit()
    offset = (page - 1) * limit
    with db() as conn:
        total = conn.execute("SELECT COUNT(*) FROM audit_logs").fetchone()[0]
        rows = conn.execute(
            """
            SELECT audit_logs.*, admins.full_name AS admin_name
            FROM audit_logs LEFT JOIN admins ON admins.id = audit_logs.admin_id
            ORDER BY audit_logs.created_at DESC LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()
        return jsonify(paginated_payload("auditLogs", rows_to_dicts(rows), total, page, limit))


@app.get("/api/admin/audit")
def audit_logs_alias() -> Response:
    return audit_logs()


@app.get("/api/admin/settings")
def get_settings() -> Response:
    admin = require_admin()
    if not isinstance(admin, dict):
        return admin
    return jsonify({"settings": all_settings()})


@app.patch("/api/admin/settings")
def update_settings() -> Response:
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    allowed = {"office_name", "office_phone", "whatsapp_number", "office_address", "currency", "receipt_prefix", "statement_footer"}
    with db() as conn:
        old = all_settings(conn)
        for key, value in payload.items():
            if key in allowed:
                conn.execute(
                    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                    (key, str(value), now_iso()),
                )
        audit(conn, admin["id"], "update", "settings", "settings", "تم تعديل إعدادات النظام", old, payload)
        return jsonify({"settings": all_settings(conn)})


@app.get("/api/admin/profile")
def get_admin_profile() -> Response:
    admin = require_admin()
    if not isinstance(admin, dict):
        return admin
    return jsonify({"profile": admin_public_payload(admin)})


@app.patch("/api/admin/profile")
def update_admin_profile() -> Response:
    admin = require_admin()
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    full_name = (payload.get("full_name") or payload.get("fullName") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    phone = (payload.get("phone") or "").strip()

    if not full_name or not email:
        return jsonify({"error": "validation", "message": "يرجى إدخال الاسم والبريد الإلكتروني."}), 400

    with db() as conn:
        current_row = conn.execute("SELECT * FROM admins WHERE id = ?", (admin["id"],)).fetchone()
        if not current_row:
            return jsonify({"error": "not_found", "message": "المستخدم غير موجود."}), 404
        duplicate = conn.execute("SELECT id FROM admins WHERE lower(email) = ? AND id != ?", (email, admin["id"])).fetchone()
        if duplicate:
            return jsonify({"error": "duplicate", "message": "البريد الإلكتروني مستخدم بالفعل."}), 409

        conn.execute(
            """
            UPDATE admins
            SET full_name = ?, email = ?, phone = ?, updated_at = ?
            WHERE id = ?
            """,
            (full_name, email, phone, now_iso(), admin["id"]),
        )
        if email != current_row["email"]:
            audit(conn, admin["id"], "change_email", "admin_account", admin["id"], "تم تغيير البريد الإلكتروني للمستخدم", {"email": current_row["email"]}, {"email": email})
        audit(conn, admin["id"], "update", "admin_profile", admin["id"], "تم تحديث بيانات الملف الشخصي", dict(current_row), {"full_name": full_name, "email": email, "phone": phone})
        updated = conn.execute("SELECT * FROM admins WHERE id = ?", (admin["id"],)).fetchone()
        return jsonify({"profile": admin_public_payload(updated), "admin": admin_public_payload(updated)})


@app.post("/api/admin/change-password")
def change_admin_password() -> Response:
    admin = require_admin()
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    current_password = payload.get("current_password") or payload.get("currentPassword") or ""
    new_password = payload.get("new_password") or payload.get("newPassword") or ""
    confirm_password = payload.get("confirm_password") or payload.get("confirmPassword") or ""
    if not current_password or not new_password or not confirm_password:
        return jsonify({"error": "validation", "message": "يرجى إدخال كلمة المرور الحالية والجديدة وتأكيدها."}), 400
    if new_password != confirm_password:
        return jsonify({"error": "validation", "message": "تأكيد كلمة المرور غير مطابق."}), 400
    if len(new_password) < 8:
        return jsonify({"error": "validation", "message": "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل."}), 400
    with db() as conn:
        current_row = conn.execute("SELECT * FROM admins WHERE id = ?", (admin["id"],)).fetchone()
        if not current_row:
            return jsonify({"error": "not_found", "message": "المستخدم غير موجود."}), 404
        if not verify_password(current_password, current_row["password_hash"], current_row["password_salt"]):
            return jsonify({"error": "validation", "message": "كلمة المرور الحالية غير صحيحة."}), 401
        password_hash, salt = hash_password(new_password)
        conn.execute(
            "UPDATE admins SET password_hash = ?, password_salt = ?, must_change_password = FALSE, updated_at = ? WHERE id = ?",
            (password_hash, salt, now_iso(), admin["id"]),
        )
        audit(conn, admin["id"], "change_password", "admin_account", admin["id"], "تم تغيير كلمة مرور المستخدم", None, {"password_changed": True})
        updated = conn.execute("SELECT * FROM admins WHERE id = ?", (admin["id"],)).fetchone()
        return jsonify({"admin": admin_public_payload(updated)})


@app.patch("/api/admin/account")
def update_admin_account() -> Response:
    admin = require_admin()
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    current_password = payload.get("current_password") or payload.get("currentPassword") or ""
    new_email = (payload.get("new_email") or payload.get("newEmail") or payload.get("email") or "").strip().lower()
    new_password = payload.get("new_password") or payload.get("newPassword") or ""
    if not current_password:
        return jsonify({"error": "validation", "message": "يرجى إدخال كلمة المرور الحالية."}), 400
    if new_password and len(new_password) < 8:
        return jsonify({"error": "validation", "message": "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل."}), 400
    with db() as conn:
        current_row = conn.execute("SELECT * FROM admins WHERE id = ?", (admin["id"],)).fetchone()
        if not current_row:
            return jsonify({"error": "not_found", "message": "المستخدم غير موجود."}), 404
        if not verify_password(current_password, current_row["password_hash"], current_row["password_salt"]):
            return jsonify({"error": "validation", "message": "كلمة المرور الحالية غير صحيحة."}), 401
        target_email = new_email or current_row["email"]
        duplicate = conn.execute("SELECT id FROM admins WHERE lower(email) = ? AND id != ?", (target_email, admin["id"])).fetchone()
        if duplicate:
            return jsonify({"error": "duplicate", "message": "البريد الإلكتروني مستخدم بالفعل."}), 409
        password_hash, salt = hash_password(new_password) if new_password else (current_row["password_hash"], current_row["password_salt"])
        conn.execute(
            "UPDATE admins SET email = ?, password_hash = ?, password_salt = ?, must_change_password = FALSE, updated_at = ? WHERE id = ?",
            (target_email, password_hash, salt, now_iso(), admin["id"]),
        )
        audit(conn, admin["id"], "update", "admin_account", admin["id"], "تم تحديث بيانات دخول الإدارة", {"email": current_row["email"]}, {"email": target_email, "password_changed": bool(new_password)})
        updated = conn.execute("SELECT * FROM admins WHERE id = ?", (admin["id"],)).fetchone()
        return jsonify({"admin": admin_public_payload(updated)})


@app.get("/api/admin/users")
def admin_users() -> Response:
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        if admin["role"] == "owner":
            rows = conn.execute("SELECT id, full_name, email, role, phone, is_active, must_change_password, last_login_at, created_at FROM admins ORDER BY created_at DESC").fetchall()
        else:
            rows = conn.execute("SELECT id, full_name, email, role, phone, is_active, must_change_password, last_login_at, created_at FROM admins WHERE role != 'owner' ORDER BY created_at DESC").fetchall()
        return jsonify({"users": [admin_public_payload(row) for row in rows]})


@app.post("/api/admin/users")
def create_admin_user() -> Response:
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    name = (payload.get("full_name") or payload.get("fullName") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    phone = (payload.get("phone") or "").strip()
    role = (payload.get("role") or "assistant").strip().lower()
    password = payload.get("password") or "Assistant@12345"
    if not name or not email:
        return jsonify({"error": "validation", "message": "يرجى مراجعة البيانات المطلوبة."}), 400
    if role not in {"owner", "admin", "accountant", "viewer", "assistant"}:
        return jsonify({"error": "validation", "message": "صلاحية المستخدم غير صحيحة."}), 400
    if admin["role"] != "owner" and role in {"owner", "admin"}:
        return jsonify({"error": "forbidden", "message": "ليس لديك صلاحية لتنفيذ هذه العملية."}), 403
    password_hash, salt = hash_password(password)
    user_id = public_id("admin")
    with db() as conn:
        if conn.execute("SELECT id FROM admins WHERE lower(email) = ?", (email,)).fetchone():
            return jsonify({"error": "duplicate", "message": "البريد الإلكتروني مستخدم بالفعل."}), 409
        conn.execute(
            """
            INSERT INTO admins (id, full_name, email, phone, role, password_hash, password_salt, must_change_password, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)
            """,
            (user_id, name, email, phone, role, password_hash, salt, now_iso(), now_iso()),
        )
        audit(conn, admin["id"], "create", "admin_user", user_id, f"تم إضافة مستخدم جديد: {name}", None, {"email": email, "role": role, "phone": phone})
        row = conn.execute("SELECT * FROM admins WHERE id = ?", (user_id,)).fetchone()
        return jsonify({"user": admin_public_payload(row)})


@app.patch("/api/admin/users/<user_id>")
def update_admin_user(user_id: str) -> Response:
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    full_name = (payload.get("full_name") or payload.get("fullName") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    phone = (payload.get("phone") or "").strip()
    role = (payload.get("role") or "").strip().lower()
    if not full_name or not email:
        return jsonify({"error": "validation", "message": "يرجى إدخال الاسم والبريد الإلكتروني."}), 400
    if role and role not in {"owner", "admin", "accountant", "viewer", "assistant"}:
        return jsonify({"error": "validation", "message": "صلاحية المستخدم غير صحيحة."}), 400
    with db() as conn:
        old = conn.execute("SELECT * FROM admins WHERE id = ?", (user_id,)).fetchone()
        if not old:
            return jsonify({"error": "not_found", "message": "المستخدم غير موجود."}), 404
        blocked = ensure_user_manageable(admin, old, action="update")
        if blocked:
            return blocked
        if admin["role"] != "owner" and role in {"owner", "admin"}:
            return jsonify({"error": "forbidden", "message": "ليس لديك صلاحية لتنفيذ هذه العملية."}), 403
        if old["role"] == "owner" and role and role != "owner" and owner_count(conn) <= 1:
            return jsonify({"error": "protected_account", "message": "لا يمكن تعديل آخر مالك في النظام."}), 403
        duplicate = conn.execute("SELECT id FROM admins WHERE lower(email) = ? AND id != ?", (email, user_id)).fetchone()
        if duplicate:
            return jsonify({"error": "duplicate", "message": "البريد الإلكتروني مستخدم بالفعل."}), 409
        target_role = role or old["role"]
        conn.execute(
            "UPDATE admins SET full_name = ?, email = ?, phone = ?, role = ?, updated_at = ? WHERE id = ?",
            (full_name, email, phone, target_role, now_iso(), user_id),
        )
        audit(conn, admin["id"], "update", "admin_user", user_id, "تم تعديل بيانات حساب", dict(old), {"full_name": full_name, "email": email, "phone": phone, "role": target_role})
        row = conn.execute("SELECT * FROM admins WHERE id = ?", (user_id,)).fetchone()
        return jsonify({"user": admin_public_payload(row)})


@app.post("/api/admin/users/<user_id>/disable")
def disable_admin_user(user_id: str) -> Response:
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        old = conn.execute("SELECT * FROM admins WHERE id = ?", (user_id,)).fetchone()
        if not old:
            return jsonify({"error": "not_found", "message": "المستخدم غير موجود."}), 404
        blocked = ensure_user_manageable(admin, old, action="disable")
        if blocked:
            return blocked
        if old["role"] == "owner" and owner_count(conn) <= 1:
            return protected_account_response()
        conn.execute("UPDATE admins SET is_active = FALSE, updated_at = ? WHERE id = ?", (now_iso(), user_id))
        conn.execute("DELETE FROM admin_sessions WHERE admin_id = ?", (user_id,))
        audit(conn, admin["id"], "disable_account", "admin_user", user_id, "تم إيقاف حساب مستخدم", {"is_active": bool(old["is_active"])}, {"is_active": False})
        row = conn.execute("SELECT * FROM admins WHERE id = ?", (user_id,)).fetchone()
        return jsonify({"user": admin_public_payload(row)})


@app.post("/api/admin/users/<user_id>/enable")
def enable_admin_user(user_id: str) -> Response:
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        old = conn.execute("SELECT * FROM admins WHERE id = ?", (user_id,)).fetchone()
        if not old:
            return jsonify({"error": "not_found", "message": "المستخدم غير موجود."}), 404
        if old["role"] == "owner" and admin["role"] != "owner":
            return jsonify({"error": "forbidden", "message": "ليس لديك صلاحية لتنفيذ هذه العملية."}), 403
        conn.execute("UPDATE admins SET is_active = TRUE, updated_at = ? WHERE id = ?", (now_iso(), user_id))
        audit(conn, admin["id"], "enable_account", "admin_user", user_id, "تم تفعيل حساب مستخدم", {"is_active": bool(old["is_active"])}, {"is_active": True})
        row = conn.execute("SELECT * FROM admins WHERE id = ?", (user_id,)).fetchone()
        return jsonify({"user": admin_public_payload(row)})


@app.post("/api/admin/users/<user_id>/reset-password")
def reset_admin_user_password(user_id: str) -> Response:
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    temporary_password = payload.get("temporary_password") or payload.get("temporaryPassword") or payload.get("password") or ""
    if len(temporary_password) < 8:
        return jsonify({"error": "validation", "message": "كلمة المرور المؤقتة يجب أن تكون 8 أحرف على الأقل."}), 400
    with db() as conn:
        old = conn.execute("SELECT * FROM admins WHERE id = ?", (user_id,)).fetchone()
        if not old:
            return jsonify({"error": "not_found", "message": "المستخدم غير موجود."}), 404
        blocked = ensure_user_manageable(admin, old, action="reset_password")
        if blocked:
            return blocked
        password_hash, salt = hash_password(temporary_password)
        conn.execute(
            "UPDATE admins SET password_hash = ?, password_salt = ?, must_change_password = TRUE, updated_at = ? WHERE id = ?",
            (password_hash, salt, now_iso(), user_id),
        )
        conn.execute("DELETE FROM admin_sessions WHERE admin_id = ?", (user_id,))
        audit(conn, admin["id"], "reset_password", "admin_user", user_id, "تمت إعادة تعيين كلمة مرور حساب", None, {"must_change_password": True})
        row = conn.execute("SELECT * FROM admins WHERE id = ?", (user_id,)).fetchone()
        return jsonify({"user": admin_public_payload(row)})


@app.get("/api/admin/deals")
def get_deals() -> Response:
    admin = require_admin()
    if not isinstance(admin, dict):
        return admin
    page = request_page()
    limit = request_limit()
    offset = (page - 1) * limit
    with db() as conn:
        if admin["role"] == "assistant":
            total = conn.execute("SELECT COUNT(*) FROM deals WHERE assistant_id = ?", (admin["id"],)).fetchone()[0]
            rows = conn.execute(
                "SELECT * FROM deals WHERE assistant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (admin["id"], limit, offset),
            ).fetchall()
        else:
            total = conn.execute("SELECT COUNT(*) FROM deals").fetchone()[0]
            rows = conn.execute(
                "SELECT * FROM deals ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
        return jsonify(paginated_payload("deals", [deal_payload(conn, row) for row in rows], total, page, limit))


@app.post("/api/admin/deals")
def create_deal() -> Response:
    admin = require_admin({"owner", "admin", "assistant"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    client_name = (payload.get("client_name") or payload.get("clientName") or "").strip()
    apartment_id = payload.get("apartment_id") or payload.get("apartmentId")
    if not client_name or not apartment_id:
        return jsonify({"error": "validation", "message": "يرجى مراجعة البيانات المطلوبة."}), 400
    with db() as conn:
        apartment = conn.execute("SELECT * FROM apartments WHERE id = ?", (apartment_id,)).fetchone()
        if not apartment:
            return jsonify({"error": "not_found", "message": "الشقة غير موجودة."}), 404
        if apartment["status"] == "sold":
            return jsonify({"error": "validation", "message": "لا يمكن إنشاء طلب على شقة مباعة."}), 409
        deal_id = public_id("deal")
        conn.execute(
            """
            INSERT INTO deals (
              id, assistant_id, client_name, client_phone, apartment_id, proposed_total,
              down_payment, payment_plan, notes, status, owner_notes, approved_by, approved_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', NULL, NULL, NULL, ?, ?)
            """,
            (
                deal_id,
                admin["id"],
                client_name,
                payload.get("client_phone") or payload.get("clientPhone"),
                apartment_id,
                float(payload.get("proposed_total") or payload.get("proposedTotal") or apartment["price"] or 0),
                float(payload.get("down_payment") or payload.get("downPayment") or 0),
                payload.get("payment_plan") or payload.get("paymentPlan"),
                payload.get("notes"),
                now_iso(),
                now_iso(),
            ),
        )
        audit(conn, admin["id"], "create", "deal", deal_id, f"تم إنشاء ديل جديد للعميل {client_name}", None, payload)
        row = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
        return jsonify({"deal": deal_payload(conn, row)})


@app.patch("/api/admin/deals/<deal_id>")
def update_deal(deal_id: str) -> Response:
    admin = require_admin({"owner", "admin", "assistant"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    with db() as conn:
        old = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
        if not old:
            return jsonify({"error": "not_found", "message": "الطلب غير موجود."}), 404
        if admin["role"] == "assistant" and old["assistant_id"] != admin["id"]:
            return jsonify({"error": "forbidden", "message": "ليس لديك صلاحية لتنفيذ هذه العملية."}), 403
        if admin["role"] == "assistant" and old["status"] not in {"draft", "revision_requested"}:
            return jsonify({"error": "validation", "message": "لا يمكن تعديل الطلب بعد إرساله للموافقة."}), 409
        conn.execute(
            """
            UPDATE deals SET client_name = ?, client_phone = ?, apartment_id = ?, proposed_total = ?, down_payment = ?, payment_plan = ?, notes = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                payload.get("client_name") or payload.get("clientName") or old["client_name"],
                payload.get("client_phone") or payload.get("clientPhone") or old["client_phone"],
                payload.get("apartment_id") or payload.get("apartmentId") or old["apartment_id"],
                float(payload.get("proposed_total") or payload.get("proposedTotal") or old["proposed_total"]),
                float(payload.get("down_payment") or payload.get("downPayment") or old["down_payment"] or 0),
                payload.get("payment_plan") or payload.get("paymentPlan") or old["payment_plan"],
                payload.get("notes", old["notes"]),
                now_iso(),
                deal_id,
            ),
        )
        audit(conn, admin["id"], "update", "deal", deal_id, "تم تعديل بيانات الديل", dict(old), payload)
        row = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
        return jsonify({"deal": deal_payload(conn, row)})


def change_deal_status(deal_id: str, target_status: str, roles: set[str], description: str) -> Response:
    admin = require_admin(roles)
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    owner_notes = (payload.get("owner_notes") or payload.get("ownerNotes") or "").strip()
    with db() as conn:
        old = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
        if not old:
            return jsonify({"error": "not_found", "message": "الطلب غير موجود."}), 404
        if admin["role"] == "assistant" and old["assistant_id"] != admin["id"]:
            return jsonify({"error": "forbidden", "message": "ليس لديك صلاحية لتنفيذ هذه العملية."}), 403
        if target_status in {"rejected", "revision_requested"} and admin["role"] == "owner" and not owner_notes:
            return jsonify({"error": "validation", "message": "يرجى إضافة سبب واضح قبل المتابعة."}), 400
        if target_status == "approved":
            apartment = conn.execute("SELECT * FROM apartments WHERE id = ?", (old["apartment_id"],)).fetchone() if old["apartment_id"] else None
            if apartment and apartment["status"] == "sold":
                return jsonify({"error": "validation", "message": "لا يمكن اعتماد ديل على شقة مباعة."}), 409
            active_client = active_client_for_apartment(conn, old["apartment_id"], exclude_client_id=old["client_id"]) if old["apartment_id"] else None
            if active_client:
                return jsonify({"error": "validation", "message": "هذه الشقة محجوزة بالفعل لعميل آخر."}), 409
        approved_by = admin["id"] if target_status in {"approved", "rejected", "revision_requested", "finalized"} else old["approved_by"]
        approved_at = now_iso() if target_status == "approved" else old["approved_at"]
        conn.execute(
            """
            UPDATE deals SET status = ?, owner_notes = ?, approved_by = ?, approved_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (target_status, owner_notes or old["owner_notes"], approved_by, approved_at, now_iso(), deal_id),
        )
        if target_status == "pending_approval":
            conn.execute("UPDATE deals SET submitted_at = ?, updated_at = ? WHERE id = ?", (now_iso(), now_iso(), deal_id))
            if old["apartment_id"]:
                conn.execute("UPDATE apartments SET status = 'pending_approval', updated_at = ? WHERE id = ? AND status = 'available'", (now_iso(), old["apartment_id"]))
        elif target_status == "approved":
            try:
                activate_client_for_deal(conn, old, admin["id"])
            except ValueError as exc:
                return jsonify({"error": "validation", "message": str(exc)}), 409
        elif target_status == "rejected":
            release_apartment_for_deal(conn, old)
        elif target_status == "revision_requested":
            release_apartment_for_deal(conn, old)
        elif target_status == "finalized":
            conn.execute("UPDATE deals SET finalized_at = ?, updated_at = ? WHERE id = ?", (now_iso(), now_iso(), deal_id))
            if old["client_id"]:
                recalc_client(conn, old["client_id"])
        audit(conn, admin["id"], "status", "deal", deal_id, description, dict(old), {"status": target_status})
        row = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
        return jsonify({"deal": deal_payload(conn, row)})


@app.post("/api/admin/deals/<deal_id>/submit")
def submit_deal(deal_id: str) -> Response:
    return change_deal_status(deal_id, "pending_approval", {"owner", "admin", "assistant"}, "تم إرسال الديل للموافقة")


@app.post("/api/admin/deals/<deal_id>/approve")
def approve_deal(deal_id: str) -> Response:
    return change_deal_status(deal_id, "approved", {"owner"}, "تمت الموافقة على الديل")


@app.post("/api/admin/deals/<deal_id>/reject")
def reject_deal(deal_id: str) -> Response:
    return change_deal_status(deal_id, "rejected", {"owner"}, "تم رفض الديل")


@app.post("/api/admin/deals/<deal_id>/request-revision")
def request_deal_revision(deal_id: str) -> Response:
    return change_deal_status(deal_id, "revision_requested", {"owner"}, "تم طلب تعديل الديل")


@app.post("/api/admin/deals/<deal_id>/cancel")
def cancel_deal(deal_id: str) -> Response:
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    reason = (payload.get("reason") or payload.get("cancel_reason") or payload.get("cancelReason") or "").strip()
    if not reason:
        return jsonify({"error": "validation", "message": "سبب الإلغاء مطلوب."}), 400
    with db() as conn:
        old = conn.execute("SELECT * FROM deals WHERE id = %s", (deal_id,)).fetchone()
        if not old:
            return jsonify({"error": "not_found", "message": "الديل غير موجود."}), 404
        if old["status"] == "cancelled":
            return jsonify({"deal": deal_payload(conn, old)})
        if old["status"] == "finalized" and admin["role"] != "owner":
            return jsonify({"error": "forbidden", "message": "ليس لديك صلاحية لتنفيذ هذه العملية."}), 403
        if old["status"] not in {"draft", "pending_approval", "approved", "finalized", "revision_requested"}:
            return jsonify({"error": "validation", "message": "لا يمكن إلغاء هذا الديل."}), 409

        conn.execute(
            "UPDATE deals SET status = 'cancelled', owner_notes = %s, updated_at = %s WHERE id = %s",
            (reason, now_iso(), deal_id),
        )
        if old["client_id"]:
            conn.execute(
                "UPDATE clients SET reservation_status = 'cancelled', office_notes = %s, updated_at = %s WHERE id = %s",
                (f"تم إلغاء الديل. السبب: {reason}", now_iso(), old["client_id"]),
            )
            recalc_client(conn, old["client_id"])
        release_apartment_for_deal(conn, old, admin["id"])
        audit(conn, admin["id"], "cancel_deal", "deal", deal_id, "تم إلغاء ديل", dict(old), {"status": "cancelled", "reason": reason})
        row = conn.execute("SELECT * FROM deals WHERE id = %s", (deal_id,)).fetchone()
        return jsonify({"deal": deal_payload(conn, row)})


@app.delete("/api/admin/deals/<deal_id>")
def delete_draft_deal(deal_id: str) -> Response:
    return delete_draft_deal_impl(deal_id)


@app.post("/api/admin/deals/<deal_id>/delete")
def post_delete_draft_deal(deal_id: str) -> Response:
    return delete_draft_deal_impl(deal_id)


def delete_draft_deal_impl(deal_id: str) -> Response:
    admin = require_admin({"owner", "admin", "assistant"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        old = conn.execute("SELECT * FROM deals WHERE id = %s", (deal_id,)).fetchone()
        if not old:
            return jsonify({"error": "not_found", "message": "الديل غير موجود."}), 404
        if admin["role"] == "assistant" and old["assistant_id"] != admin["id"]:
            return jsonify({"error": "forbidden", "message": "ليس لديك صلاحية لتنفيذ هذه العملية."}), 403
        if old["status"] != "draft":
            return jsonify({"error": "validation", "message": "لا يمكن حذف إلا ديل المسودة."}), 409
        if deal_has_payments(conn, old):
            return jsonify({"error": "validation", "message": "لا يمكن حذف ديل مرتبط بمدفوعات. يمكن إلغاء الديل فقط مع الاحتفاظ بالسجل."}), 409
        audit(conn, admin["id"], "delete_draft_deal", "deal", deal_id, "تم حذف مسودة ديل", dict(old), None)
        conn.execute("DELETE FROM deals WHERE id = %s", (deal_id,))
        release_apartment_for_deal(conn, old, admin["id"])
        return jsonify({"ok": True})


@app.post("/api/admin/clients/<client_id>/cancel")
def cancel_client_reservation(client_id: str) -> Response:
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    reason = (payload.get("reason") or payload.get("cancel_reason") or payload.get("cancelReason") or "").strip()
    if not reason:
        return jsonify({"error": "validation", "message": "سبب الإلغاء مطلوب."}), 400
    with db() as conn:
        old = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not old:
            return jsonify({"error": "not_found", "message": "العميل غير موجود."}), 404
        if old["reservation_status"] == "cancelled":
            return jsonify({"client": client_payload(conn, old)})
        old_apartment_id = old["apartment_id"]
        notes = f"{old['office_notes'] or ''}\nتم إلغاء الحجز. السبب: {reason}".strip()
        conn.execute(
            "UPDATE clients SET reservation_status = 'cancelled', office_notes = ?, updated_at = ? WHERE id = ?",
            (notes, now_iso(), client_id),
        )
        related_deals = conn.execute(
            "SELECT * FROM deals WHERE client_id = ? AND status NOT IN ('cancelled','rejected','finalized')",
            (client_id,),
        ).fetchall()
        for deal in related_deals:
            conn.execute(
                "UPDATE deals SET status = 'cancelled', owner_notes = ?, updated_at = ? WHERE id = ?",
                (reason, now_iso(), deal["id"]),
            )
            audit(conn, admin["id"], "cancel_deal", "deal", deal["id"], "تم إلغاء الديل بعد إلغاء حجز العميل", dict(deal), {"status": "cancelled", "reason": reason})
        recalc_client(conn, client_id)
        if old_apartment_id:
            active_client = active_client_for_apartment(conn, old_apartment_id, exclude_client_id=client_id)
            if not active_client:
                conn.execute(
                    "UPDATE apartments SET status = 'available', assigned_client_id = NULL, updated_at = ? WHERE id = ? AND status != 'sold'",
                    (now_iso(), old_apartment_id),
                )
                audit(conn, admin["id"], "release_apartment", "apartment", old_apartment_id, "تم تحرير الشقة بعد إلغاء حجز العميل", {"client_id": client_id}, {"status": "available"})
        audit(conn, admin["id"], "cancel_client", "client", client_id, "تم إلغاء حجز العميل", dict(old), {"reservation_status": "cancelled", "reason": reason})
        row = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
        return jsonify({"client": client_payload(conn, row)})


@app.post("/api/admin/clients/<client_id>/delete-with-records")
def delete_client_with_financial_records(client_id: str) -> Response:
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    password = payload.get("password") or payload.get("current_password") or payload.get("currentPassword") or ""
    reason = (payload.get("reason") or "").strip()
    if not verify_admin_confirmation_password(admin, password):
        return jsonify({"error": "validation", "message": "كلمة المرور غير صحيحة."}), 401
    if not reason:
        return jsonify({"error": "validation", "message": "سبب الحذف مطلوب."}), 400

    with db() as conn:
        old = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not old:
            return jsonify({"error": "not_found", "message": "العميل غير موجود."}), 404
        payments = rows_to_dicts(conn.execute("SELECT id, amount, payment_status, receipt_number FROM payments WHERE client_id = ?", (client_id,)).fetchall())
        installments = rows_to_dicts(conn.execute("SELECT id, amount, paid_amount, status FROM installments WHERE client_id = ?", (client_id,)).fetchall())
        related_deals = rows_to_dicts(conn.execute("SELECT * FROM deals WHERE client_id = ?", (client_id,)).fetchall())
        apartment_id = old["apartment_id"]

        for deal in related_deals:
            new_status = deal["status"]
            if deal["status"] not in {"cancelled", "rejected", "finalized"}:
                new_status = "cancelled"
            conn.execute(
                "UPDATE deals SET client_id = NULL, status = ?, owner_notes = ?, updated_at = ? WHERE id = ?",
                (new_status, reason, now_iso(), deal["id"]),
            )
            audit(
                conn,
                admin["id"],
                "unlink_client_from_deal",
                "deal",
                deal["id"],
                "تم فصل العميل عن الديل قبل حذف السجل المالي",
                deal,
                {"client_id": None, "status": new_status, "reason": reason},
            )

        audit(
            conn,
            admin["id"],
            "delete_client_with_financial_records",
            "client",
            client_id,
            "تم حذف العميل مع السجل المالي بعد تأكيد كلمة المرور",
            {
                "client": dict(old),
                "payments": payments,
                "installments": installments,
                "deals": related_deals,
            },
            {"reason": reason},
        )
        conn.execute("DELETE FROM clients WHERE id = ?", (client_id,))
        if apartment_id:
            active_client = active_client_for_apartment(conn, apartment_id, exclude_client_id=client_id)
            if not active_client:
                conn.execute(
                    "UPDATE apartments SET status = 'available', assigned_client_id = NULL, updated_at = ? WHERE id = ?",
                    (now_iso(), apartment_id),
                )
                audit(conn, admin["id"], "release_apartment", "apartment", apartment_id, "تم تحرير الشقة بعد حذف العميل مع السجل المالي", {"client_id": client_id}, {"status": "available"})
        return jsonify({"ok": True})


@app.get("/api/admin/contracts")
def get_contracts() -> Response:
    admin = require_admin({"owner", "admin", "assistant"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        if admin["role"] == "assistant":
            rows = conn.execute(
                """
                SELECT contracts.* FROM contracts
                JOIN deals ON deals.id = contracts.deal_id
                WHERE deals.assistant_id = ?
                ORDER BY contracts.created_at DESC
                """,
                (admin["id"],),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM contracts ORDER BY created_at DESC").fetchall()
        return jsonify({"contracts": [contract_payload(row) for row in rows]})


@app.post("/api/admin/contracts/generate")
def generate_contract() -> Response:
    admin = require_admin({"owner", "admin", "assistant"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    deal_id = payload.get("deal_id") or payload.get("dealId")
    requested_type = payload.get("contract_type") or payload.get("contractType") or "draft_contract"
    if requested_type not in {"draft_contract", "final_contract"}:
        return jsonify({"error": "validation", "message": "نوع العقد غير صحيح."}), 400
    with db() as conn:
        deal = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
        if not deal:
            return jsonify({"error": "not_found", "message": "الطلب غير موجود."}), 404
        if admin["role"] == "assistant" and (deal["assistant_id"] != admin["id"] or requested_type != "draft_contract"):
            return jsonify({"error": "forbidden", "message": "ليس لديك صلاحية لتنفيذ هذه العملية."}), 403
        if requested_type == "final_contract" and admin["role"] != "owner":
            return jsonify({"error": "forbidden", "message": "إصدار العقد النهائي متاح للمدير الرئيسي فقط."}), 403
        if requested_type == "final_contract" and deal["status"] != "approved":
            return jsonify({"error": "validation", "message": "لا يمكن إصدار العقد النهائي قبل الموافقة."}), 409
        apartment = conn.execute("SELECT * FROM apartments WHERE id = ?", (deal["apartment_id"],)).fetchone()
        contract_id = public_id("contract")
        title = "العقد النهائي" if requested_type == "final_contract" else "عقد مسودة"
        filename = f"contract-{contract_id}.pdf"
        apartment_unit = normalize_display_text(apartment["unit_code"]) if apartment else "-"
        apartment_direction = normalize_display_text(apartment["direction_ar"]) if apartment else "-"
        client_name = normalize_display_text(deal["client_name"])
        client_phone = normalize_display_text(deal["client_phone"] or "-")
        sections = [
            (
                "بيانات التعاقد",
                [
                    f"اسم العميل: {client_name}",
                    f"رقم الهاتف: {client_phone}",
                    f"الوحدة: {apartment_unit}",
                    f"الدور: {apartment['floor_number'] if apartment else '-'}",
                    f"المساحة: {apartment['area'] if apartment else '-'} متر مربع",
                    f"الاتجاه: {apartment_direction}",
                    f"القيمة المقترحة: {format_money(deal['proposed_total'])}",
                    f"حالة الطلب: {status_label_ar(deal['status'])}",
                ],
            )
        ]
        pdf_path = generate_pdf(title, sections, filename, "هذا المستند صادر إلكترونيًا من نظام إدارة الحجوزات.")
        conn.execute(
            """
            INSERT INTO contracts (id, deal_id, contract_type, status, pdf_url, issued_by, issued_at, created_at)
            VALUES (?, ?, ?, 'issued', ?, ?, ?, ?)
            """,
            (contract_id, deal_id, requested_type, f"/generated/{pdf_path.name}", admin["id"], now_iso(), now_iso()),
        )
        if requested_type == "final_contract":
            client_id = deal["client_id"] if "client_id" in set(deal.keys()) else None
            conn.execute("UPDATE deals SET status = 'finalized', finalized_at = ?, updated_at = ? WHERE id = ?", (now_iso(), now_iso(), deal_id))
            if client_id:
                conn.execute("UPDATE clients SET reservation_status = 'sold', updated_at = ? WHERE id = ?", (now_iso(), client_id))
            if deal["apartment_id"]:
                conn.execute("UPDATE apartments SET status = 'sold', updated_at = ? WHERE id = ?", (now_iso(), deal["apartment_id"]))
        audit(conn, admin["id"], "generate", "contract", contract_id, f"تم إصدار {title}", None, payload)
        row = conn.execute("SELECT * FROM contracts WHERE id = ?", (contract_id,)).fetchone()
        return jsonify({"contract": contract_payload(row), "url": f"/generated/{pdf_path.name}"})


@app.get("/api/owner/dashboard-summary")
def owner_dashboard_summary() -> Response:
    admin = require_admin({"owner"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        return jsonify({"summary": owner_dashboard_summary_payload(conn)})


@app.get("/api/owner/alerts")
def owner_alerts() -> Response:
    admin = require_admin({"owner"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        return jsonify({"alerts": owner_alerts_payload(conn)})


@app.get("/api/owner/assistant-performance")
def owner_assistant_performance() -> Response:
    admin = require_admin({"owner"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        return jsonify({"assistants": assistant_performance_payload(conn)})


@app.get("/api/owner/deals")
def owner_deals() -> Response:
    admin = require_admin({"owner"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        rows = conn.execute("SELECT * FROM deals ORDER BY created_at DESC").fetchall()
        return jsonify({"deals": [deal_payload(conn, row) for row in rows]})


@app.get("/api/owner/deals/<deal_id>")
def owner_deal_detail(deal_id: str) -> Response:
    admin = require_admin({"owner"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        row = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
        if not row:
            return jsonify({"error": "not_found", "message": "الديل غير موجود."}), 404
        return jsonify({"deal": deal_payload(conn, row)})


@app.post("/api/owner/deals/<deal_id>/approve")
def owner_approve_deal(deal_id: str) -> Response:
    return change_deal_status(deal_id, "approved", {"owner"}, "تمت الموافقة على الديل")


@app.post("/api/owner/deals/<deal_id>/reject")
def owner_reject_deal(deal_id: str) -> Response:
    return change_deal_status(deal_id, "rejected", {"owner"}, "تم رفض الديل")


@app.post("/api/owner/deals/<deal_id>/request-revision")
def owner_request_deal_revision(deal_id: str) -> Response:
    return change_deal_status(deal_id, "revision_requested", {"owner"}, "تم طلب تعديل الديل")


@app.post("/api/owner/deals/<deal_id>/finalize")
def owner_finalize_deal(deal_id: str) -> Response:
    admin = require_admin({"owner"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        deal = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
        if not deal:
            return jsonify({"error": "not_found", "message": "الديل غير موجود."}), 404
        if deal["status"] != "approved":
            return jsonify({"error": "validation", "message": "لا يمكن إنهاء الديل قبل الموافقة عليه."}), 409
    return change_deal_status(deal_id, "finalized", {"owner"}, "تم إنهاء الديل")


@app.post("/api/owner/deals/<deal_id>/cancel")
def owner_cancel_deal(deal_id: str) -> Response:
    return cancel_deal(deal_id)


@app.delete("/api/owner/deals/<deal_id>")
def owner_delete_draft_deal(deal_id: str) -> Response:
    return delete_draft_deal_impl(deal_id)


@app.get("/api/owner/clients")
def owner_clients() -> Response:
    admin = require_admin({"owner"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        consolidate_client_portfolios(conn)
        for client in conn.execute("SELECT id FROM clients").fetchall():
            recalc_client(conn, client["id"])
        rows = conn.execute("SELECT * FROM clients ORDER BY created_at DESC").fetchall()
        return jsonify({"clients": [client_payload(conn, row) for row in rows]})


@app.get("/api/owner/clients/<client_id>")
def owner_client_detail(client_id: str) -> Response:
    admin = require_admin({"owner"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        row = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not row:
            return jsonify({"error": "not_found", "message": "العميل غير موجود."}), 404
        return jsonify({"client": client_payload(conn, row)})


@app.get("/api/owner/apartments")
def owner_apartments() -> Response:
    admin = require_admin({"owner"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        rows = conn.execute("SELECT * FROM apartments ORDER BY floor_number DESC, apartment_type").fetchall()
        return jsonify({"apartments": [apartment_payload(row) for row in rows]})


@app.get("/api/owner/apartments/<apartment_id>/timeline")
def owner_apartment_timeline(apartment_id: str) -> Response:
    admin = require_admin({"owner"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        logs = conn.execute(
            """
            SELECT audit_logs.*, admins.full_name AS admin_name, admins.role AS admin_role
            FROM audit_logs LEFT JOIN admins ON admins.id = audit_logs.admin_id
            WHERE audit_logs.entity_id = ? OR audit_logs.new_value LIKE ?
            ORDER BY audit_logs.created_at DESC LIMIT 100
            """,
            (apartment_id, f"%{apartment_id}%"),
        ).fetchall()
        return jsonify({"timeline": rows_to_dicts(logs)})


@app.patch("/api/owner/apartments/<apartment_id>")
def owner_update_apartment(apartment_id: str) -> Response:
    admin = require_admin({"owner"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    with db() as conn:
        old = conn.execute("SELECT * FROM apartments WHERE id = ?", (apartment_id,)).fetchone()
        if not old:
            return jsonify({"error": "not_found", "message": "الشقة غير موجودة."}), 404
        status = payload.get("status") or old["status"]
        conn.execute(
            """
            UPDATE apartments SET price = ?, status = ?, notes = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                float(payload.get("price") or old["price"] or 0),
                status_db(status, "apartment"),
                payload.get("notes", old["notes"]),
                now_iso(),
                apartment_id,
            ),
        )
        audit(conn, admin["id"], "update", "apartment", apartment_id, "تم تعديل بيانات الشقة", dict(old), payload)
        row = conn.execute("SELECT * FROM apartments WHERE id = ?", (apartment_id,)).fetchone()
        return jsonify({"apartment": apartment_payload(row)})


@app.get("/api/owner/payments")
def owner_payments() -> Response:
    admin = require_admin({"owner"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        rows = conn.execute("SELECT * FROM payments ORDER BY payment_date DESC, created_at DESC").fetchall()
        return jsonify({"payments": [payment_payload(row) for row in rows]})


@app.get("/api/owner/contracts")
def owner_contracts() -> Response:
    admin = require_admin({"owner"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        rows = conn.execute("SELECT * FROM contracts ORDER BY created_at DESC").fetchall()
        return jsonify({"contracts": [contract_payload(row) for row in rows]})


@app.get("/api/owner/settings")
def owner_get_settings() -> Response:
    admin = require_admin({"owner"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        return jsonify({"settings": owner_settings_payload(conn)})


@app.patch("/api/owner/settings")
def owner_patch_settings() -> Response:
    admin = require_admin({"owner"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    with db() as conn:
        old = owner_settings_payload(conn)
        office = payload.get("office") or {}
        for key in {"office_name", "office_phone", "whatsapp_number", "office_address", "office_email", "currency", "office_logo"}:
            if key in office:
                upsert_setting(conn, key, office[key])
        for key in {"contract_template", "price_settings", "permission_settings", "system_settings", "media_settings"}:
            camel = "".join([key.split("_")[0], *[part.title() for part in key.split("_")[1:]]])
            if camel in payload:
                upsert_setting(conn, key, payload[camel])
        if isinstance(payload.get("systemSettings"), dict) and "receipt_prefix" in payload["systemSettings"]:
            upsert_setting(conn, "receipt_prefix", payload["systemSettings"]["receipt_prefix"])
        if isinstance(payload.get("contractTemplate"), dict) and "footer_text" in payload["contractTemplate"]:
            upsert_setting(conn, "statement_footer", payload["contractTemplate"]["footer_text"])
        audit(conn, admin["id"], "update", "settings", "owner_settings", "تم تعديل إعدادات المالك", old, payload)
        return jsonify({"settings": owner_settings_payload(conn)})


@app.get("/api/owner/contract-template")
def owner_get_contract_template() -> Response:
    admin = require_admin({"owner"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        return jsonify({"contractTemplate": setting_json(conn, "contract_template", {})})


@app.patch("/api/owner/contract-template")
def owner_patch_contract_template() -> Response:
    admin = require_admin({"owner"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    with db() as conn:
        old = setting_json(conn, "contract_template", {})
        upsert_setting(conn, "contract_template", payload)
        if "footer_text" in payload:
            upsert_setting(conn, "statement_footer", payload["footer_text"])
        audit(conn, admin["id"], "update", "contract_template", "contract_template", "تم حفظ صيغة العقد", old, payload)
        return jsonify({"contractTemplate": setting_json(conn, "contract_template", {})})


@app.get("/api/owner/price-settings")
def owner_get_price_settings() -> Response:
    admin = require_admin({"owner"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        return jsonify({"priceSettings": setting_json(conn, "price_settings", {})})


@app.patch("/api/owner/price-settings")
def owner_patch_price_settings() -> Response:
    admin = require_admin({"owner"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    with db() as conn:
        old = setting_json(conn, "price_settings", {})
        upsert_setting(conn, "price_settings", payload)
        audit(conn, admin["id"], "update", "price_settings", "price_settings", "تم تعديل إعدادات الأسعار", old, payload)
        return jsonify({"priceSettings": setting_json(conn, "price_settings", {})})


@app.get("/api/owner/audit-logs")
def owner_audit_logs() -> Response:
    admin = require_admin({"owner"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        rows = conn.execute(
            """
            SELECT audit_logs.*, admins.full_name AS admin_name, admins.role AS admin_role, NULL AS ip_address
            FROM audit_logs LEFT JOIN admins ON admins.id = audit_logs.admin_id
            ORDER BY audit_logs.created_at DESC LIMIT 500
            """
        ).fetchall()
        return jsonify({"auditLogs": rows_to_dicts(rows)})


@app.get("/api/owner/audit-logs/<log_id>")
def owner_audit_log_detail(log_id: str) -> Response:
    admin = require_admin({"owner"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        row = conn.execute(
            """
            SELECT audit_logs.*, admins.full_name AS admin_name, admins.role AS admin_role, NULL AS ip_address
            FROM audit_logs LEFT JOIN admins ON admins.id = audit_logs.admin_id
            WHERE audit_logs.id = ?
            """,
            (log_id,),
        ).fetchone()
        if not row:
            return jsonify({"error": "not_found", "message": "سجل النشاط غير موجود."}), 404
        return jsonify({"auditLog": row_to_dict(row)})


def receipt_sections(conn: Any, payment_id: str) -> tuple[str, list[tuple[str, list[str]]], str]:
    payment = conn.execute("SELECT * FROM payments WHERE id = ?", (payment_id,)).fetchone()
    if not payment:
        raise ValueError("Payment not found")
    client = conn.execute("SELECT * FROM clients WHERE id = ?", (payment["client_id"],)).fetchone()
    apartment = conn.execute("SELECT * FROM apartments WHERE id = ?", (payment["apartment_id"],)).fetchone()
    settings = all_settings(conn)
    title = "إيصال دفع"
    office_name = normalize_display_text(settings.get("office_name", ""))
    client_name = normalize_display_text(client["full_name"])
    client_code = normalize_display_text(client["client_code"])
    unit_code = normalize_display_text(apartment["unit_code"])
    direction = normalize_display_text(apartment["direction_ar"])
    notes = normalize_display_text(payment["notes"] or "-")
    lines = [
        f"اسم المكتب: {office_name}",
        f"رقم الإيصال: {payment['receipt_number'] or ''}",
        f"تاريخ الدفع: {payment['payment_date']}",
        f"اسم العميل: {client_name}",
        f"كود الحجز: {client_code}",
        f"رقم الوحدة: {unit_code}",
        f"الدور: {apartment['floor_number']}",
        f"المساحة: {apartment['area']} متر مربع",
        f"الاتجاه: {direction}",
        f"المبلغ: {format_money(payment['amount'])}",
        f"طريقة الدفع: {status_label_ar(payment['payment_method'])}",
        f"السعر الإجمالي: {format_money(client['total_amount'])}",
        f"إجمالي المدفوع: {format_money(client['paid_amount'])}",
        f"المتبقي: {format_money(client['remaining_amount'])}",
        f"ملاحظات: {notes}",
    ]
    return title, [("بيانات الإيصال", lines)], "هذا الإيصال صادر إلكترونيًا من نظام إدارة الحجوزات."


@app.post("/api/admin/receipts/generate")
def generate_receipt() -> Response:
    admin = require_admin({"owner", "admin", "accountant"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    payment_id = payload.get("payment_id") or payload.get("paymentId")
    with db() as conn:
        payment = conn.execute("SELECT * FROM payments WHERE id = ?", (payment_id,)).fetchone()
        if not payment:
            return jsonify({"error": "not_found", "message": "الدفعة غير موجودة."}), 404
        if payment["payment_status"] != "confirmed":
            return jsonify({"error": "validation", "message": "يمكن إنشاء إيصال للدفعات المؤكدة فقط."}), 400
        if not payment["receipt_number"]:
            number = receipt_number(conn)
            conn.execute("UPDATE payments SET receipt_number = ?, updated_at = ? WHERE id = ?", (number, now_iso(), payment_id))
        create_receipt_record(conn, payment_id, admin["id"])
        title, sections, footer = receipt_sections(conn, payment_id)
        filename = f"receipt-{payment_id}.pdf"
        path = generate_pdf(title, sections, filename, footer)
        conn.execute("UPDATE receipts SET receipt_pdf_url = ? WHERE payment_id = ?", (f"/generated/{filename}", payment_id))
        audit(conn, admin["id"], "generate", "receipt", payment_id, "تم تحميل إيصال دفع")
        return jsonify({"url": f"/generated/{path.name}"})


def statement_sections(conn: Any, client_id: str) -> tuple[str, list[tuple[str, list[str]]], str]:
    client = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
    if not client:
        raise ValueError("Client not found")
    apartment = conn.execute("SELECT * FROM apartments WHERE id = ?", (client["apartment_id"],)).fetchone()
    payments = conn.execute("SELECT * FROM payments WHERE client_id = ? ORDER BY payment_date ASC", (client_id,)).fetchall()
    installments = conn.execute("SELECT * FROM installments WHERE client_id = ? ORDER BY installment_number ASC", (client_id,)).fetchall()
    settings = all_settings(conn)
    client_name = normalize_display_text(client["full_name"])
    client_code = normalize_display_text(client["client_code"])
    client_phone = normalize_display_text(client["phone"] or "-")
    apartment_unit = normalize_display_text(apartment["unit_code"])
    apartment_direction = normalize_display_text(apartment["direction_ar"])
    office_notes = normalize_display_text(client["office_notes"] or "-")
    sections = [
        (
            "بيانات العميل",
            [
                f"اسم العميل: {client_name}",
                f"كود الحجز: {client_code}",
                f"الهاتف: {client_phone}",
                f"حالة الحجز: {status_label_ar(client['reservation_status'])}",
                f"تاريخ الحجز: {client['reservation_date']}",
                f"تاريخ الاستلام المتوقع: {client['expected_delivery_date'] or '-'}",
            ],
        ),
        (
            "تفاصيل الشقة",
            [
                f"رقم الوحدة: {apartment_unit}",
                f"الدور: {apartment['floor_number']}",
                f"المساحة: {apartment['area']} متر مربع",
                f"الاتجاه: {apartment_direction}",
                f"حالة الشقة: {status_label_ar(apartment['status'])}",
            ],
        ),
        (
            "ملخص الدفع",
            [
                f"السعر الإجمالي: {format_money(client['total_amount'])}",
                f"المدفوع: {format_money(client['paid_amount'])}",
                f"المتبقي: {format_money(client['remaining_amount'])}",
                f"حالة الدفع: {status_label_ar(client['payment_status'])}",
            ],
        ),
        (
            "سجل المدفوعات",
            [f"{p['payment_date']} - {format_money(p['amount'])} - {status_label_ar(p['payment_method'])} - {p['receipt_number'] or '-'}" for p in payments] or ["لا توجد مدفوعات"],
        ),
        (
            "جدول الأقساط",
            [f"قسط {i['installment_number']} - {i['due_date']} - {format_money(i['amount'])} - المتبقي {format_money(i['remaining_amount'])} - {status_label_ar(i['status'])}" for i in installments] or ["لا توجد أقساط"],
        ),
        ("ملاحظات المكتب", [office_notes]),
    ]
    return "كشف الحجز", sections, normalize_display_text(settings.get("statement_footer") or "هذا المستند صادر إلكترونيًا من نظام إدارة الحجوزات.")


@app.get("/api/client/statement/<client_id>")
def client_statement(client_id: str) -> Response:
    code = normalize_code(request.args.get("code", ""))
    with db() as conn:
        rows = rows_for_portfolio_code(conn, code)
        if not rows or not any(row["id"] == client_id for row in rows):
            return jsonify({"error": "not_found", "message": "لم نتمكن من التحقق من كود الحجز."}), 404
        client = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
        title, sections, footer = statement_sections(conn, client_id)
        filename = f"statement-{client_id}.pdf"
        path = generate_pdf(title, sections, filename, footer)
        public_code = client["portfolio_code"] or client["client_code"]
        return send_file(path, as_attachment=True, download_name=f"كشف-الحجز-{public_code}.pdf")


@app.get("/api/admin/statement/<client_id>")
def admin_statement(client_id: str) -> Response:
    admin = require_admin()
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        client = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not client:
            return jsonify({"error": "not_found", "message": "العميل غير موجود."}), 404
        title, sections, footer = statement_sections(conn, client_id)
        filename = f"statement-{client_id}.pdf"
        path = generate_pdf(title, sections, filename, footer)
        audit(conn, admin["id"], "export", "statement", client_id, "تم تحميل كشف حجز")
        return send_file(path, as_attachment=True, download_name=f"كشف-الحجز-{client['client_code']}.pdf")


def workbook_response(workbook: Workbook, filename: str) -> Response:
    for worksheet in workbook.worksheets:
        for row in worksheet.iter_rows():
            for cell in row:
                if isinstance(cell.value, str):
                    cell.value = normalize_display_text(cell.value)
    output = io.BytesIO()
    workbook.save(output)
    output.seek(0)
    return send_file(output, as_attachment=True, download_name=filename, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@app.get("/api/admin/export/<kind>")
def export_excel(kind: str) -> Response:
    admin = require_admin()
    if not isinstance(admin, dict):
        return admin
    wb = Workbook()
    ws = wb.active
    with db() as conn:
        if kind == "clients":
            ws.title = "العملاء"
            ws.append(["اسم العميل", "كود الحجز", "رقم الشقة", "الدور", "المساحة", "الاتجاه", "السعر الإجمالي", "المدفوع", "المتبقي", "حالة الحجز", "حالة الدفع", "تاريخ الحجز"])
            rows = conn.execute(
                """
                SELECT clients.*, apartments.unit_code, apartments.floor_number, apartments.area, apartments.direction_ar
                FROM clients LEFT JOIN apartments ON apartments.id = clients.apartment_id
                ORDER BY clients.created_at DESC
                """
            ).fetchall()
            for r in rows:
                ws.append([r["full_name"], r["client_code"], r["unit_code"], r["floor_number"], r["area"], r["direction_ar"], r["total_amount"], r["paid_amount"], r["remaining_amount"], status_label_ar(r["reservation_status"]), status_label_ar(r["payment_status"]), r["reservation_date"]])
        elif kind == "payments":
            ws.title = "المدفوعات"
            ws.append(["اسم العميل", "كود الحجز", "رقم الشقة", "تاريخ الدفع", "المبلغ", "طريقة الدفع", "حالة الدفعة", "رقم الإيصال", "ملاحظات"])
            rows = conn.execute(
                """
                SELECT payments.*, clients.full_name, clients.client_code, apartments.unit_code
                FROM payments
                JOIN clients ON clients.id = payments.client_id
                LEFT JOIN apartments ON apartments.id = payments.apartment_id
                ORDER BY payments.payment_date DESC
                """
            ).fetchall()
            for r in rows:
                ws.append([r["full_name"], r["client_code"], r["unit_code"], r["payment_date"], r["amount"], status_label_ar(r["payment_method"]), status_label_ar(r["payment_status"]), r["receipt_number"], r["notes"]])
        elif kind == "apartments":
            ws.title = "الشقق"
            ws.append(["رقم الشقة", "الدور", "النوع", "المساحة", "الاتجاه", "السعر", "الحالة", "ملاحظات"])
            for r in conn.execute("SELECT * FROM apartments ORDER BY floor_number, apartment_type").fetchall():
                ws.append([r["unit_code"], r["floor_number"], r["apartment_type"], r["area"], r["direction_ar"], r["price"], status_label_ar(r["status"]), r["notes"]])
        elif kind == "installments":
            ws.title = "الأقساط"
            ws.append(["اسم العميل", "كود الحجز", "رقم القسط", "تاريخ الاستحقاق", "قيمة القسط", "المدفوع", "المتبقي", "الحالة", "ملاحظات"])
            rows = conn.execute(
                """
                SELECT installments.*, clients.full_name, clients.client_code
                FROM installments JOIN clients ON clients.id = installments.client_id
                ORDER BY installments.due_date ASC
                """
            ).fetchall()
            for r in rows:
                ws.append([r["full_name"], r["client_code"], r["installment_number"], r["due_date"], r["amount"], r["paid_amount"], r["remaining_amount"], status_label_ar(r["status"]), r["notes"]])
        elif kind == "financial-summary":
            ws.title = "التقرير المالي"
            total_collected = conn.execute("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_status = 'confirmed'").fetchone()[0]
            total_remaining = conn.execute("SELECT COALESCE(SUM(remaining_amount), 0) FROM clients").fetchone()[0]
            ws.append(["البند", "القيمة"])
            ws.append(["إجمالي المبالغ المحصلة", total_collected])
            ws.append(["إجمالي المبالغ المتبقية", total_remaining])
        else:
            return jsonify({"error": "not_found", "message": "نوع التصدير غير معروف."}), 404
        audit(conn, admin["id"], "export", kind, None, f"تم تصدير {kind}")
    return workbook_response(wb, f"{kind}.xlsx")


# Project Updates API Endpoints
@app.get("/api/project-updates/published")
def get_published_updates() -> Response:
    """Get all published project updates for public display"""
    def load_published_updates() -> list[dict[str, Any]]:
        with db() as conn:
            updates = conn.execute(
                """
                SELECT id, title, description, update_date, stage, media_type, media_url, thumbnail_url
                FROM project_updates
                WHERE status = 'published'
                ORDER BY display_order ASC, update_date DESC
                """
            ).fetchall()
            return rows_to_dicts(updates)

    return cached_public_json("published_updates", load_published_updates)


@app.get("/api/admin/project-updates")
def get_all_project_updates() -> Response:
    """Get all project updates for admin management"""
    admin = require_admin()
    if not isinstance(admin, dict):
        return admin
    page = request_page()
    limit = request_limit()
    offset = (page - 1) * limit
    
    with db() as conn:
        total = conn.execute("SELECT COUNT(*) FROM project_updates").fetchone()[0]
        updates = conn.execute(
            """
            SELECT pu.*, a.full_name as created_by_name
            FROM project_updates pu
            LEFT JOIN admins a ON pu.created_by = a.id
            ORDER BY pu.display_order ASC, pu.update_date DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()
        return jsonify(paginated_payload("updates", rows_to_dicts(updates), total, page, limit))

@app.post("/api/admin/project-updates")
def create_project_update() -> Response:
    """Create a new project update"""
    admin = require_admin()
    if not isinstance(admin, dict):
        return admin
    
    payload = request.get_json(silent=True) or {}
    
    # Validate required fields
    required_fields = ['title', 'description', 'update_date', 'stage', 'media_type']
    for field in required_fields:
        if not payload.get(field):
            return jsonify({"error": f"هذا الحقل مطلوب: {field}"}), 400
    
    # Validate stage
    valid_stages = ['foundation', 'concrete', 'walls', 'finishing', 'exterior', 'delivery', 'general']
    if payload.get('stage') not in valid_stages:
        return jsonify({"error": "مرحلة المشروع غير صالحة"}), 400
    
    # Validate media type
    if payload.get('media_type') not in ['image', 'video']:
        return jsonify({"error": "نوع الوسائط غير صالح"}), 400
    
    with db() as conn:
        update_id = public_id('UPD')
        conn.execute(
            """
            INSERT INTO project_updates 
            (id, title, description, update_date, stage, media_type, media_url, thumbnail_url, status, display_order, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                update_id,
                payload['title'],
                payload['description'],
                payload['update_date'],
                payload['stage'],
                payload['media_type'],
                payload.get('media_url'),
                payload.get('thumbnail_url'),
                payload.get('status', 'draft'),
                payload.get('display_order', 0),
                admin['id'],
                now_iso(),
                now_iso()
            )
        )
        
        audit(conn, admin['id'], 'create', 'project_update', update_id, f"تم إنشاء تحديث: {payload['title']}")
        
        return jsonify({"id": update_id, "message": "تم إضافة التحديث بنجاح"})

@app.patch("/api/admin/project-updates/<update_id>")
def update_project_update(update_id: str) -> Response:
    """Update an existing project update"""
    admin = require_admin()
    if not isinstance(admin, dict):
        return admin
    
    payload = request.get_json(silent=True) or {}
    
    with db() as conn:
        # Check if update exists
        existing = conn.execute("SELECT * FROM project_updates WHERE id = ?", (update_id,)).fetchone()
        if not existing:
            return jsonify({"error": "التحديث غير موجود"}), 404
        
        # Update fields
        update_fields = []
        update_values = []
        
        for field in ['title', 'description', 'update_date', 'stage', 'media_type', 'media_url', 'thumbnail_url', 'status', 'display_order']:
            if field in payload:
                update_fields.append(f"{field} = ?")
                update_values.append(payload[field])
        
        if update_fields:
            update_values.extend([update_id, now_iso()])
            conn.execute(
                f"UPDATE project_updates SET {', '.join(update_fields)}, updated_at = ? WHERE id = ?",
                update_values
            )
            
            audit(conn, admin['id'], 'update', 'project_update', update_id, f"تم تعديل تحديث: {payload.get('title', existing['title'])}")
        
        return jsonify({"message": "تم تعديل التحديث بنجاح"})

@app.delete("/api/admin/project-updates/<update_id>")
def delete_project_update(update_id: str) -> Response:
    """Archive/delete a project update"""
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin

    payload = request.get_json(silent=True) or {}
    reason = (payload.get("reason") or "").strip()

    with db() as conn:
        # Check if update exists
        existing = conn.execute("SELECT * FROM project_updates WHERE id = %s", (update_id,)).fetchone()
        if not existing:
            return jsonify({"error": "التحديث غير موجود"}), 404

        # Archive instead of hard delete
        conn.execute(
            "UPDATE project_updates SET status = 'archived', updated_at = %s WHERE id = %s",
            (now_iso(), update_id)
        )

        description = f"تم أرشفة تحديث: {existing['title']}"
        if reason:
            description += f" (السبب: {reason})"
        audit(conn, admin['id'], 'archive', 'project_update', update_id, description,
              {"old_status": existing.get("status")},
              {"new_status": "archived", "reason": reason})

        return jsonify({"message": "تم إزالة المنشور بنجاح"})

@app.post("/api/admin/project-updates/<update_id>/publish")
def publish_project_update(update_id: str) -> Response:
    """Publish a project update"""
    admin = require_admin()
    if not isinstance(admin, dict):
        return admin
    
    with db() as conn:
        conn.execute(
            "UPDATE project_updates SET status = 'published', updated_at = ? WHERE id = ?",
            (now_iso(), update_id)
        )
        
        audit(conn, admin['id'], 'publish', 'project_update', update_id, "تم نشر التحديث")
        
        return jsonify({"message": "تم نشر التحديث بنجاح"})

@app.post("/api/admin/project-updates/<update_id>/unpublish")
def unpublish_project_update(update_id: str) -> Response:
    """Unpublish a project update"""
    admin = require_admin()
    if not isinstance(admin, dict):
        return admin
    
    with db() as conn:
        conn.execute(
            "UPDATE project_updates SET status = 'draft', updated_at = ? WHERE id = ?",
            (now_iso(), update_id)
        )
        
        audit(conn, admin['id'], 'unpublish', 'project_update', update_id, "تم إلغاء نشر التحديث")
        
        return jsonify({"message": "تم إلغاء نشر التحديث بنجاح"})

@app.post("/api/admin/uploads/project-update-media")
def upload_project_update_media() -> Response:
    """Upload validated image/video file for project updates."""
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin

    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename:
        return jsonify({"error": "validation", "message": "يرجى اختيار صورة أو فيديو."}), 400

    original_name = secure_filename(uploaded.filename)
    extension = Path(original_name).suffix.lower().lstrip(".")
    if extension not in ALLOWED_UPDATE_EXTENSIONS:
        return jsonify({"error": "validation", "message": "نوع الملف غير مسموح. الصيغ المسموحة: jpg, jpeg, png, webp, mp4, webm."}), 400

    uploaded.stream.seek(0, os.SEEK_END)
    size = uploaded.stream.tell()
    uploaded.stream.seek(0)
    max_size = MAX_UPDATE_UPLOAD_MB * 1024 * 1024
    if size > max_size:
        return jsonify({"error": "validation", "message": f"حجم الملف أكبر من الحد المسموح ({MAX_UPDATE_UPLOAD_MB}MB)."}), 400

    media_type = "video" if extension in {"mp4", "webm"} else "image"
    upload_dir = UPLOAD_DIR / "project-updates"
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{public_id('media')}.{extension}"
    file_path = upload_dir / filename
    uploaded.save(str(file_path))

    file_url = f"/uploads/project-updates/{filename}"
    with db() as conn:
        audit(conn, admin["id"], "upload", "project_update_media", None, f"تم رفع ملف {media_type}", None, {"url": file_url})
    return jsonify({"url": file_url, "mediaType": media_type, "message": "تم رفع الملف بنجاح"})

if __name__ == "__main__":
    init_db()
    app.run(host="127.0.0.1", port=8000, debug=False)

