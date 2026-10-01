# PhotoCircle RAIT: website and face-search gallery

This is the site for **PhotoCircle RAIT**, the official media team of Ramrao Adik Institute of Technology, Navi Mumbai. `#WeThePCR`

- **Landing page:** hero, about, gallery, events, crew, and how to join.
- **Face search** (`/gallery`): upload a selfie or use the camera to get every event photo you appear in, with download and share buttons.
- **Photo indexer** (`/indexer`, for the club): adds an event's photos to face search.

It is a React site on Vercel, with a few Vercel serverless functions for face search. **There is no server to rent and no running cost.** Photos live in Google Drive.

```
frontend/
  api/search.js             POST a selfie -> matching photos
  api/health.js             GET -> model backend + index size, to check a deploy
  api/admin/list.js         list a Drive folder (admin password)
  api/admin/index-photo.js  find the faces in one Drive photo (admin password)
  api/admin/publish.js      commit the updated index to GitHub (admin password)
  server/matcher.js         face model: decode/rotate (sharp), detect, match, index
  server/admin.js           Drive API, GitHub publishing, password check
  server/models/            face model weights
  src/pages/FaceSearch.jsx  /gallery
  src/pages/Indexer.jsx     /indexer (for the club)
  src/data/site.js          all landing-page copy (events, team, links)
  public/data/faces.json    the face index: photo list + face signatures
backend/                    optional standalone Python server (not used by the site; see the end)
```

## How face search works

- **Searching (any phone):** `/gallery` shrinks the selfie and sends it to `/api/search`. The function finds the largest face and compares it with every signature in `faces.json`. Phones never download the face model. A search takes about a second when warm, and a few seconds after a quiet spell.
- **Indexing (any device):**
  1. On `/indexer` you paste a Drive folder link.
  2. The server lists the folder and pulls each photo from Drive at 2400px. It finds the faces using SSD over the full frame plus overlapping tiles, which catches small faces in crowd shots.
  3. It commits the updated `faces.json` to GitHub, and Vercel redeploys within about a minute.
- **Privacy:** selfies are processed in memory for one search and never stored. `faces.json` is public, like the photos. It holds face signatures, not images.

**The model.** The model is [`@vladmandic/face-api`](https://github.com/vladmandic/face-api). Its recognition network is a port of dlib's ResNet, the model behind Python's `face_recognition`. On the server it runs on TensorFlow.js with WebAssembly, so there are no native builds. If WebAssembly can't start, it falls back to plain JavaScript.

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

## One-time setup (Vercel environment variables)

In **Vercel → the project → Settings → Environment Variables**, add these for Production, then redeploy:

| Name | What it is | Where to get it |
|---|---|---|
| `PCR_ADMIN_PASSWORD` | The password for `/indexer` | Make one up and share it with the core team |
| `GOOGLE_API_KEY` | Lets the server list Drive folders | Google Cloud Console (steps below), free, no billing |
| `GITHUB_TOKEN` | Lets the server commit `faces.json` | GitHub fine-grained token (steps below) |

### `GOOGLE_API_KEY`

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project.
2. Go to **APIs & Services → Library**, find **Google Drive API**, and click **Enable**.
3. Go to **Credentials → Create credentials → API key**.
4. Edit the key and set **API restrictions** to **Google Drive API**.

### `GITHUB_TOKEN`

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Under **Repository access**, choose **Only select repositories** and pick `amr1tnag/pcr-landing-page`.
3. Under **Permissions → Repository permissions**, set **Contents** to **Read and write**.
4. Set an expiry, and renew the token when it runs out.

## Adding an event

1. **Upload to Drive.** Put the photos in a Google Drive folder, one per event. Then use **Share → General access → Anyone with the link (Viewer)**.
2. **Index and publish.** Open `https://<your-site>/indexer` on a phone or laptop and sign in with the admin password. Enter the event name and date, paste the folder link, and press **Index and publish**. A few hundred photos take a few minutes.
3. **Wait for the redeploy.** About a minute later, search includes the new photos.

**Re-indexing and removing.** Re-indexing a folder replaces photos with the same file names. The trash icon removes a whole event.

**Starter events.** These index photos already on the site (`src: url` in `faces.json`, including the team photo), so search works from day one. Remove them once real events are in.

## Running locally

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

Vercel builds from `frontend/`. `frontend/vercel.json` rewrites client routes to the SPA and configures the functions: a 60-second limit, plus bundling the model weights, the index and the WebAssembly binary.

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
