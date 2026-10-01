import { adminRoute } from './_respond.js'
import { AdminError, publish, requireAdmin } from '../../server/admin.js'

const clean = (s, max = 80) => String(s || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max)

/**
 * { password, upsert: { event, date, photos: [{ id, name, w, h, faces }] } }
 * or { password, remove: event }  ->  { commit, url, photos, faces }
 */
export default adminRoute(async ({ password, upsert, remove }) => {
  requireAdmin(password)
  if (remove) {
    const event = clean(remove)
    return publish({ remove: event }, `Remove "${event}" from face search`)
  }
  if (!upsert || !Array.isArray(upsert.photos) || !upsert.photos.length) throw new AdminError(400, 'Nothing to publish.')
  const event = clean(upsert.event)
  if (!event) throw new AdminError(400, 'The event needs a name.')
  const date = /^\d{4}-\d{2}-\d{2}$/.test(upsert.date || '') ? upsert.date : ''
  const photos = upsert.photos
    .filter((p) => /^[\w-]{10,}$/.test(p.id || '') && Array.isArray(p.faces))
    .map((p) => ({
      id: p.id,
      name: clean(p.name, 200),
      w: Number(p.w) || 0,
      h: Number(p.h) || 0,
      faces: p.faces.filter((f) => typeof f === 'string' && f.length === 684), // 128 float32 in base64
    }))
  if (!photos.length) throw new AdminError(400, 'Nothing valid to publish.')
  const faces = photos.reduce((n, p) => n + p.faces.length, 0)
  return publish({ upsert: { event, date, photos } }, `Index "${event}" for face search (${photos.length} photos, ${faces} faces)`)
})
