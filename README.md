# Real Estate Reservation Platform

A Flask and PostgreSQL application for managing a real estate reservation workflow. It includes public project pages, admin and owner dashboards, assistant deal workflows, clients, apartments, payments, contracts, receipts, reports, audit logs, media assets, and upload handling.

## Requirements

- Python 3.11+
- PostgreSQL 14+
- Docker Desktop, optional for local PostgreSQL

## Installation

1. Create and activate a virtual environment.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

2. Install dependencies.

```powershell
python -m pip install -r requirements.txt
```

3. Create a local environment file.

```powershell
Copy-Item .env.example .env
```

4. Edit `.env` with real local values. Do not commit `.env`.

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string. Required.
- `SECRET_KEY`: Flask session secret. Required in production.
- `APP_ENV`: `development` or `production`.
- `UPLOAD_FOLDER`: Runtime upload directory. Defaults to `uploads`.
- `BOOTSTRAP_OWNER`: Set to `true` only when bootstrapping an owner from environment variables.
- `OWNER_EMAIL`: Owner email used when `BOOTSTRAP_OWNER=true`.
- `OWNER_PASSWORD`: Owner password used when `BOOTSTRAP_OWNER=true`.
- `OWNER_NAME`: Optional owner display name used when bootstrapping.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: Optional production media storage for project update uploads. When omitted, uploads are stored locally for development.

## Run Locally

Start PostgreSQL with Docker:

```powershell
docker compose up -d postgres
```

Run the app:

```powershell
python -m app.main
```

Open:

```text
http://127.0.0.1:8000
```

The app initializes required tables and default seed data during startup.

## Run With Gunicorn

```powershell
gunicorn -c gunicorn.conf.py app.main:app
```

For hosted deployments, run the production preparation script before Gunicorn:

```powershell
python scripts/prepare_production.py
gunicorn -c gunicorn.conf.py app.main:app
```

## Docker

This repository currently uses Docker Compose for the PostgreSQL service:

```powershell
docker compose up -d postgres
docker compose config
```

## Useful Scripts

- `python scripts/prepare_production.py`: creates runtime directories, initializes the database, and checks required media.
- `python scripts/seed_postgresql.py`: idempotently seeds default owner/settings/apartments.
- `python scripts/change_admin_credentials.py`: interactively changes an admin or owner login.
- `python scripts/reset_owner_password.py`: local development recovery for the default owner account.

## Project Structure

```text
project-root/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── templates/
│   └── static/
├── scripts/
├── migrations/
├── uploads/
├── media/
├── memory/
├── legacy-frontend/
├── specs/
├── requirements.txt
├── docker-compose.yml
├── gunicorn.conf.py
├── .env.example
├── .gitignore
└── README.md
```

Runtime folders such as `uploads/`, `generated/`, `media/`, and `memory/` are kept out of new commits by `.gitignore`. Keep production media and uploaded files managed through your deployment/storage process.

## Notes

- The Flask entry point is `app.main:app`.
- Migrations remain in the root `migrations/` folder.
- Frontend static assets live in `app/static/`.
- The SPA HTML shell is served from `app/templates/index.html`.
