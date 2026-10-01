// Server-side face search for the Vercel functions in /api. It uses the same
// face-api model (on TensorFlow.js + WebAssembly, no native builds) that built
// public/data/faces.json, so signatures from the indexer stay comparable.
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const require = createRequire(import.meta.url)
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const MODELS = path.join(ROOT, 'server', 'models')
const INDEX = path.join(ROOT, 'public', 'data', 'faces.json')

// Same gates as the browser version (see src/lib/faces.js).
const SELFIE_MAX_EDGE = 1024
const SELFIE_MIN_SIDE = 64
const SELFIE_MIN_SCORE = 0.5

let enginePromise = null
let indexPromise = null

function engine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js')
      // WebAssembly reads its .wasm binary from node_modules (bundled via
      // includeFiles in vercel.json). If that ever fails, plain JS still works.
      let ok = false
      try {
        ok = await faceapi.tf.setBackend('wasm')
      } catch (e) {
        console.warn('wasm backend unavailable, using cpu', e?.message)
      }
      if (!ok) await faceapi.tf.setBackend('cpu')
      await faceapi.tf.ready()
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS),
        faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS),
        faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS),
        faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS),
      ])
      return faceapi
    })().catch((e) => {
      enginePromise = null // allow a retry on the next request
      throw e
    })
  }
  return enginePromise
}

function fromB64(b64) {
  const bytes = new Uint8Array(Buffer.from(b64, 'base64')) // copy: keeps the Float32 view aligned
  return new Float32Array(bytes.buffer)
}

function loadIndex() {
  if (!indexPromise) {
    indexPromise = readFile(INDEX, 'utf8').then((text) => {
      const index = JSON.parse(text)
      for (const photo of index.photos) photo._descriptors = photo.faces.map(fromB64)
      return index
    })
  }
  return indexPromise
}

/** Decode any common photo, apply its EXIF rotation, and downscale it. */
async function toTensor(faceapi, buffer, maxEdge = SELFIE_MAX_EDGE) {
  const { data, info } = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true })
  return faceapi.tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32')
}

async function detect(faceapi, input, detector) {
  const options =
    detector === 'ssd'
      ? new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4, maxResults: 50 })
      : new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })
  const found = await faceapi.detectAllFaces(input, options).withFaceLandmarks().withFaceDescriptors()
  return found.map((f) => {
    const b = f.detection.box
    return { descriptor: f.descriptor, score: f.detection.score, side: Math.min(b.width, b.height), area: b.width * b.height }
  })
}

function distance(a, b) {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

export class PhotoError extends Error {}

/**
 * Find a selfie's face and every indexed photo containing it.
 * Returns { problem: 'none' | 'unclear' } or { matches, faces }.
 */
export async function matchSelfie(buffer, { tolerance = 0.52, event = '' } = {}) {
  const [faceapi, index] = await Promise.all([engine(), loadIndex()])

  let tensor
  try {
    tensor = await toTensor(faceapi, buffer)
  } catch {
    throw new PhotoError("That photo couldn't be opened. Try a JPEG or PNG, or use the camera button.")
  }

  let faces = []
  try {
    for (const detector of ['tiny', 'ssd']) {
      faces = await detect(faceapi, tensor, detector)
      if (faces.length) break
    }
  } finally {
    tensor.dispose()
  }

  if (!faces.length) return { problem: 'none' }
  const best = faces.sort((a, b) => b.area - a.area)[0]
  if (best.side < SELFIE_MIN_SIDE || best.score < SELFIE_MIN_SCORE) return { problem: 'unclear' }

  const matches = []
  let compared = 0
  for (const photo of index.photos) {
    if (event && photo.event !== event) continue
    let min = Infinity
    for (const d of photo._descriptors) {
      compared += 1
      const dist = distance(best.descriptor, d)
      if (dist < min) min = dist
    }
    if (min <= tolerance) {
      const { event: ev, date, name, src, w, h } = photo
      matches.push({
        photo: { event: ev, date, name, src, w, h },
        distance: Number(min.toFixed(4)),
        confidence: Number(Math.max(0, Math.min(1, 1 - min / (tolerance * 2))).toFixed(4)),
      })
    }
  }
  matches.sort((a, b) => a.distance - b.distance)
  return { matches, faces: compared }
}

/** For /api/health: is the model loadable, and how big is the index? */
export async function status() {
  const [faceapi, index] = await Promise.all([engine(), loadIndex()])
  return {
    status: 'ok',
    backend: faceapi.tf.getBackend(),
    photos: index.photos.length,
    faces: index.photos.reduce((n, p) => n + p.faces.length, 0),
  }
}

// ---- indexing (used by /api/admin/index-photo) ----

const INDEX_MAX_EDGE = 2400

// Overlapping crops: SSD shrinks its input to 512px, so small crowd faces need tiles.
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

function overlap(a, b) {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  return (ix * iy) / Math.min(a.w * a.h, b.w * b.h)
}

// Measured on the club's photos: a helmeted batter came out at 32px / 0.43 (junk),
// a side-lit singer at 106px / 0.44 (real). Small faces must be confident; doubtful ones large.
function usableForIndex(face) {
  if (face.side < 24) return false
  return face.score >= 0.6 || face.side >= 60
}

function toB64(f32) {
  return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength).toString('base64')
}

/** Every usable face in an event photo, as base64 signatures for faces.json. */
export async function indexPhoto(buffer) {
  const faceapi = await engine()
  let tensor
  try {
    tensor = await toTensor(faceapi, buffer, INDEX_MAX_EDGE)
  } catch {
    throw new PhotoError("That file couldn't be opened as a photo.")
  }
  const [h, w] = tensor.shape
  const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4, maxResults: 200 })
  const found = []
  try {
    for (const region of tiles(w, h)) {
      const crop = region.w === w && region.h === h ? tensor : faceapi.tf.slice(tensor, [region.y, region.x, 0], [region.h, region.w, 3])
      try {
        const results = await faceapi.detectAllFaces(crop, options).withFaceLandmarks().withFaceDescriptors()
        for (const f of results) {
          const b = f.detection.box
          found.push({
            descriptor: f.descriptor,
            score: f.detection.score,
            box: { x: b.x + region.x, y: b.y + region.y, w: b.width, h: b.height },
          })
        }
      } finally {
        if (crop !== tensor) crop.dispose()
      }
    }
  } finally {
    tensor.dispose()
  }
  found.sort((a, b) => b.score - a.score)
  const kept = []
  for (const f of found) if (!kept.some((k) => overlap(k.box, f.box) > 0.5)) kept.push(f)
  const faces = kept
    .map((f) => ({ ...f, side: Math.min(f.box.w, f.box.h) }))
    .filter(usableForIndex)
    .map((f) => toB64(f.descriptor))
  return { w, h, faces }
}
