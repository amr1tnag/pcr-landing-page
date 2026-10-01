// Admin side of face search: list a public Drive folder, fetch its photos, and
// publish the updated faces.json to GitHub (Vercel then redeploys the site).
// Secrets live in Vercel's environment variables, never in the browser.
import { createHash, timingSafeEqual } from 'node:crypto'

const env = (name, fallback = '') => (process.env[name] || fallback).trim()

const config = () => ({
  password: env('PCR_ADMIN_PASSWORD'),
  googleKey: env('GOOGLE_API_KEY'),
  githubToken: env('GITHUB_TOKEN'),
  repo: env('GITHUB_REPO', 'amr1tnag/pcr-landing-page'),
  branch: env('GITHUB_BRANCH', 'main'),
  indexPath: env('PCR_INDEX_PATH', 'frontend/public/data/faces.json'),
  // Overridable so the flow can be tested against local mock servers.
  googleApi: env('GOOGLE_API_BASE', 'https://www.googleapis.com'),
  drivePhotos: env('DRIVE_PHOTO_BASE', 'https://drive.google.com'),
  githubApi: env('GITHUB_API_BASE', 'https://api.github.com'),
})

export class AdminError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function configured() {
  const c = config()
  return { password: Boolean(c.password), google: Boolean(c.googleKey), github: Boolean(c.githubToken) }
}

const digest = (s) => createHash('sha256').update(String(s)).digest()

export function requireAdmin(password) {
  const c = config()
  if (!c.password) throw new AdminError(503, 'The admin password is not set up yet (PCR_ADMIN_PASSWORD in Vercel).')
  if (!password || !timingSafeEqual(digest(password), digest(c.password))) throw new AdminError(401, 'Wrong admin password.')
}

// ---------------- Google Drive ----------------

export function parseFolderId(input) {
  const s = String(input || '').trim()
  const m = s.match(/folders\/([\w-]{10,})/) || s.match(/[?&]id=([\w-]{10,})/)
  if (m) return m[1]
  if (/^[\w-]{10,}$/.test(s)) return s
  return null
}

function driveError(status, body) {
  const reason = body?.error?.message || `HTTP ${status}`
  if (status === 404) return new AdminError(404, 'Drive folder not found. Check the link, and share the folder as "Anyone with the link".')
  if (status === 400 && /API key/i.test(reason)) return new AdminError(502, 'Google rejected the API key (GOOGLE_API_KEY in Vercel).')
  if (status === 403) return new AdminError(502, `Google refused access: ${reason}. Is the Drive API enabled for this key?`)
  return new AdminError(502, `Google Drive error: ${reason}`)
}

/** Every image in a public Drive folder: [{ id, name }]. */
export async function listFolder(folderId) {
  const c = config()
  if (!c.googleKey) throw new AdminError(503, 'Google Drive is not set up yet (GOOGLE_API_KEY in Vercel).')
  const files = []
  let pageToken = ''
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false and mimeType contains 'image/'`)
    const url =
      `${c.googleApi}/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name)&pageSize=1000` +
      `&supportsAllDrives=true&includeItemsFromAllDrives=true&key=${encodeURIComponent(c.googleKey)}` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '')
    const res = await fetch(url)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw driveError(res.status, body)
    for (const f of body.files || []) files.push({ id: f.id, name: f.name })
    pageToken = body.nextPageToken || ''
  } while (pageToken)
  return files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
}

const MAX_PHOTO_BYTES = 40 * 1024 * 1024

async function fetchImage(url) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) return null
  if (!(res.headers.get('content-type') || '').startsWith('image/')) return null
  const buf = Buffer.from(await res.arrayBuffer())
  return buf.length && buf.length <= MAX_PHOTO_BYTES ? buf : null
}

/** A Drive photo's bytes: the 2400px rendition if Drive offers it, else the original. */
export async function fetchDrivePhoto(id) {
  if (!/^[\w-]{10,}$/.test(id || '')) throw new AdminError(400, 'Bad Drive file id.')
  const c = config()
  const small = await fetchImage(`${c.drivePhotos}/thumbnail?id=${id}&sz=w2400`).catch(() => null)
  if (small) return small
  if (c.googleKey) {
    const original = await fetchImage(`${c.googleApi}/drive/v3/files/${id}?alt=media&key=${encodeURIComponent(c.googleKey)}`).catch(() => null)
    if (original) return original
  }
  throw new AdminError(502, 'Could not download this photo from Drive. Is the folder shared as "Anyone with the link"?')
}

// ---------------- GitHub publishing ----------------

async function gh(path, { method = 'GET', body, accept = 'application/vnd.github+json' } = {}) {
  const c = config()
  const res = await fetch(`${c.githubApi}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${c.githubToken}`,
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'pcr-indexer',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res
}

async function ghJson(path, opts) {
  const res = await gh(path, opts)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401) throw new AdminError(502, 'GitHub rejected the token (GITHUB_TOKEN in Vercel).')
    if (res.status === 403 || res.status === 404)
      throw new AdminError(502, `GitHub refused: ${body.message || res.status}. The token needs Contents: Read and write on this repo.`)
    const err = new AdminError(502, `GitHub error: ${body.message || res.status}`)
    err.githubStatus = res.status
    throw err
  }
  return body
}

function emptyIndex() {
  return { version: 1, model: 'face-api: ssd_mobilenetv1 + face_recognition (128-d)', updated: null, photos: [] }
}

function applyChange(index, change) {
  const photos = index.photos || []
  if (change.remove) {
    return { ...index, photos: photos.filter((p) => p.event !== change.remove) }
  }
  const { event, date, photos: added } = change.upsert
  const names = new Set(added.map((p) => p.name))
  const keep = photos.filter((p) => !(p.event === event && names.has(p.name)))
  return {
    ...index,
    photos: [...keep, ...added.map((p) => ({ event, date, name: p.name, src: { drive: p.id }, w: p.w, h: p.h, faces: p.faces }))],
  }
}

/** Read faces.json from GitHub, apply the change, and commit it. Retries if main moved meanwhile. */
export async function publish(change, message) {
  const c = config()
  if (!c.githubToken) throw new AdminError(503, 'Publishing is not set up yet (GITHUB_TOKEN in Vercel).')
  const [owner, repo] = c.repo.split('/')
  const base = `/repos/${owner}/${repo}`

  for (let attempt = 1; attempt <= 3; attempt++) {
    const ref = await ghJson(`${base}/git/ref/heads/${encodeURIComponent(c.branch)}`)
    const parent = ref.object.sha
    const commit = await ghJson(`${base}/git/commits/${parent}`)

    const raw = await gh(`${base}/contents/${c.indexPath}?ref=${parent}`, { accept: 'application/vnd.github.raw+json' })
    let index = emptyIndex()
    if (raw.ok) index = JSON.parse(await raw.text())
    else if (raw.status !== 404) throw new AdminError(502, `Couldn't read the current index from GitHub (${raw.status}).`)

    const next = { ...applyChange(index, change), updated: new Date().toISOString() }
    const blob = await ghJson(`${base}/git/blobs`, { method: 'POST', body: { content: JSON.stringify(next), encoding: 'utf-8' } })
    const tree = await ghJson(`${base}/git/trees`, {
      method: 'POST',
      body: { base_tree: commit.tree.sha, tree: [{ path: c.indexPath, mode: '100644', type: 'blob', sha: blob.sha }] },
    })
    const created = await ghJson(`${base}/git/commits`, {
      method: 'POST',
      body: { message, tree: tree.sha, parents: [parent], author: { name: 'PhotoCircle indexer', email: 'indexer@photocircle-rait.invalid' } },
    })
    try {
      await ghJson(`${base}/git/refs/heads/${encodeURIComponent(c.branch)}`, { method: 'PATCH', body: { sha: created.sha, force: false } })
    } catch (e) {
      if (e.githubStatus === 422 && attempt < 3) continue // someone else pushed; rebuild on the new head
      throw e
    }
    return {
      commit: created.sha,
      url: `https://github.com/${owner}/${repo}/commit/${created.sha}`,
      photos: next.photos.length,
      faces: next.photos.reduce((n, p) => n + (p.faces?.length || 0), 0),
    }
  }
  throw new AdminError(409, 'The repository kept changing; please publish again.')
}
