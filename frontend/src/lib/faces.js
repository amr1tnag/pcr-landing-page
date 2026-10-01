// Client helpers for face search. Detection and matching run on the server
// (/api/search and /api/admin/*, see server/); the browser only loads the
// public index, shrinks selfies before upload, and builds photo links.

export const INDEX_URL = '/data/faces.json'

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
    const e = map.get(p.event) || { name: p.event, date: p.date, photo_count: 0, face_count: 0 }
    e.photo_count += 1
    e.face_count += p.faces?.length || 0
    if ((p.date || '') > (e.date || '')) e.date = p.date
    map.set(p.event, e)
  }
  return [...map.values()].sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.name.localeCompare(b.name))
}

// ---- photo decoding (selfie upload) ----

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
export async function fileToCanvas(file, maxEdge = 1280) {
  const { source, w, h, done } = await decode(file)
  const scale = Math.min(1, maxEdge / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
  done()
  return { canvas, size: { w, h } }
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

export function parseDriveFolderId(input) {
  const s = (input || '').trim()
  const m = s.match(/folders\/([\w-]{10,})/) || s.match(/[?&]id=([\w-]{10,})/)
  if (m) return m[1]
  if (/^[\w-]{10,}$/.test(s)) return s
  return null
}
