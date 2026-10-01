"""Token-protected endpoints for getting photos onto a hosted server.

A hosted disk (e.g. Render) can't be written to directly, so photos are pushed
over HTTP — see `python -m app.upload` — and indexed in the background.
"""
from __future__ import annotations

import re
import secrets
import threading
import time
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Header, HTTPException, UploadFile

from .config import ADMIN_TOKEN, IMAGE_SUFFIXES, MAX_ADMIN_UPLOAD_BYTES, PHOTOS_DIR
from .indexer import index_folder

router = APIRouter(prefix="/api/admin", tags=["admin"])

_lock = threading.Lock()
_status: dict = {"state": "idle", "started_at": None, "finished_at": None, "stats": None, "error": None}


def require_token(authorization: str = Header(default="")) -> None:
    if not ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Admin API is disabled (PCR_ADMIN_TOKEN is not set).")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not secrets.compare_digest(token.strip(), ADMIN_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid admin token.")


def safe_folder(event: str) -> str:
    """Turn an event name into a single safe folder name (no path tricks)."""
    cleaned = re.sub(r"[^A-Za-z0-9 _.\-]", "", event).strip(" .")
    if not cleaned:
        raise HTTPException(status_code=400, detail="Event name must contain letters or numbers.")
    return cleaned[:80]


def safe_filename(name: str) -> str:
    base = Path(name or "").name
    stem, suffix = Path(base).stem, Path(base).suffix.lower()
    if suffix not in IMAGE_SUFFIXES:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {base or '(unnamed)'}")
    stem = re.sub(r"[^A-Za-z0-9 _.\-]", "_", stem).strip(" .") or "photo"
    return f"{stem[:120]}{suffix}"


def _run_index() -> None:
    try:
        stats = index_folder(PHOTOS_DIR, verbose=False)
        _status.update(state="idle", finished_at=time.time(), stats=stats, error=None)
    except Exception as exc:  # surfaced through /status rather than lost in logs
        _status.update(state="failed", finished_at=time.time(), error=str(exc))
    finally:
        _lock.release()


def start_index(background: BackgroundTasks) -> bool:
    """Queue an incremental index run unless one is already going."""
    if not _lock.acquire(blocking=False):
        return False
    _status.update(state="running", started_at=time.time(), finished_at=None, error=None)
    background.add_task(_run_index)
    return True


@router.post("/photos", dependencies=[Depends(require_token)])
async def upload_photos(
    background: BackgroundTasks,
    event: str = Form(...),
    files: list[UploadFile] = File(...),
    reindex: bool = Form(False),
) -> dict:
    """Save photos under PHOTOS_DIR/<event>/. Event folders may carry a date, e.g. "Horizon 2026-03-14"."""
    folder = PHOTOS_DIR / safe_folder(event)
    folder.mkdir(parents=True, exist_ok=True)

    saved = []
    for upload in files:
        name = safe_filename(upload.filename)
        data = await upload.read()
        if not data:
            continue
        if len(data) > MAX_ADMIN_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail=f"{name} is larger than the upload limit.")
        (folder / name).write_bytes(data)
        saved.append(name)

    queued = start_index(background) if reindex else False
    return {"event": folder.name, "saved": saved, "count": len(saved), "index_queued": queued}


@router.post("/reindex", dependencies=[Depends(require_token)])
def reindex(background: BackgroundTasks) -> dict:
    queued = start_index(background)
    return {"queued": queued, "status": _status}


@router.get("/status", dependencies=[Depends(require_token)])
def status() -> dict:
    return _status
