// Face search with no server: detection and matching run in the browser with
// @vladmandic/face-api, whose recognition net is a port of dlib's 128-d ResNet
// (the model behind Python's face_recognition). The library and its weights are
// loaded lazily, so they never touch the landing page's bundle.

const MODEL_URL = '/models'
export const INDEX_URL = '/data/faces.json'
const MAX_EDGE = 2400 // photos are downscaled to this before detection

let libPromise = null
const loaded = new Set()

async function lib() {
  if (!libPromise) {
    libPromise = import('@vladmandic/face-api').then(async (faceapi) => {
      // Fastest first: WebGL (GPU), then WebAssembly, then plain JS. The .wasm
      // binaries are self-hosted in public/wasm (tfjs 4.22, matching face-api).
      faceapi.tf.setWasmPaths?.('/wasm/')
      // iPhones and iPads often run WebGL at reduced float precision, where the
      // detector silently finds nothing, so they start on WebAssembly instead.
      const order = isAppleMobile() ? ['wasm', 'webgl', 'cpu'] : ['webgl', 'wasm', 'cpu']
      for (const backend of order) {
        try {
          if (await faceapi.tf.setBackend(backend)) break
        } catch {
          /* try the next backend */
        }
      }
      await faceapi.tf.ready()
      return faceapi
    })
  }
  return libPromise
}

function isAppleMobile() {
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/**
 * Run a detection task; if WebGL throws or finds nothing, retry once on
 * WebAssembly. Covers GPUs whose precision quietly breaks the detector.
 */
async function withBackendFallback(task) {
  const faceapi = await lib()
  if (faceapi.tf.getBackend() === 'webgl') {
    try {
      const result = await task()
      if (result.length) return result
    } catch {
      /* fall through to WebAssembly */
    }
    try {
      if (await faceapi.tf.setBackend('wasm')) await faceapi.tf.ready()
    } catch {
      return task()
    }
  }
  return task()
}

async function ensureNets(faceapi, detector) {
  const wanted = [detector === 'ssd' ? 'ssdMobilenetv1' : 'tinyFaceDetector', 'faceLandmark68Net', 'faceRecognitionNet']
  await Promise.all(
    wanted
      .filter((name) => !loaded.has(name))
      .map(async (name) => {
        await faceapi.nets[name].loadFromUri(MODEL_URL)
        loaded.add(name)
      })
  )
}

/** Download the library and the weights a detector needs (cached by the browser after the first visit). */
export async function prepare(detector = 'tiny') {
  const faceapi = await lib()
  await ensureNets(faceapi, detector)
  return faceapi
}

// Decode with EXIF rotation applied. createImageBitmap's imageOrientation option
// is missing on older Safari, so fall back to an <img>, which modern browsers
// draw upright.
async function decode(file) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { source: bitmap, w: bitmap.width, h: bitmap.height, done: () => bitmap.close?.() }
  } catch {
    /* try the <img> route */
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return { source: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) }
  } catch {
    URL.revokeObjectURL(url)
    throw new Error("This photo's format can't be opened here (HEIC photos often can't). Try a JPEG, a screenshot of it, or the camera button.")
  }
}

/** Decode a File/Blob into a canvas, EXIF-rotated and capped at maxEdge. */
export async function fileToCanvas(file, maxEdge = MAX_EDGE) {
  const { source, w, h, done } = await decode(file)
  const scale = Math.min(1, maxEdge / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
  done()
  return { canvas, size: { w, h } }
}

function options(faceapi, detector) {
  return detector === 'ssd'
    ? new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4, maxResults: 200 })
    : new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })
}

/** Which backend the model runs on (webgl, wasm or cpu), for diagnostics. */
export async function backendName() {
  return (await lib()).tf.getBackend()
}

/**
 * Overlapping crops covering the image. SSD shrinks its input to 512px, so in a
 * wide crowd shot most faces are too small to find from the whole frame alone.
 */
function tiles(w, h) {
  const regions = [{ x: 0, y: 0, w, h }]
  if (Math.max(w, h) < 900) return regions
  const cols = w >= h ? (w / h > 1.6 ? 3 : 2) : 2
  const rows = h > w ? (h / w > 1.6 ? 3 : 2) : 2
  const tw = Math.min(w, Math.round((w / cols) * 1.3))
  const th = Math.min(h, Math.round((h / rows) * 1.3))
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = Math.round(Math.min(Math.max(0, (c + 0.5) * (w / cols) - tw / 2), w - tw))
      const y = Math.round(Math.min(Math.max(0, (r + 0.5) * (h / rows) - th / 2), h - th))
      regions.push({ x, y, w: tw, h: th })
    }
  }
  return regions
}

function crop(canvas, { x, y, w, h }) {
  if (x === 0 && y === 0 && w === canvas.width && h === canvas.height) return canvas
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h)
  return out
}

// Overlap as a share of the smaller box: a face found in two tiles scores ~1.
function overlap(a, b) {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  return (ix * iy) / Math.min(a.w * a.h, b.w * b.h)
}

/**
 * Every face in an image, as 128-d descriptors. Indexing uses the SSD detector
 * over the whole frame plus overlapping tiles; selfies use the light detector.
 */
export async function encodeAll(canvas, detector = 'ssd') {
  const faceapi = await prepare(detector)
  const regions = detector === 'ssd' ? tiles(canvas.width, canvas.height) : [{ x: 0, y: 0, w: canvas.width, h: canvas.height }]
  const found = []
  for (const region of regions) {
    const results = await faceapi
      .detectAllFaces(crop(canvas, region), options(faceapi, detector))
      .withFaceLandmarks()
      .withFaceDescriptors()
    for (const f of results) {
      const b = f.detection.box
      found.push({
        descriptor: f.descriptor,
        score: f.detection.score,
        box: { x: b.x + region.x, y: b.y + region.y, w: b.width, h: b.height },
      })
    }
  }
  // Keep the most confident detection of each face.
  found.sort((a, b) => b.score - a.score)
  const kept = []
  for (const f of found) if (!kept.some((k) => overlap(k.box, f.box) > 0.5)) kept.push(f)
  return kept.map((f) => ({ descriptor: f.descriptor, score: f.score, side: Math.min(f.box.w, f.box.h), area: f.box.w * f.box.h }))
}

// Signatures from tiny or doubtful faces are close to noise: they match strangers.
// Indexing skips them; a selfie that only has one is sent back for a better photo.
// Measured on the club's stage and sports shots: a helmeted batter came out at
// 32px / 0.43 (junk), a side-lit singer at 106px / 0.44 (a real, matchable face).
// So small faces must be confident, and doubtful faces must be large.
const SELFIE_MIN_SIDE = 64 // px, in the selfie downscaled to 1024
const SELFIE_MIN_SCORE = 0.5

export function usableForIndex(face) {
  if (face.side < 24) return false // px, in the image downscaled to MAX_EDGE
  return face.score >= 0.6 || face.side >= 60
}

/**
 * The descriptor of the most prominent face in a selfie. Tries the small, fast
 * detector first and only downloads the larger one if that finds nothing.
 * Returns { descriptor } or { problem: 'none' | 'unclear' }.
 */
export async function encodeSelfie(file, onPhase = () => {}) {
  const { canvas } = await fileToCanvas(file, 1024)
  let faces = []
  for (const detector of ['tiny', 'ssd']) {
    onPhase(loaded.has(detector === 'ssd' ? 'ssdMobilenetv1' : 'tinyFaceDetector') ? 'detect' : 'model')
    await prepare(detector)
    faces = await withBackendFallback(() => encodeAll(canvas, detector))
    if (faces.length) break
  }
  if (!faces.length) return { problem: 'none' }
  const best = faces.sort((a, b) => b.area - a.area)[0]
  if (best.side < SELFIE_MIN_SIDE || best.score < SELFIE_MIN_SCORE) return { problem: 'unclear' }
  return { descriptor: best.descriptor }
}

// ---- index (de)serialisation: descriptors are stored as base64 Float32 ----

export function toB64(f32) {
  const bytes = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

export function fromB64(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Float32Array(bytes.buffer)
}

export function emptyIndex() {
  return { version: 1, model: 'face-api: ssd_mobilenetv1 + face_recognition (128-d)', updated: null, photos: [] }
}

export async function fetchIndex() {
  const res = await fetch(INDEX_URL, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`Couldn't load the photo index (${res.status}).`)
  const index = await res.json()
  if (!Array.isArray(index.photos)) throw new Error('The photo index is malformed.')
  return index
}

export function eventsOf(index) {
  const map = new Map()
  for (const p of index.photos) {
    const e = map.get(p.event) || { name: p.event, date: p.date, photo_count: 0 }
    e.photo_count += 1
    if (p.date > e.date) e.date = p.date
    map.set(p.event, e)
  }
  return [...map.values()].sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.name.localeCompare(b.name))
}

// ---- matching ----

const decoded = new WeakMap()

function descriptorsOf(photo) {
  let d = decoded.get(photo)
  if (!d) {
    d = photo.faces.map(fromB64)
    decoded.set(photo, d)
  }
  return d
}

function distance(a, b) {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

/** Photos containing a face within `tolerance` of the query, best match first. */
export function search(index, query, { tolerance = 0.5, event = '' } = {}) {
  const matches = []
  let faces = 0
  for (const photo of index.photos) {
    if (event && photo.event !== event) continue
    let best = Infinity
    for (const d of descriptorsOf(photo)) {
      faces += 1
      const dist = distance(query, d)
      if (dist < best) best = dist
    }
    if (best <= tolerance) matches.push({ photo, distance: best, confidence: confidence(best, tolerance) })
  }
  matches.sort((a, b) => a.distance - b.distance)
  return { matches, faces }
}

function confidence(dist, tolerance) {
  return Math.max(0, Math.min(1, 1 - dist / (tolerance * 2)))
}

// ---- where photos live ----

export function photoUrl(photo, width = 1200) {
  if (photo.src.drive) return `https://drive.google.com/thumbnail?id=${photo.src.drive}&sz=w${width}`
  return photo.src.url
}

export function downloadUrl(photo) {
  if (photo.src.drive) return `https://drive.google.com/uc?export=download&id=${photo.src.drive}`
  return photo.src.url
}

export function shareUrl(photo) {
  if (photo.src.drive) return `https://drive.google.com/file/d/${photo.src.drive}/view`
  return new URL(photo.src.url, window.location.origin).href
}

// ---- Google Drive folder listing (indexer only) ----

export function parseDriveFolderId(input) {
  const s = (input || '').trim()
  const m = s.match(/folders\/([\w-]{10,})/) || s.match(/[?&]id=([\w-]{10,})/)
  if (m) return m[1]
  if (/^[\w-]{10,}$/.test(s)) return s
  return null
}

/** Name -> file id for every image in a public Drive folder, via the Drive API and a browser API key. */
export async function listDriveFolder(folderId, apiKey) {
  const files = new Map()
  let pageToken = ''
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
    const url =
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name,mimeType)` +
      `&pageSize=1000&key=${encodeURIComponent(apiKey)}${pageToken ? `&pageToken=${pageToken}` : ''}`
    const res = await fetch(url)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      const reason = body?.error?.message || `HTTP ${res.status}`
      throw new Error(`Google Drive refused the request: ${reason}`)
    }
    for (const f of body.files || []) if (f.mimeType?.startsWith('image/')) files.set(f.name, f.id)
    pageToken = body.nextPageToken || ''
  } while (pageToken)
  return files
}
