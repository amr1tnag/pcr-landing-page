"""SQLite storage for photo metadata and face embeddings."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterable, Iterator

import numpy as np

from .config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS photos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    path        TEXT    NOT NULL UNIQUE,   -- relative to PHOTOS_DIR
    filename    TEXT    NOT NULL,
    event       TEXT    NOT NULL DEFAULT '',
    date        TEXT    NOT NULL DEFAULT '',
    width       INTEGER,
    height      INTEGER,
    size_bytes  INTEGER,
    mtime       REAL,
    face_count  INTEGER NOT NULL DEFAULT 0,
    indexed_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS faces (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id    INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    embedding   BLOB    NOT NULL,          -- 128 float64 values
    top         INTEGER, right_ INTEGER, bottom INTEGER, left_ INTEGER
);

CREATE INDEX IF NOT EXISTS idx_faces_photo ON faces(photo_id);
CREATE INDEX IF NOT EXISTS idx_photos_event ON photos(event);
"""


def connect(path: Path | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(path or DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


@contextmanager
def session(path: Path | None = None) -> Iterator[sqlite3.Connection]:
    conn = connect(path)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db(path: Path | None = None) -> None:
    (path or DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with session(path) as conn:
        conn.executescript(SCHEMA)


def to_blob(vec: np.ndarray) -> bytes:
    return np.asarray(vec, dtype=np.float64).tobytes()


def from_blob(blob: bytes) -> np.ndarray:
    return np.frombuffer(blob, dtype=np.float64)


def upsert_photo(conn: sqlite3.Connection, meta: dict) -> int:
    """Insert or refresh a photo row and return its id (clearing stale faces)."""
    cur = conn.execute("SELECT id FROM photos WHERE path = ?", (meta["path"],))
    row = cur.fetchone()
    if row:
        photo_id = row["id"]
        conn.execute(
            """UPDATE photos
                  SET filename=:filename, event=:event, date=:date, width=:width,
                      height=:height, size_bytes=:size_bytes, mtime=:mtime,
                      face_count=:face_count, indexed_at=datetime('now')
                WHERE id=:id""",
            {**meta, "id": photo_id},
        )
        conn.execute("DELETE FROM faces WHERE photo_id = ?", (photo_id,))
        return photo_id

    cur = conn.execute(
        """INSERT INTO photos (path, filename, event, date, width, height,
                               size_bytes, mtime, face_count)
           VALUES (:path, :filename, :event, :date, :width, :height,
                   :size_bytes, :mtime, :face_count)""",
        meta,
    )
    return int(cur.lastrowid)


def insert_faces(conn: sqlite3.Connection, photo_id: int, encodings, locations) -> None:
    rows = []
    for enc, loc in zip(encodings, locations):
        top, right, bottom, left = loc
        rows.append((photo_id, to_blob(enc), int(top), int(right), int(bottom), int(left)))
    conn.executemany(
        "INSERT INTO faces (photo_id, embedding, top, right_, bottom, left_) VALUES (?,?,?,?,?,?)",
        rows,
    )


def photo_mtimes(conn: sqlite3.Connection) -> dict[str, float]:
    return {r["path"]: (r["mtime"] or 0.0) for r in conn.execute("SELECT path, mtime FROM photos")}


def delete_missing(conn: sqlite3.Connection, present: Iterable[str]) -> int:
    present = set(present)
    stale = [r["id"] for r in conn.execute("SELECT id, path FROM photos") if r["path"] not in present]
    for pid in stale:
        conn.execute("DELETE FROM faces WHERE photo_id = ?", (pid,))
        conn.execute("DELETE FROM photos WHERE id = ?", (pid,))
    return len(stale)


def load_face_matrix(conn: sqlite3.Connection, event: str | None = None):
    """Return (embeddings matrix, photo rows aligned to each row of the matrix)."""
    sql = """
        SELECT f.embedding, p.id, p.path, p.filename, p.event, p.date
          FROM faces f
          JOIN photos p ON p.id = f.photo_id
    """
    params: tuple = ()
    if event:
        sql += " WHERE p.event = ?"
        params = (event,)

    rows = conn.execute(sql, params).fetchall()
    if not rows:
        return np.empty((0, 128)), []

    matrix = np.vstack([from_blob(r["embedding"]) for r in rows])
    meta = [
        {"id": r["id"], "path": r["path"], "filename": r["filename"], "event": r["event"], "date": r["date"]}
        for r in rows
    ]
    return matrix, meta
