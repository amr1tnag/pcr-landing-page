# PhotoCircle RAIT — website + face-search gallery

The site for **PhotoCircle RAIT**, the official media team of Ramrao Adik Institute of Technology, Navi Mumbai. `#WeThePCR`

- **Landing page:** hero, about, gallery preview, events timeline, team, and join/contact.
- **Face search** (`/gallery`): upload a selfie or use the camera, and the site returns every indexed event photo you appear in, with download and share buttons.

```
frontend/   React 18 + Vite + Tailwind CSS
backend/    FastAPI + face_recognition (dlib) + SQLite
  app/
    main.py       API: /api/search, /api/photos, /api/events, /api/health
    indexer.py    batch indexer CLI
    faces.py      detection + 128-d embeddings
    db.py         SQLite schema, embeddings stored as BLOBs
    config.py     every setting, overridable via PCR_* env vars
  photos/       your event photos (git-ignored)
```

## Quick start (local)

**1. Backend**

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # dlib needs cmake + a C++ compiler if no wheel exists
uvicorn app.main:app --reload --port 8000
```

**2. Frontend** (in a second terminal)

```bash
cd frontend
npm install
npm run dev                               # http://localhost:5173, proxies /api and /photos to :8000
```

## Adding photos (batch indexing)

Put photos in `backend/photos/`. Each top-level folder becomes an event, and a date in the folder name is picked up automatically:

```
backend/photos/
  Horizon 2026-03-14/IMG_0001.jpg
  DYT20 2026-03-03/...
  Marathon 2026-01-18/...
```

Then run:

```bash
cd backend
python -m app.indexer                     # incremental: only new or changed files are encoded
python -m app.indexer --rebuild           # re-encode everything
python -m app.indexer --source /mnt/drive/exports   # index a different folder
python -m app.indexer --upsample 2        # find smaller faces in crowd shots (about 3–4× slower)
python -m app.indexer --model cnn         # more accurate detector; use it with a GPU
```

The indexer skips files whose modification time hasn't changed. It also removes database rows for photos that were deleted from disk, unless you pass `--keep-missing`. Re-run it after every event. It is safe to run while the server is live.

If you don't put a date in the folder name, the indexer uses the file's modification date.

## Self-hosting (one process)

After `npm run build`, FastAPI serves the built site as well as the API, so one process is the whole deployment:

```bash
cd frontend && npm run build && cd ../backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1   # one worker: index jobs run in-process
```

With Docker:

```bash
mkdir -p data/photos                      # copy event folders in here
docker compose up -d --build
docker compose exec pcr python -m app.indexer
# → http://localhost:8000
```

## Production: Vercel (site) + Render (face-search API)

The site is deployed on Vercel from `frontend/` (see `frontend/vercel.json`). The Python API can't run on Vercel, because dlib and its models are too large and the storage is ephemeral. It runs on Render instead, from `render.yaml`.

**1. Create the API on Render**

On Render, go to **New → Blueprint**, pick this repo and apply. That creates `pcr-api`:
- built from `backend/Dockerfile` (the first build compiles dlib, about 10–15 min)
- in the Singapore region
- with a 5 GB persistent disk at `/data` for photos and the index
- with a random `PCR_ADMIN_TOKEN`

The Blueprint uses the **Starter** plan, because Render only attaches persistent disks to paid instances. On the free plan the app runs, but every deploy or restart wipes all uploaded photos and the index. Free instances also sleep after 15 minutes idle, so the next search waits about a minute.

**2. Point the site at it**

In Vercel, go to **Project → Settings → Environment Variables**. Add `VITE_API_BASE` = `https://<your-service>.onrender.com`, then redeploy. If your Vercel domain changes, update `PCR_ALLOWED_ORIGINS` on Render to match.

**3. Upload photos**

Copy `PCR_ADMIN_TOKEN` from Render → Environment, then run this from `backend/` on your laptop:

```bash
export PCR_API_URL=https://<your-service>.onrender.com PCR_ADMIN_TOKEN=<token>
python -m app.upload --source "~/Pictures/Horizon 2026-03-14"   # one event
python -m app.upload --source ~/Pictures/PCR --tree              # a folder of event folders
```

The CLI uploads in small batches with retries, then triggers an incremental index and waits for it to finish. Re-running it is safe, because unchanged photos are skipped. The admin API (`/api/admin/photos`, `/reindex`, `/status`) is disabled unless `PCR_ADMIN_TOKEN` is set.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `PCR_PHOTOS_DIR` | `backend/photos` | Source folder of event photos |
| `PCR_DB_PATH` | `backend/pcr.db` | SQLite file |
| `PCR_TOLERANCE` | `0.5` | Default match threshold (lower = stricter) |
| `PCR_UPSAMPLE` | `1` | Detector upsampling; `2` finds smaller faces |
| `PCR_DETECTION_MODEL` | `hog` | `hog` for CPU, `cnn` for GPU |
| `PCR_MAX_EDGE` | `2400` | Images are downscaled to this size before detection |
| `PCR_FRONTEND_DIST` | `frontend/dist` | Built site to serve, if present |
| `PCR_ALLOWED_ORIGINS` | `localhost:5173` | CORS origins, comma-separated |
| `PCR_ADMIN_TOKEN` | *(unset)* | Enables the admin upload/reindex API |
| `VITE_API_BASE` | *(empty)* | Frontend build-time API origin, if the API is hosted elsewhere |

## How matching works

1. **Indexing:** the indexer detects every face in each photo and stores one 128-d embedding per face in SQLite.
2. **Search:** the uploaded selfie is encoded in memory, using the largest face found. It is never saved to disk.
3. **Ranking:** the search computes the Euclidean distance to every stored face in one NumPy operation. It keeps each photo's closest face and returns photos under the tolerance, ranked by distance.

The UI offers three presets: Strict 0.42, Balanced 0.5 and Loose 0.58.

**Known limits.** `face_recognition` works well on front-facing faces. It is much weaker on profile, head-down, eyes-closed or heavily stage-lit faces, which are common in concert shots. To improve recall, try `--upsample 2` or `--model cnn` first. If accuracy matters at scale, the next step is a stronger embedding model, such as InsightFace/ArcFace. Only `faces.py` would need to change, because the database and API store vectors without caring which model produced them.

## Scaling notes

- Search is a brute-force NumPy scan. That handles around 100k faces in well under a second.
- Beyond that, load the matrix into FAISS or switch to `sqlite-vec`/pgvector. Only `db.load_face_matrix` and the distance step need to change.
- **Google Drive:** sync or export the Drive folder locally, for example with `rclone sync`, and point `--source` at it. To serve the full-resolution files from Drive instead of local disk, store the Drive file ID per photo.

## Landing-page content

All copy, events, team roles and gallery frames are in `frontend/src/data/site.js`. Images are in `frontend/public/img/`. Team cards currently show role titles, so add members' names there. Any missing image falls back to a branded gradient tile.
