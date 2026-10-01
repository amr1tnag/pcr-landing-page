"""Push a local folder of event photos to a hosted PhotoCircle server, then index them.

    python -m app.upload --url https://pcr-api.onrender.com --token $PCR_ADMIN_TOKEN \\
        --source "~/Pictures/Horizon 2026-03-14"

The source folder's name becomes the event (dates in it are picked up). Pass
--event to override it, or --tree to upload a folder of event folders at once.
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import httpx

from .config import IMAGE_SUFFIXES

BATCH = 8  # files per request — keeps each request small enough for flaky connections


def images_in(folder: Path) -> list[Path]:
    return sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES)


def push_event(client: httpx.Client, event: str, files: list[Path]) -> int:
    sent = 0
    for i in range(0, len(files), BATCH):
        chunk = files[i : i + BATCH]
        handles = [("files", (f.name, f.open("rb"), "image/jpeg")) for f in chunk]
        try:
            for attempt in range(3):
                try:
                    r = client.post("/api/admin/photos", data={"event": event}, files=handles)
                    break
                except httpx.TransportError:
                    if attempt == 2:
                        raise
                    time.sleep(2 ** (attempt + 1))
                    for _, (_, fh, _) in handles:
                        fh.seek(0)
        finally:
            for _, (_, fh, _) in handles:
                fh.close()
        if r.status_code != 200:
            sys.exit(f"Upload failed ({r.status_code}): {r.text}")
        sent += r.json()["count"]
        print(f"  {event}: {sent}/{len(files)}")
    return sent


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload event photos to a hosted PhotoCircle server.")
    parser.add_argument("--url", default=os.getenv("PCR_API_URL"), help="server base URL (or PCR_API_URL)")
    parser.add_argument("--token", default=os.getenv("PCR_ADMIN_TOKEN"), help="admin token (or PCR_ADMIN_TOKEN)")
    parser.add_argument("--source", type=Path, required=True, help="folder of photos")
    parser.add_argument("--event", help="event name (defaults to the folder name)")
    parser.add_argument("--tree", action="store_true", help="source holds one sub-folder per event")
    parser.add_argument("--no-index", action="store_true", help="upload only; don't trigger indexing")
    args = parser.parse_args()

    if not args.url or not args.token:
        parser.error("--url and --token are required (or set PCR_API_URL / PCR_ADMIN_TOKEN)")

    source = args.source.expanduser().resolve()
    if not source.is_dir():
        parser.error(f"not a folder: {source}")

    if args.tree:
        jobs = [(d.name, images_in(d)) for d in sorted(source.iterdir()) if d.is_dir()]
    else:
        jobs = [(args.event or source.name, images_in(source))]
    jobs = [(e, f) for e, f in jobs if f]
    if not jobs:
        sys.exit("No images found.")

    headers = {"Authorization": f"Bearer {args.token}"}
    # Long timeout: a free/sleeping instance can take ~1 min to wake up.
    with httpx.Client(base_url=args.url.rstrip("/"), headers=headers, timeout=180) as client:
        total = sum(push_event(client, event, files) for event, files in jobs)
        print(f"Uploaded {total} photo(s).")

        if args.no_index:
            return

        r = client.post("/api/admin/reindex")
        if r.status_code != 200:
            sys.exit(f"Reindex failed ({r.status_code}): {r.text}")
        print("Indexing", end="", flush=True)
        while True:
            time.sleep(3)
            status = client.get("/api/admin/status").json()
            if status["state"] != "running":
                break
            print(".", end="", flush=True)
        print()
        if status["state"] == "failed":
            sys.exit(f"Indexing failed: {status['error']}")
        s = status["stats"] or {}
        print(f"Indexed {s.get('indexed', 0)} new photo(s), {s.get('faces', 0)} face(s) found.")


if __name__ == "__main__":
    main()
