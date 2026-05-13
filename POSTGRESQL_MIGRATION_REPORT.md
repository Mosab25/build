# PostgreSQL Migration Report

## Summary

The backend has been switched from SQLite to PostgreSQL. `server.py` now requires `DATABASE_URL` and opens PostgreSQL connections through `psycopg2`. SQLite is no longer used as the runtime database.

## Changed

- Removed active SQLite connection usage from `server.py`.
- Added PostgreSQL connection adapter compatible with the existing `conn.execute(...).fetchone()` style.
- Added automatic SQLite-style `?` placeholder conversion to PostgreSQL `%s`.
- Kept existing backend logic and routes while changing the database backend.
- Added PostgreSQL-safe schema upgrade helpers for:
  - admin roles
  - apartment statuses
  - client portfolio codes
  - deal owner fields
- Moved old `reservation_system.sqlite3` to `archive/old-version/sqlite-backup/`.
- Updated README and `.env.example` for PostgreSQL setup.

## Runtime Requirements

Create a `.env` file with:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/real_estate
```

Then run:

```powershell
python -m pip install -r requirements.txt
python server.py
```

## Notes

A live PostgreSQL server is required to run the app. The code compiles successfully, but end-to-end database tests must be run in your local environment after creating the database.
