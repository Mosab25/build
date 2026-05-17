from __future__ import annotations

import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.main import bootstrap_runtime, missing_required_media_files  # noqa: E402


def main() -> int:
    bootstrap_runtime()
    missing_files = missing_required_media_files()
    if missing_files:
        print("Missing required production media files:")
        for path in missing_files:
            print(f"- {path}")
        return 1
    print("Production setup complete.")
    print("Database tables are ready and default seed data is ensured.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
