"""Safe production owner bootstrap using environment variables.

This module provides a secure way to initialize an owner account during app startup
using environment variables. It is designed for Render deployment where shell access
is not available to run reset_owner_password.py manually.

Environment variables:
  BOOTSTRAP_OWNER: Set to 'true' to enable bootstrap (case-insensitive)
  OWNER_EMAIL: Email of the owner account (required if BOOTSTRAP_OWNER=true)
  OWNER_PASSWORD: Password for the owner account (required if BOOTSTRAP_OWNER=true)
  OWNER_NAME: Full name of the owner (optional, defaults to "مالك النظام")

Behavior:
  - If BOOTSTRAP_OWNER is not 'true', bootstrap is skipped silently
  - If OWNER_EMAIL or OWNER_PASSWORD is missing, logs a safe warning and skips
  - If owner exists, updates email, name, password, and sets role to 'owner'
  - If owner doesn't exist, creates new owner account
  - Password is never logged or printed
  - Only logs: "Owner bootstrap completed"

Important:
  - Password must never be committed to GitHub
  - Password must never be printed in logs
  - Existing owner/admin login continues working
"""
from __future__ import annotations

import os
import logging
from db_utils import db, fetchone, execute, hash_password, now_iso, public_id

logger = logging.getLogger(__name__)


def bootstrap_owner_account() -> None:
    """Bootstrap owner account from environment variables during app startup."""
    bootstrap_enabled = os.environ.get("BOOTSTRAP_OWNER", "").strip().lower() == "true"
    if not bootstrap_enabled:
        return

    owner_email = os.environ.get("OWNER_EMAIL", "").strip()
    owner_password = os.environ.get("OWNER_PASSWORD", "").strip()
    owner_name = os.environ.get("OWNER_NAME", "").strip() or "مالك النظام"

    if not owner_email or not owner_password:
        logger.warning("BOOTSTRAP_OWNER=true but OWNER_EMAIL or OWNER_PASSWORD is missing. Skipping bootstrap.")
        return

    try:
        with db() as conn:
            password_hash, salt = hash_password(owner_password)
            existing = fetchone(conn, "SELECT id FROM admins WHERE lower(email) = lower(%s)", (owner_email,))

            if existing:
                execute(
                    conn,
                    """
                    UPDATE admins
                    SET full_name = %s, role = 'owner', password_hash = %s, password_salt = %s,
                        is_active = TRUE, updated_at = %s
                    WHERE id = %s
                    """,
                    (owner_name, password_hash, salt, now_iso(), existing["id"]),
                )
            else:
                execute(
                    conn,
                    """
                    INSERT INTO admins (
                      id, full_name, email, role, password_hash, password_salt, is_active, created_at, updated_at
                    ) VALUES (%s, %s, %s, 'owner', %s, %s, TRUE, %s, %s)
                    """,
                    (public_id("admin"), owner_name, owner_email, password_hash, salt, now_iso(), now_iso()),
                )
        logger.info("Owner bootstrap completed")
    except Exception as e:
        logger.error(f"Owner bootstrap failed: {str(e)}")
        raise
