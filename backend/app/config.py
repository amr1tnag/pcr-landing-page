"""Runtime configuration, overridable with environment variables."""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Where indexed event photos live. Subfolders become event names:
#   photos/Horizon 2026/IMG_0001.jpg  ->  event "Horizon 2026"
PHOTOS_DIR = Path(os.getenv("PCR_PHOTOS_DIR", BASE_DIR / "photos")).resolve()

# Built frontend (npm run build). When present, the API serves the site too,
# so a single process is a complete self-hosted deployment.
FRONTEND_DIST = Path(os.getenv("PCR_FRONTEND_DIST", BASE_DIR.parent / "frontend" / "dist")).resolve()

# SQLite file holding photo metadata and face embeddings.
DB_PATH = Path(os.getenv("PCR_DB_PATH", BASE_DIR / "pcr.db")).resolve()

# Default face-distance threshold. Lower = stricter.
DEFAULT_TOLERANCE = float(os.getenv("PCR_TOLERANCE", "0.5"))

# "hog" is CPU-friendly; "cnn" is far more accurate but needs a GPU to be quick.
DETECTION_MODEL = os.getenv("PCR_DETECTION_MODEL", "hog")

# How many times to upsample when detecting. 2 finds smaller faces in crowd
# shots but costs roughly 3-4x the CPU time of 1.
UPSAMPLE = int(os.getenv("PCR_UPSAMPLE", "1"))

# Images are downscaled to this longest edge before detection, for speed.
MAX_EDGE = int(os.getenv("PCR_MAX_EDGE", "2400"))

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "PCR_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if o.strip()
]

# Shared secret for the admin upload/reindex endpoints. Unset = admin API disabled.
ADMIN_TOKEN = os.getenv("PCR_ADMIN_TOKEN", "").strip()

# Per-file cap for admin uploads (full-resolution JPEGs from a DSLR fit comfortably).
MAX_ADMIN_UPLOAD_BYTES = int(os.getenv("PCR_MAX_ADMIN_UPLOAD_MB", "40")) * 1024 * 1024
