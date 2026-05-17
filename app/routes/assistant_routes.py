"""
Assistant API endpoints for real estate system.
This module contains all /api/assistant/* endpoints.
"""

from flask import Response, jsonify
from typing import Any
from app.utils.db_utils import db


def setup_assistant_routes(app, require_admin, current_admin, audit, deal_payload, apartment_payload, 
                          hash_password, verify_password, public_id, now_iso, require_assistant_impl):
    """Register all assistant endpoints with the Flask app."""
    
    @app.get("/api/assistant/dashboard")
    def assistant_dashboard() -> Response:
        admin = require_assistant_impl()
        if not isinstance(admin, dict):
            return admin
        
        with db() as conn:
            total_deals = conn.execute("SELECT COUNT(*) FROM deals WHERE assistant_id = ?", (admin["id"],)).fetchone()[0]
            draft_deals = conn.execute("SELECT COUNT(*) FROM deals WHERE assistant_id = ? AND status = 'draft'", (admin["id"],)).fetchone()[0]
            pending = conn.execute("SELECT COUNT(*) FROM deals WHERE assistant_id = ? AND status = 'pending_approval'", (admin["id"],)).fetchone()[0]
            revision = conn.execute("SELECT COUNT(*) FROM deals WHERE assistant_id = ? AND status = 'revision_requested'", (admin["id"],)).fetchone()[0]
            approved = conn.execute("SELECT COUNT(*) FROM deals WHERE assistant_id = ? AND status IN ('approved','finalized')", (admin["id"],)).fetchone()[0]
            rejected = conn.execute("SELECT COUNT(*) FROM deals WHERE assistant_id = ? AND status = 'rejected'", (admin["id"],)).fetchone()[0]
            
            return jsonify({
                "dashboard": {
                    "totalDeals": total_deals, "draftDeals": draft_deals, "pendingApproval": pending,
                    "revisionRequested": revision, "approvedDeals": approved, "rejectedDeals": rejected,
                }
            })
    
    @app.get("/api/assistant/deals")
    def assistant_list_deals() -> Response:
        admin = require_assistant_impl()
        if not isinstance(admin, dict):
            return admin
        
        with db() as conn:
            deal_rows = conn.execute("SELECT * FROM deals WHERE assistant_id = ? ORDER BY created_at DESC", (admin["id"],)).fetchall()
            deals = [deal_payload(conn, row) for row in deal_rows]
            return jsonify({"deals": deals})
    
    @app.post("/api/assistant/deals")
    def assistant_create_deal() -> Response:
        admin = require_assistant_impl()
        if not isinstance(admin, dict):
            return admin
        
        from flask import request
        payload = request.get_json(silent=True) or {}
        
        if not payload.get("client_name"):
            return jsonify({"error": "validation", "message": "اسم العميل مطلوب."}), 400
        if not payload.get("client_phone"):
            return jsonify({"error": "validation", "message": "رقم الهاتف مطلوب."}), 400
        
        with db() as conn:
            deal_id = public_id("deal")
            conn.execute(
                "INSERT INTO deals (id,deal_number,assistant_id,client_name,client_phone,client_id,apartment_id,proposed_total,down_payment,payment_plan,notes,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'draft',?,?)",
                (deal_id, None, admin["id"], payload.get("client_name"), payload.get("client_phone"), payload.get("client_id"), payload.get("apartment_id"), float(payload.get("proposed_total") or 0), float(payload.get("down_payment") or 0), payload.get("payment_plan"), payload.get("notes"), now_iso(), now_iso()),
            )
            audit(conn, admin["id"], "create", "deal", deal_id, f"تم إنشاء صفقة جديدة: {payload.get('client_name')}")
            deal = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
            return jsonify({"deal": deal_payload(conn, deal)}), 201
    
    @app.get("/api/assistant/deals/<deal_id>")
    def assistant_get_deal(deal_id: str) -> Response:
        admin = require_assistant_impl()
        if not isinstance(admin, dict):
            return admin
        
        with db() as conn:
            deal = conn.execute("SELECT * FROM deals WHERE id = ? AND assistant_id = ?", (deal_id, admin["id"])).fetchone()
            if not deal:
                audit(conn, admin["id"], "access_denied", "deal", deal_id, "محاولة الوصول الى صفقة ليست ملكها")
                return jsonify({"error": "not_found", "message": "الصفقة غير موجودة."}), 404
            return jsonify({"deal": deal_payload(conn, deal)})
    
    @app.patch("/api/assistant/deals/<deal_id>")
    def assistant_update_deal(deal_id: str) -> Response:
        admin = require_assistant_impl()
        if not isinstance(admin, dict):
            return admin
        
        from flask import request
        payload = request.get_json(silent=True) or {}
        
        with db() as conn:
            deal = conn.execute("SELECT * FROM deals WHERE id = ? AND assistant_id = ?", (deal_id, admin["id"])).fetchone()
            if not deal:
                audit(conn, admin["id"], "access_denied", "deal", deal_id, "محاولة تحديث صفقة ليست ملكها")
                return jsonify({"error": "not_found", "message": "الصفقة غير موجودة."}), 404
            
            if deal["status"] not in ("draft", "revision_requested"):
                audit(conn, admin["id"], "access_denied", "deal", deal_id, f"محاولة تحديث صفقة بحالة {deal['status']}")
                return jsonify({"error": "forbidden", "message": "ليس لديك صلاحية لتعديل هذه الصفقة."}), 403
            
            updates, params = [], []
            for key in ["client_name", "client_phone", "apartment_id", "payment_plan", "notes"]:
                if key in payload:
                    updates.append(f"{key} = ?")
                    params.append(payload[key])
            for key in ["proposed_total", "down_payment"]:
                if key in payload:
                    updates.append(f"{key} = ?")
                    params.append(float(payload[key] or 0))
            
            if updates:
                updates.append("updated_at = ?")
                params.extend([now_iso(), deal_id])
                conn.execute(f"UPDATE deals SET {', '.join(updates)} WHERE id = ?", params)
                audit(conn, admin["id"], "update", "deal", deal_id, "تم تحديث الصفقة")
            
            updated = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
            return jsonify({"deal": deal_payload(conn, updated)})
    
    @app.post("/api/assistant/deals/<deal_id>/submit")
    def assistant_submit_deal(deal_id: str) -> Response:
        admin = require_assistant_impl()
        if not isinstance(admin, dict):
            return admin
        
        import secrets
        with db() as conn:
            deal = conn.execute("SELECT * FROM deals WHERE id = ? AND assistant_id = ?", (deal_id, admin["id"])).fetchone()
            if not deal:
                audit(conn, admin["id"], "access_denied", "deal", deal_id, "محاولة ارسال صفقة ليست ملكها")
                return jsonify({"error": "not_found", "message": "الصفقة غير موجودة."}), 404
            
            if deal["status"] != "draft":
                audit(conn, admin["id"], "access_denied", "deal", deal_id, f"محاولة ارسال صفقة بحالة {deal['status']}")
                return jsonify({"error": "forbidden", "message": "يمكن ارسال الصفقات في حالة مسودة فقط."}), 403
            
            deal_number = deal["deal_number"]
            if not deal_number:
                while True:
                    candidate = f"DEAL-{secrets.token_hex(4).upper()}"
                    if not conn.execute("SELECT id FROM deals WHERE deal_number = ?", (candidate,)).fetchone():
                        deal_number = candidate
                        break
            
            conn.execute("UPDATE deals SET status = 'pending_approval', submitted_at = ?, deal_number = ?, updated_at = ? WHERE id = ?", (now_iso(), deal_number, now_iso(), deal_id))
            audit(conn, admin["id"], "submit", "deal", deal_id, f"تم ارسال الصفقة للموافقة: {deal['client_name']}")
            updated = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
            return jsonify({"deal": deal_payload(conn, updated)})
    
    @app.get("/api/assistant/revision-requests")
    def assistant_revision_requests() -> Response:
        admin = require_assistant_impl()
        if not isinstance(admin, dict):
            return admin
        
        with db() as conn:
            deals = conn.execute("SELECT * FROM deals WHERE assistant_id = ? AND status = 'revision_requested' ORDER BY updated_at DESC", (admin["id"],)).fetchall()
            return jsonify({"deals": [deal_payload(conn, d) for d in deals]})
    
    @app.get("/api/assistant/available-apartments")
    def assistant_available_apartments() -> Response:
        admin = require_assistant_impl()
        if not isinstance(admin, dict):
            return admin
        
        with db() as conn:
            apts = conn.execute("SELECT * FROM apartments WHERE status = 'available' ORDER BY floor_number, apartment_type").fetchall()
            return jsonify({"apartments": [apartment_payload(row) for row in apts]})
    
    @app.get("/api/assistant/profile")
    def assistant_get_profile() -> Response:
        admin = require_assistant_impl()
        if not isinstance(admin, dict):
            return admin
        
        return jsonify({
            "profile": {
                "id": admin["id"], "fullName": admin["full_name"], "email": admin["email"],
                "phone": admin.get("phone"), "role": admin["role"], "createdAt": admin["created_at"],
                "lastLoginAt": admin.get("last_login_at"),
            }
        })
    
    @app.patch("/api/assistant/profile")
    def assistant_update_profile() -> Response:
        admin = require_assistant_impl()
        if not isinstance(admin, dict):
            return admin
        
        from flask import request
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
                audit(conn, admin["id"], "update", "profile", admin["id"], "تم تحديث الملف الشخصي")
            
            updated = conn.execute("SELECT * FROM admins WHERE id = ?", (admin["id"],)).fetchone()
            return jsonify({
                "profile": {
                    "id": updated["id"], "fullName": updated["full_name"], "email": updated["email"],
                    "phone": updated.get("phone"), "role": updated["role"], "createdAt": updated["created_at"],
                    "lastLoginAt": updated.get("last_login_at"),
                }
            })
    
    @app.post("/api/assistant/change-password")
    def assistant_change_password() -> Response:
        admin = require_assistant_impl()
        if not isinstance(admin, dict):
            return admin
        
        from flask import request
        payload = request.get_json(silent=True) or {}
        old_pwd = payload.get("old_password") or ""
        new_pwd = payload.get("new_password") or ""
        
        if not new_pwd or len(new_pwd) < 8:
            return jsonify({"error": "validation", "message": "كلمة المرور يجب ان تكون 8 احرف على الاقل."}), 400
        
        with db() as conn:
            adm = conn.execute("SELECT * FROM admins WHERE id = ?", (admin["id"],)).fetchone()
            if not verify_password(old_pwd, adm["password_hash"], adm["password_salt"]):
                audit(conn, admin["id"], "password_change_failed", "admin", admin["id"], "كلمة مرور قديمة خاطئة")
                return jsonify({"error": "invalid_password", "message": "كلمة المرور القديمة غير صحيحة."}), 401
            
            new_hash, new_salt = hash_password(new_pwd)
            conn.execute("UPDATE admins SET password_hash = ?, password_salt = ?, must_change_password = FALSE, updated_at = ? WHERE id = ?", (new_hash, new_salt, now_iso(), admin["id"]))
            audit(conn, admin["id"], "password_changed", "admin", admin["id"], "تم تغيير كلمة المرور")
            return jsonify({"ok": True, "message": "تم تغيير كلمة المرور بنجاح."})
