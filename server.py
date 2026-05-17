"""Compatibility entry point.

The application now lives in app.main. This shim keeps older local and
deployment commands working while the project uses the package layout.
"""
from __future__ import annotations

from app.main import app, bootstrap_runtime


if __name__ == "__main__":
    bootstrap_runtime()
    app.run(host="127.0.0.1", port=8000, debug=False)
