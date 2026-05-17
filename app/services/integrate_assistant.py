#!/usr/bin/env python3
"""
Legacy helper to integrate assistant endpoints into app/main.py.

This file is kept for project history and local maintenance only.
"""

from pathlib import Path
import re

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MAIN_PATH = PROJECT_ROOT / "app" / "main.py"
ASSISTANT_ROUTES_PATH = PROJECT_ROOT / "app" / "routes" / "assistant_routes.py"

# Read the current Flask entry point.
with MAIN_PATH.open('r', encoding='utf-8') as f:
    content = f.read()

# 1. Find and insert require_assistant function after require_admin
require_assistant_fn = '''

def require_assistant() -> dict[str, Any] | Response:
    """Require authenticated assistant role."""
    admin = current_admin()
    if not admin:
        return jsonify({"error": "unauthorized", "message": "يجب تسجيل الدخول أولًا."}), 401
    if admin["role"] != "assistant":
        with db() as conn:
            audit(conn, admin["id"], "access_denied", "admin", admin["id"], f"محاولة وصول من {admin['role']}")
        return jsonify({"error": "forbidden", "message": "ليس لديك صلاحية لتنفيذ هذه العملية."}), 403
    return admin
'''

# Find where require_admin ends and insert require_assistant
match = re.search(r'(def require_admin\(.*?\n(?:.*?\n)*?    return admin\n)', content)
if match:
    insert_pos = match.end()
    content = content[:insert_pos] + require_assistant_fn + content[insert_pos:]
    print("✓ Added require_assistant function")
else:
    print("✗ Could not find require_admin function")

# 2. Add assistant endpoints before "if __name__ == '__main__':"
# Read the assistant routes code
with ASSISTANT_ROUTES_PATH.open('r', encoding='utf-8') as f:
    routes_content = f.read()

# Extract just the setup function call code (simplified inline version)
assistant_endpoints = '''

# ============================================================================
# ASSISTANT API ENDPOINTS
# ============================================================================

@app.get("/api/assistant/dashboard")
def assistant_dashboard() -> Response:
    admin = require_assistant()
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        total = conn.execute("SELECT COUNT(*) FROM deals WHERE assistant_id = ?", (admin["id"],)).fetchone()[0]
        draft = conn.execute("SELECT COUNT(*) FROM deals WHERE assistant_id = ? AND status = 'draft'", (admin["id"],)).fetchone()[0]
        pending = conn.execute("SELECT COUNT(*) FROM deals WHERE assistant_id = ? AND status = 'pending_approval'", (admin["id"],)).fetchone()[0]
        revision = conn.execute("SELECT COUNT(*) FROM deals WHERE assistant_id = ? AND status = 'revision_requested'", (admin["id"],)).fetchone()[0]
        approved = conn.execute("SELECT COUNT(*) FROM deals WHERE assistant_id = ? AND status IN ('approved','finalized')", (admin["id"],)).fetchone()[0]
        rejected = conn.execute("SELECT COUNT(*) FROM deals WHERE assistant_id = ? AND status = 'rejected'", (admin["id"],)).fetchone()[0]
        return jsonify({"dashboard": {"totalDeals": total, "draftDeals": draft, "pendingApproval": pending, "revisionRequested": revision, "approvedDeals": approved, "rejectedDeals": rejected}})


@app.get("/api/assistant/deals")
def assistant_list_deals() -> Response:
    admin = require_assistant()
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        rows = conn.execute("SELECT * FROM deals WHERE assistant_id = ? ORDER BY created_at DESC", (admin["id"],)).fetchall()
        return jsonify({"deals": [deal_payload(conn, row) for row in rows]})


@app.post("/api/assistant/deals")
def assistant_create_deal() -> Response:
    admin = require_assistant()
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    if not payload.get("client_name") or not payload.get("client_phone"):
        return jsonify({"error": "validation", "message": "اسم العميل ورقم الهاتف مطلوبان."}), 400
    with db() as conn:
        deal_id = public_id("deal")
        conn.execute("INSERT INTO deals (id, deal_number, assistant_id, client_name, client_phone, client_id, apartment_id, proposed_total, down_payment, payment_plan, notes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)", (deal_id, None, admin["id"], payload.get("client_name"), payload.get("client_phone"), payload.get("client_id"), payload.get("apartment_id"), float(payload.get("proposed_total") or 0), float(payload.get("down_payment") or 0), payload.get("payment_plan"), payload.get("notes"), now_iso(), now_iso()))
        audit(conn, admin["id"], "create", "deal", deal_id, f"تم إنشاء صفقة: {payload.get('client_name')}")
        deal = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
        return jsonify({"deal": deal_payload(conn, deal)}), 201


@app.get("/api/assistant/deals/<deal_id>")
def assistant_get_deal(deal_id: str) -> Response:
    admin = require_assistant()
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        deal = conn.execute("SELECT * FROM deals WHERE id = ? AND assistant_id = ?", (deal_id, admin["id"])).fetchone()
        if not deal:
            audit(conn, admin["id"], "access_denied", "deal", deal_id, "محاولة الوصول")
            return jsonify({"error": "not_found", "message": "الصفقة غير موجودة."}), 404
        return jsonify({"deal": deal_payload(conn, deal)})


@app.patch("/api/assistant/deals/<deal_id>")
def assistant_update_deal(deal_id: str) -> Response:
    admin = require_assistant()
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    with db() as conn:
        deal = conn.execute("SELECT * FROM deals WHERE id = ? AND assistant_id = ?", (deal_id, admin["id"])).fetchone()
        if not deal:
            return jsonify({"error": "not_found", "message": "الصفقة غير موجودة."}), 404
        if deal["status"] not in ("draft", "revision_requested"):
            audit(conn, admin["id"], "access_denied", "deal", deal_id, f"حالة {deal['status']}")
            return jsonify({"error": "forbidden", "message": "ليس لديك صلاحية لتعديل هذه الصفقة."}), 403
        
        updates, params = [], []
        for k in ["client_name", "client_phone", "apartment_id", "payment_plan", "notes"]:
            if k in payload:
                updates.append(f"{k} = ?")
                params.append(payload[k])
        for k in ["proposed_total", "down_payment"]:
            if k in payload:
                updates.append(f"{k} = ?")
                params.append(float(payload[k] or 0))
        
        if updates:
            updates.append("updated_at = ?")
            params.extend([now_iso(), deal_id])
            conn.execute(f"UPDATE deals SET {', '.join(updates)} WHERE id = ?", params)
            audit(conn, admin["id"], "update", "deal", deal_id, "تم التحديث")
        
        deal = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
        return jsonify({"deal": deal_payload(conn, deal)})


@app.post("/api/assistant/deals/<deal_id>/submit")
def assistant_submit_deal(deal_id: str) -> Response:
    admin = require_assistant()
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        deal = conn.execute("SELECT * FROM deals WHERE id = ? AND assistant_id = ?", (deal_id, admin["id"])).fetchone()
        if not deal:
            return jsonify({"error": "not_found", "message": "الصفقة غير موجودة."}), 404
        if deal["status"] != "draft":
            audit(conn, admin["id"], "access_denied", "deal", deal_id, f"حالة {deal['status']}")
            return jsonify({"error": "forbidden", "message": "يمكن إرسال الصفقات في حالة مسودة فقط."}), 403
        
        deal_number = deal["deal_number"]
        if not deal_number:
            while True:
                candidate = f"DEAL-{secrets.token_hex(4).upper()}"
                if not conn.execute("SELECT id FROM deals WHERE deal_number = ?", (candidate,)).fetchone():
                    deal_number = candidate
                    break
        
        conn.execute("UPDATE deals SET status = 'pending_approval', submitted_at = ?, deal_number = ?, updated_at = ? WHERE id = ?", (now_iso(), deal_number, now_iso(), deal_id))
        audit(conn, admin["id"], "submit", "deal", deal_id, f"تم الإرسال: {deal['client_name']}")
        deal = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
        return jsonify({"deal": deal_payload(conn, deal)})


@app.get("/api/assistant/revision-requests")
def assistant_revision_requests() -> Response:
    admin = require_assistant()
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        rows = conn.execute("SELECT * FROM deals WHERE assistant_id = ? AND status = 'revision_requested' ORDER BY updated_at DESC", (admin["id"],)).fetchall()
        return jsonify({"deals": [deal_payload(conn, row) for row in rows]})


@app.get("/api/assistant/available-apartments")
def assistant_available_apartments() -> Response:
    admin = require_assistant()
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        rows = conn.execute("SELECT * FROM apartments WHERE status = 'available' ORDER BY floor_number, apartment_type").fetchall()
        return jsonify({"apartments": [apartment_payload(row) for row in rows]})


@app.get("/api/assistant/profile")
def assistant_get_profile() -> Response:
    admin = require_assistant()
    if not isinstance(admin, dict):
        return admin
    return jsonify({"profile": {"id": admin["id"], "fullName": admin["full_name"], "email": admin["email"], "phone": admin.get("phone"), "role": admin["role"], "createdAt": admin["created_at"], "lastLoginAt": admin.get("last_login_at")}})


@app.patch("/api/assistant/profile")
def assistant_update_profile() -> Response:
    admin = require_assistant()
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    with db() as conn:
        updates, params = [], []
        if "full_name" in payload:
            updates.append("full_name = ?")
            params.append(payload["full_name"])
        if "phone" in payload:
            updates.append("phone = ?")
            params.append(payload["phone"])
        if updates:
            updates.append("updated_at = ?")
            params.extend([now_iso(), admin["id"]])
            conn.execute(f"UPDATE admins SET {', '.join(updates)} WHERE id = ?", params)
            audit(conn, admin["id"], "update", "profile", admin["id"], "تحديث الملف الشخصي")
        adm = conn.execute("SELECT * FROM admins WHERE id = ?", (admin["id"],)).fetchone()
        return jsonify({"profile": {"id": adm["id"], "fullName": adm["full_name"], "email": adm["email"], "phone": adm.get("phone"), "role": adm["role"], "createdAt": adm["created_at"], "lastLoginAt": adm.get("last_login_at")}})


@app.post("/api/assistant/change-password")
def assistant_change_password() -> Response:
    admin = require_assistant()
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    old_pwd = payload.get("old_password") or ""
    new_pwd = payload.get("new_password") or ""
    if not new_pwd or len(new_pwd) < 8:
        return jsonify({"error": "validation", "message": "كلمة المرور يجب أن تكون 8 أحرف."}), 400
    with db() as conn:
        adm = conn.execute("SELECT * FROM admins WHERE id = ?", (admin["id"],)).fetchone()
        if not verify_password(old_pwd, adm["password_hash"], adm["password_salt"]):
            audit(conn, admin["id"], "password_change_failed", "admin", admin["id"], "كلمة مرور خاطئة")
            return jsonify({"error": "invalid_password", "message": "كلمة المرور القديمة غير صحيحة."}), 401
        new_hash, new_salt = hash_password(new_pwd)
        conn.execute("UPDATE admins SET password_hash = ?, password_salt = ?, must_change_password = FALSE, updated_at = ? WHERE id = ?", (new_hash, new_salt, now_iso(), admin["id"]))
        audit(conn, admin["id"], "password_changed", "admin", admin["id"], "تم تغيير كلمة المرور")
        return jsonify({"ok": True, "message": "تم تغيير كلمة المرور بنجاح."})

'''

# Find the insertion point (before "if __name__")
main_match = re.search(r'\nif __name__ == "__main__":', content)
if main_match:
    insert_pos = main_match.start()
    content = content[:insert_pos] + assistant_endpoints + content[insert_pos:]
    print("✓ Added assistant endpoints")
else:
    print("✗ Could not find main guard")

# 3. Add admin assistant management endpoints
admin_asst_endpoints = '''

# ============================================================================
# ADMIN ENDPOINTS FOR ASSISTANT MANAGEMENT
# ============================================================================

@app.get("/api/admin/assistants")
def list_assistants() -> Response:
    """List all assistants."""
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    with db() as conn:
        rows = conn.execute("SELECT id, full_name, email, phone, is_active, must_change_password, created_at, last_login_at FROM admins WHERE role = 'assistant' ORDER BY created_at DESC").fetchall()
        return jsonify({"assistants": [dict(row) for row in rows]})


@app.post("/api/admin/assistants")
def create_assistant() -> Response:
    """Create a new assistant."""
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    if not payload.get("full_name") or not payload.get("email"):
        return jsonify({"error": "validation", "message": "الاسم والبريد مطلوبان."}), 400
    
    with db() as conn:
        # Generate temp password
        temp_password = secrets.token_urlsafe(12)
        password_hash, password_salt = hash_password(temp_password)
        
        asst_id = public_id("asst")
        conn.execute(
            "INSERT INTO admins (id, full_name, email, phone, role, password_hash, password_salt, is_active, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, 'assistant', ?, ?, TRUE, TRUE, ?, ?)",
            (asst_id, payload.get("full_name"), payload.get("email").lower(), payload.get("phone"), password_hash, password_salt, now_iso(), now_iso())
        )
        audit(conn, admin["id"], "create", "assistant", asst_id, f"تم إنشاء مساعد جديد: {payload.get('full_name')}")
        return jsonify({"id": asst_id, "temporaryPassword": temp_password, "message": "تم إنشاء المساعد الجديد"}), 201


@app.patch("/api/admin/assistants/<asst_id>")
def update_assistant(asst_id: str) -> Response:
    """Update assistant details."""
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    payload = request.get_json(silent=True) or {}
    
    with db() as conn:
        asst = conn.execute("SELECT * FROM admins WHERE id = ? AND role = 'assistant'", (asst_id,)).fetchone()
        if not asst:
            return jsonify({"error": "not_found", "message": "المساعد غير موجود."}), 404
        
        updates, params = [], []
        if "full_name" in payload:
            updates.append("full_name = ?")
            params.append(payload["full_name"])
        if "phone" in payload:
            updates.append("phone = ?")
            params.append(payload["phone"])
        
        if updates:
            updates.append("updated_at = ?")
            params.extend([now_iso(), asst_id])
            conn.execute(f"UPDATE admins SET {', '.join(updates)} WHERE id = ?", params)
            audit(conn, admin["id"], "update", "assistant", asst_id, "تم التحديث")
        
        return jsonify({"ok": True})


@app.post("/api/admin/assistants/<asst_id>/disable")
def disable_assistant(asst_id: str) -> Response:
    """Disable an assistant account."""
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    
    with db() as conn:
        asst = conn.execute("SELECT * FROM admins WHERE id = ? AND role = 'assistant'", (asst_id,)).fetchone()
        if not asst:
            return jsonify({"error": "not_found", "message": "المساعد غير موجود."}), 404
        
        conn.execute("UPDATE admins SET is_active = FALSE, updated_at = ? WHERE id = ?", (now_iso(), asst_id))
        audit(conn, admin["id"], "disable", "assistant", asst_id, f"تم تعطيل المساعد: {asst['full_name']}")
        return jsonify({"ok": True})


@app.post("/api/admin/assistants/<asst_id>/enable")
def enable_assistant(asst_id: str) -> Response:
    """Enable an assistant account."""
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    
    with db() as conn:
        asst = conn.execute("SELECT * FROM admins WHERE id = ? AND role = 'assistant'", (asst_id,)).fetchone()
        if not asst:
            return jsonify({"error": "not_found", "message": "المساعد غير موجود."}), 404
        
        conn.execute("UPDATE admins SET is_active = TRUE, updated_at = ? WHERE id = ?", (now_iso(), asst_id))
        audit(conn, admin["id"], "enable", "assistant", asst_id, f"تم تفعيل المساعد: {asst['full_name']}")
        return jsonify({"ok": True})


@app.post("/api/admin/assistants/<asst_id>/reset-password")
def reset_assistant_password(asst_id: str) -> Response:
    """Reset assistant password to temporary one."""
    admin = require_admin({"owner", "admin"})
    if not isinstance(admin, dict):
        return admin
    
    with db() as conn:
        asst = conn.execute("SELECT * FROM admins WHERE id = ? AND role = 'assistant'", (asst_id,)).fetchone()
        if not asst:
            return jsonify({"error": "not_found", "message": "المساعد غير موجود."}), 404
        
        temp_password = secrets.token_urlsafe(12)
        password_hash, password_salt = hash_password(temp_password)
        conn.execute("UPDATE admins SET password_hash = ?, password_salt = ?, must_change_password = TRUE, updated_at = ? WHERE id = ?", (password_hash, password_salt, now_iso(), asst_id))
        audit(conn, admin["id"], "password_reset", "assistant", asst_id, f"تم إعادة تعيين كلمة المرور للمساعد: {asst['full_name']}")
        return jsonify({"temporaryPassword": temp_password, "message": "تم إعادة تعيين كلمة المرور"})

'''

# Insert before main guard
main_match = re.search(r'\nif __name__ == "__main__":', content)
if main_match:
    insert_pos = main_match.start()
    content = content[:insert_pos] + admin_asst_endpoints + content[insert_pos:]
    print("✓ Added admin assistant management endpoints")

# Write back to app/main.py
with MAIN_PATH.open('w', encoding='utf-8') as f:
    f.write(content)

print("\n✓ Successfully integrated all assistant endpoints into app/main.py")
