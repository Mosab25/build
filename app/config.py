"""Shared filesystem paths for the application."""
from __future__ import annotations

from pathlib import Path


APP_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = APP_DIR.parent
STATIC_DIR = APP_DIR / "static"
TEMPLATES_DIR = APP_DIR / "templates"
MIGRATIONS_DIR = PROJECT_ROOT / "migrations"
MEDIA_DIR = PROJECT_ROOT / "media"
GENERATED_DIR = PROJECT_ROOT / "generated"
