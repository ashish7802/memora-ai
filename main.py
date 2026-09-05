"""Memora Canonical Backend Root Forwarder.

The canonical production backend is located in `backend/app/main.py`.
To start the canonical backend:
    cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000
"""

import sys
from pathlib import Path

# Add backend directory to sys.path so app.main can be resolved if executed from root
backend_dir = Path(__file__).resolve().parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app  # noqa: E402

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
