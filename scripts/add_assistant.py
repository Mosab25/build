#!/usr/bin/env python3
"""
Helper script to add assistant endpoints to app/main.py.
"""

import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

MAIN_PATH = ROOT_DIR / "app" / "main.py"


# Read the main server file
with MAIN_PATH.open('r', encoding='utf-8') as f:
    lines = f.readlines()

# Find where to insert the require_assistant function (after require_admin)
insert_pos = None
for i, line in enumerate(lines):
    if 'def admin_public_payload' in line:
        insert_pos = i
        break

if insert_pos is None:
    print("ERROR: Could not find insertion point for require_assistant")
    exit(1)

# Create require_assistant function
require_assistant_code = '''

def require_assistant() -> dict[str, Any] | Response:
    """Require authenticated assistant role."""
    admin = current_admin()
    if not admin:
        return jsonify({"error": "unauthorized", "message": "يجب تسجيل الدخول أولًا."}), 401
    if admin["role"] != "assistant":
        with db() as conn:
            audit(conn, admin["id"], "access_denied", "admin", admin["id"], f"محاولة وصول من role {admin['role']} في assistant")
        return jsonify({"error": "forbidden", "message": "ليس لديك صلاحية لتنفيذ هذه العملية."}), 403
    return admin

'''

# Insert the function
lines.insert(insert_pos, require_assistant_code)

# Write back
with MAIN_PATH.open('w', encoding='utf-8') as f:
    f.writelines(lines)

print("Added require_assistant function to app/main.py")
