-- PostgreSQL production schema for the stabilized reservation workflow.
-- Runtime keeps the existing workflow: available -> pending_approval -> reserved -> sold.

CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('owner','admin','accountant','viewer','assistant')),
  phone TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TEXT,
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
  price DOUBLE PRECISION NOT NULL DEFAULT 0,
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
  total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  paid_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  remaining_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL CHECK(payment_status IN ('pending','partially_paid','fully_paid','overdue')),
  office_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_active_apartment
  ON clients(apartment_id)
  WHERE apartment_id IS NOT NULL AND reservation_status != 'cancelled';

CREATE INDEX IF NOT EXISTS idx_clients_portfolio_code ON clients(portfolio_code);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  apartment_id TEXT REFERENCES apartments(id),
  amount DOUBLE PRECISION NOT NULL CHECK(amount > 0),
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

CREATE INDEX IF NOT EXISTS idx_payments_client_status ON payments(client_id, payment_status);

CREATE TABLE IF NOT EXISTS installments (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  apartment_id TEXT REFERENCES apartments(id),
  installment_number INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL CHECK(amount >= 0),
  paid_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  remaining_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('upcoming','due','paid','partially_paid','overdue','cancelled')),
  payment_id TEXT REFERENCES payments(id),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_installments_client_status ON installments(client_id, status);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON installments(due_date);

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

CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  deal_number TEXT UNIQUE,
  assistant_id TEXT NOT NULL REFERENCES admins(id),
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_id TEXT REFERENCES clients(id),
  apartment_id TEXT REFERENCES apartments(id),
  proposed_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  down_payment DOUBLE PRECISION NOT NULL DEFAULT 0,
  payment_plan TEXT,
  notes TEXT,
  status TEXT NOT NULL CHECK(status IN ('draft','pending_approval','revision_requested','approved','rejected','finalized','cancelled')),
  owner_notes TEXT,
  approved_by TEXT REFERENCES admins(id),
  approved_at TEXT,
  submitted_at TEXT,
  finalized_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deals_assistant_id ON deals(assistant_id);
CREATE INDEX IF NOT EXISTS idx_deals_client_id ON deals(client_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deals_deal_number ON deals(deal_number) WHERE deal_number IS NOT NULL;

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_contract_number ON contracts(contract_number) WHERE contract_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS project_updates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  update_date TEXT NOT NULL,
  stage TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK(media_type IN ('image','video')),
  media_url TEXT,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
  display_order INTEGER DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES admins(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_updates_status ON project_updates(status);

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

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
