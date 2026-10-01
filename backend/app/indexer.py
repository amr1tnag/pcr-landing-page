"""Batch-index a folder of event photos into SQLite.

Usage:
    python -m app.indexer                 # index backend/photos
    python -m app.indexer --source /path  # index another folder
    python -m app.indexer --rebuild       # re-encode everything
"""
from __future__ import annotations

import argparse
import datetime as dt
import re
from pathlib import Path

from . import db
from .config import DETECTION_MODEL, IMAGE_SUFFIXES, PHOTOS_DIR, UPSAMPLE
from .faces import FaceEngineUnavailable, encode_image

# Pull a date out of folder names like "Horizon 2026-03-14" or "2026-03-14 Marathon".
DATE_RE = re.compile(r"(20\d{2})[-_.](\d{2})[-_.](\d{2})")


def derive_event(relative: Path) -> tuple[str, str]:
    """Infer (event, date) from the photo's folder path."""
    if len(relative.parts) < 2:
        return "", ""

    folder = relative.parts[0]
    match = DATE_RE.search(folder)
    date = ""
    if match:
        date = "-".join(match.groups())
        folder = DATE_RE.sub("", folder)

    event = re.sub(r"[-_]+", " ", folder).strip(" -_")
    return event, date


def iter_images(root: Path):
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES:
            yield path


def index_folder(source: Path = PHOTOS_DIR, *, rebuild: bool = False, model: str = DETECTION_MODEL,
                 upsample: int = UPSAMPLE, prune: bool = True, verbose: bool = True) -> dict:
    """Index every image under `source`, skipping files already up to date."""
    source = Path(source).resolve()
    if not source.exists():
        raise FileNotFoundError(f"Photo folder not found: {source}")

    db.init_db()
    stats = {"scanned": 0, "indexed": 0, "skipped": 0, "faces": 0, "failed": 0, "pruned": 0}

    with db.session() as conn:
        known = {} if rebuild else db.photo_mtimes(conn)
        present: list[str] = []

        for path in iter_images(source):
            relative = path.relative_to(source)
            key = relative.as_posix()
            present.append(key)
            stats["scanned"] += 1

            mtime = path.stat().st_mtime
            if not rebuild and key in known and abs(known[key] - mtime) < 1e-6:
                stats["skipped"] += 1
                continue

            try:
                encodings, locations, size = encode_image(path, model=model, upsample=upsample)
            except FaceEngineUnavailable:
                raise
            except Exception as exc:  # a corrupt or unreadable file shouldn't stop the batch
                stats["failed"] += 1
                if verbose:
                    print(f"  ! {key}: {exc}")
                continue

            event, date = derive_event(relative)
            if not date:
                date = dt.date.fromtimestamp(mtime).isoformat()

            photo_id = db.upsert_photo(
                conn,
                {
                    "path": key,
                    "filename": path.name,
                    "event": event,
                    "date": date,
                    "width": size[0],
                    "height": size[1],
                    "size_bytes": path.stat().st_size,
                    "mtime": mtime,
                    "face_count": len(encodings),
                },
            )
            db.insert_faces(conn, photo_id, encodings, locations)

            stats["indexed"] += 1
            stats["faces"] += len(encodings)
            if verbose:
                print(f"  + {key} — {len(encodings)} face(s)")

        if prune:
            stats["pruned"] = db.delete_missing(conn, present)

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Index event photos for PhotoCircle face search.")
    parser.add_argument("--source", type=Path, default=PHOTOS_DIR, help="folder of event photos")
    parser.add_argument("--rebuild", action="store_true", help="re-encode every photo")
    parser.add_argument("--model", default=DETECTION_MODEL, choices=["hog", "cnn"], help="detection model")
    parser.add_argument("--upsample", type=int, default=UPSAMPLE, help="detection upsampling (2 = find smaller faces)")
    parser.add_argument("--keep-missing", action="store_true", help="don't prune rows for deleted files")
    args = parser.parse_args()

    print(f"Indexing {Path(args.source).resolve()} (model: {args.model}, upsample: {args.upsample})")
    stats = index_folder(
        args.source,
        rebuild=args.rebuild,
        model=args.model,
        upsample=args.upsample,
        prune=not args.keep_missing,
    )
    print(
        "\nDone — {scanned} scanned, {indexed} indexed, {skipped} unchanged, "
        "{faces} faces, {failed} failed, {pruned} pruned.".format(**stats)
    )


if __name__ == "__main__":
    main()
