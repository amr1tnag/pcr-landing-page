# PhotoCircle RAIT: website and face-search gallery

This is the site for **PhotoCircle RAIT**, the official media team of Ramrao Adik Institute of Technology, Navi Mumbai. `#WeThePCR`

- **Landing page:** hero, about, gallery, events, crew, and how to join.
- **Face search** (`/gallery`): upload a selfie or use the camera to get every event photo you appear in, with download and share buttons.
- **Photo indexer** (`/indexer`, for the club): adds an event's photos to face search.

It is a React site on Vercel, with one Vercel serverless function for face search. **There is no server to rent and no running cost.**

```
frontend/
  api/search.js           POST a selfie -> matching photos (Vercel function)
  api/health.js           GET -> model backend + index size, for checking a deploy
  server/matcher.js       decodes/rotates the photo (sharp), finds the face, matches the index
  src/lib/faces.js        browser-side detection for the indexer, index format, Drive listing
  src/pages/FaceSearch.jsx   /gallery
  src/pages/Indexer.jsx      /indexer
  src/data/site.js        all landing-page copy (events, team, links)
  public/data/faces.json  the face index (photo list + face signatures)
  public/models/          face model weights
  public/wasm/            TensorFlow.js WebAssembly files for the indexer
backend/                  optional standalone Python server (not used by the site; see the end)
```

## How face search works

1. **Indexing (club side, on a laptop):** `/indexer` runs the face detector in your browser on an event's photos. It uses the SSD detector over the whole frame plus overlapping tiles, so small faces in crowd shots are found. Each face becomes a 128-number signature in `faces.json`.
2. **Searching (visitor side, any phone):** `/gallery` shrinks the selfie on the phone and sends it to `/api/search`. The function finds the largest face and compares it with every signature in `faces.json`. Phones don't download the face model, so search works on any phone. A search takes about a second once the function is warm. The first one after a quiet spell takes a few seconds longer.
3. **Privacy:** the selfie is processed in memory for that one search and never stored.

Both sides use the same model, [`@vladmandic/face-api`](https://github.com/vladmandic/face-api). Its recognition network is a port of dlib's ResNet, the model behind Python's `face_recognition`.
- **Server:** the function runs it on TensorFlow.js with WebAssembly, so there are no native builds. If WebAssembly can't start, it falls back to plain JavaScript, which is slower but still works.
- **Checking a deploy:** `GET /api/health` reports which backend is running and the size of the index.

**Quality gates.** Signatures from tiny or doubtful faces are close to noise and match strangers, so:
- The indexer drops faces that are both small and low-confidence.
- A selfie whose face is too small or unclear is rejected with a request for a closer photo.

**Strictness presets:**

| Preset | Distance threshold |
|---|---|
| Strict | 0.46 |
| Balanced | 0.52 |
| Loose | 0.58 |

On the club's stage photos, strangers start to appear above about 0.55.

**Known limits.** Like `face_recognition`, the model is weakest on profile, head-down, eyes-closed or heavily stage-lit faces. A clear, front-facing selfie gives the best results.

**Index visibility.** `faces.json` is public, like the photos. It contains face signatures, not images.

## Adding an event (the club's workflow)

### One-time setup: a free Google API key

The indexer uses the Drive API to look up each photo's ID in the event's Drive folder.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project. No billing is needed.
2. Go to **APIs & Services → Library**, find **Google Drive API**, and click **Enable**.
3. Go to **APIs & Services → Credentials**, then **Create credentials → API key**.
4. Click **Edit** on the key and set **API restrictions** to **Google Drive API**. Under **Website restrictions**, add your site and `localhost`.

The key is typed into the indexer page only. You can tick "remember on this device", which stores it in that browser. It is never committed or added to the site.

### For each event

1. **Upload the photos to Google Drive.** Put them in one folder per event, then use **Share → General access → Anyone with the link (Viewer)**.
2. **Index them.** Open `https://<your-site>/indexer`, then:
   - enter the event name and date;
   - paste the Drive folder link;
   - choose the **same photos** from your computer (folder or files);
   - click **Index photos**.

   Matching between Drive and your computer is by file name. Indexing is fastest in Chrome on a laptop, at roughly 0.5–2 seconds a photo.
3. **Publish.** Click **Download faces.json**, then use the indexer's link to GitHub's upload page for `frontend/public/data/` and commit the file. Vercel redeploys in about a minute.

Re-indexing an event replaces its existing photos. The trash icon removes an event, and "Continue from a faces.json" resumes from a file on your computer.

**Photos on the site itself.** The "This website" source indexes images committed under `frontend/public` instead of Drive. The starter index uses this source for the club photos already on the landing page, including the team photo, so search works from day one. You can remove those events in the indexer.

## Running locally

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

Vercel builds from `frontend/`. `frontend/vercel.json` rewrites client routes to the SPA and configures the two functions: a 30-second limit, plus bundling the model files, the index and the WebAssembly binary.

To run the API locally as well, use `npx vercel dev` from `frontend/`.

## Landing-page content

- **Copy and images:** all copy, events, team roles and gallery frames are in `frontend/src/data/site.js`. Images are in `frontend/public/img/`.
- **Team:** each team entry takes an optional `name`. Until a name is set, the card shows the role.
- **To check:** lines marked `TODO` (the club email and event dates) need confirming.

## Optional: the Python server (`backend/`)

The first version ran matching on a FastAPI server with `face_recognition` and SQLite. It is kept for anyone who later wants a hosted, private index, for example on a college server or a paid host with a persistent disk.

- It has a batch indexer (`python -m app.indexer`), an admin upload API with a CLI (`python -m app.upload`), and a `Dockerfile` that has been tested.
- `render.yaml` is a Render Blueprint for it. It needs a paid plan, because free instances lose their files on restart.
- The current site does not call it.
