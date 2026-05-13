-- Migration: Assistant Hardening Schema
-- Adds must_change_password and last_login_at columns to admins table
-- Supports forced password change flow and login tracking for assistants

-- Add must_change_password column
ALTER TABLE admins ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- Add last_login_at column
ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_login_at TEXT;

-- Create index on last_login_at for query optimization
CREATE INDEX IF NOT EXISTS idx_admins_last_login_at ON admins(last_login_at DESC);

-- Add index on is_active for faster login checks
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON admins(is_active);

-- Ensure assistant role is properly constrained (safe re-application)
DO $$
BEGIN
  BEGIN
    ALTER TABLE admins ADD CONSTRAINT chk_admins_role CHECK(role IN ('owner','admin','accountant','viewer','assistant'));
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END
$$;
