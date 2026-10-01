"""FastAPI service: face search over the PhotoCircle RAIT archive."""
from __future__ import annotations

from contextlib import asynccontextmanager
from urllib.parse import quote

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import db
from .admin import router as admin_router
from .config import ALLOWED_ORIGINS, DEFAULT_TOLERANCE, FRONTEND_DIST, PHOTOS_DIR
from .faces import FaceEngineUnavailable, confidence, distances, encode_query, engine_available

MAX_UPLOAD_BYTES = 12 * 1024 * 1024


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="PhotoCircle RAIT — Face Search", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(admin_router)

# Full-resolution originals are served straight off disk.
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/photos", StaticFiles(directory=PHOTOS_DIR), name="photos")


def photo_url(path: str) -> str:
    return "/photos/" + quote(path)


def serialize(row) -> dict:
    return {
        "id": row["id"],
        "url": photo_url(row["path"]),
        "filename": row["filename"],
        "event": row["event"],
        "date": row["date"],
        "face_count": row["face_count"],
    }


@app.get("/api/health")
def health() -> dict:
    with db.session() as conn:
        photos = conn.execute("SELECT COUNT(*) c FROM photos").fetchone()["c"]
        faces = conn.execute("SELECT COUNT(*) c FROM faces").fetchone()["c"]
    return {
        "status": "ok",
        "face_engine": engine_available(),
        "indexed_photos": photos,
        "indexed_faces": faces,
        "photos_dir": str(PHOTOS_DIR),
    }


@app.get("/api/events")
def events() -> dict:
    with db.session() as conn:
        rows = conn.execute(
            """SELECT event AS name, COUNT(*) AS photo_count, MIN(date) AS first, MAX(date) AS last
                 FROM photos
                WHERE event <> ''
             GROUP BY event
             ORDER BY last DESC, name"""
        ).fetchall()
    return {"events": [dict(r) for r in rows]}


@app.get("/api/photos")
def photos(event: str = "", limit: int = 60, offset: int = 0) -> dict:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    sql = "SELECT * FROM photos"
    params: list = []
    if event:
        sql += " WHERE event = ?"
        params.append(event)
    sql += " ORDER BY date DESC, id DESC LIMIT ? OFFSET ?"
    params += [limit, offset]

    with db.session() as conn:
        rows = conn.execute(sql, params).fetchall()
        total = conn.execute(
            "SELECT COUNT(*) c FROM photos" + (" WHERE event = ?" if event else ""),
            ([event] if event else []),
        ).fetchone()["c"]

    return {"total": total, "count": len(rows), "photos": [serialize(r) for r in rows]}


@app.get("/api/photos/{photo_id}/download")
def download(photo_id: int):
    """Serve a photo as an attachment — the HTML download attribute is ignored cross-origin."""
    with db.session() as conn:
        row = conn.execute("SELECT path, filename FROM photos WHERE id = ?", (photo_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Photo not found.")
    path = (PHOTOS_DIR / row["path"]).resolve()
    if PHOTOS_DIR not in path.parents or not path.is_file():
        raise HTTPException(status_code=404, detail="Photo file is missing.")
    return FileResponse(path, filename=row["filename"])


@app.post("/api/search")
async def search(
    file: UploadFile = File(...),
    tolerance: float = Form(DEFAULT_TOLERANCE),
    event: str = Form(""),
    limit: int = Form(60),
) -> dict:
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=415, detail="Upload an image file (JPG or PNG).")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file was empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large — keep it under 12 MB.")

    tolerance = float(max(0.3, min(tolerance, 0.75)))
    limit = max(1, min(int(limit), 200))

    try:
        query = encode_query(data)
    except FaceEngineUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Couldn't read that image: {exc}") from exc

    if query is None:
        raise HTTPException(
            status_code=422,
            detail="No face found in that photo. Try a brighter, front-facing shot where your face is larger.",
        )

    with db.session() as conn:
        matrix, meta = db.load_face_matrix(conn, event or None)

    if not meta:
        return {"matches": [], "searched_faces": 0, "tolerance": tolerance}

    dist = distances(matrix, query)

    # One photo can hold several faces — keep each photo's single best distance.
    best: dict[int, tuple[float, dict]] = {}
    for d, m in zip(dist, meta):
        if d > tolerance:
            continue
        current = best.get(m["id"])
        if current is None or d < current[0]:
            best[m["id"]] = (float(d), m)

    ranked = sorted(best.values(), key=lambda pair: pair[0])[:limit]

    matches = [
        {
            "id": m["id"],
            "url": photo_url(m["path"]),
            "filename": m["filename"],
            "event": m["event"],
            "date": m["date"],
            "distance": round(d, 4),
            "confidence": round(confidence(d, tolerance), 4),
        }
        for d, m in ranked
    ]

    return {
        "matches": matches,
        "searched_faces": int(matrix.shape[0]),
        "tolerance": tolerance,
        "closest_distance": round(float(np.min(dist)), 4),
    }


# --- Single-process hosting: serve the built React app for every non-API path. ---
if (FRONTEND_DIST / "index.html").is_file():

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = (FRONTEND_DIST / full_path).resolve()
        if full_path and candidate.is_file() and FRONTEND_DIST in candidate.parents:
            return FileResponse(candidate)
        # Client-side routes (/gallery, …) fall back to the SPA shell.
        return FileResponse(FRONTEND_DIST / "index.html")
