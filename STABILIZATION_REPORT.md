# Stabilization Report

## Backup
- Created backup commit: `4c1d0df backup-current-recovery-state`
- Created stabilization commit: `15ada4a stabilize backend frontend workflow`

## Backend fixes
- Kept SQLite as the active stabilization database.
- Documented PostgreSQL files as future migration assets, not active production database.
- Added `reset_owner_password.py` for safe local owner credential recovery.
- Added real apartment statuses:
  - `pending_approval`
  - `frozen`
- Added SQLite migration helper for old `apartments` CHECK constraints.
- Fixed assistant submission workflow:
  - `available → pending_approval`
- Preserved owner approval workflow:
  - approval changes unit to `reserved`
  - final contract/finalize changes unit to `sold`
- Updated owner alerts and dashboard logic to use `pending_approval` instead of misusing `pending_payment`.
- Hardened project update upload endpoint:
  - allowed extensions: jpg, jpeg, png, webp, mp4, webm
  - size limit
  - safe filenames
  - owner/admin only

## Frontend fixes
- Added Admin navigation item: `📄 العقود`.
- Added Admin contracts panel connected to existing contract endpoints.
- Improved assistant dashboard by adding a step-by-step deal wizard:
  1. بيانات العميل
  2. اختيار الشقة
  3. السعر والدفع
  4. مراجعة الديل
  5. إرسال للموافقة
- Assistant sees available apartments only for new deals.
- Added draft/final contract actions through the centralized contract API.
- API helper now understands both older responses and standardized `{ success, data, error }` responses.
- Added status labels for `Pending Approval` and `Frozen`.

## File cleanup
- Archived duplicate root media files into:
  - `archive/old-version/media-duplicates/`
- Main media paths remain clean:
  - `media/facade.jpg`
  - `media/apartment-1.jpg`
  - `media/apartment-2.jpg`
  - `media/apartment-3.jpg`
  - `media/project-video.mp4`
- Updated `.gitignore` for runtime/generated files.

## Tests performed
- `python -m py_compile server.py reset_owner_password.py`
- `node --check static/js/*.js`
- Login with owner account after reset script.
- Admin bootstrap loads successfully.
- Fresh `init_db()` runs and migrates `apartments` status constraint.
- Assistant test flow verified:
  - create deal
  - submit deal sets apartment to `pending_approval`
  - owner approval changes apartment to `reserved`
  - final contract changes apartment to `sold`
- Public updates endpoint still responds.

## Remaining issues / future production upgrade
- PostgreSQL is not yet active. SQLite remains the stabilization database.
- Some old API endpoints still return legacy response formats; frontend now tolerates both formats.
- Full production deployment still needs PostgreSQL migration, backup process, and environment hardening.
