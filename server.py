"""Compatibility entry point.

The application now lives in app.main. This shim keeps older local and
deployment commands working while the project uses the package layout.
"""
from __future__ import annotations

import os

from app.main import app, bootstrap_runtime


if __name__ == "__main__":
    bootstrap_runtime()
    port = int(os.environ.get("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=False)
