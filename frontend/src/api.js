// Thin API client. In dev, Vite proxies /api and /photos to the FastAPI server.
const BASE = import.meta.env.VITE_API_BASE || ''

async function json(res) {
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.detail) detail = body.detail
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail)
  }
  return res.json()
}

export const api = {
  async health() {
    return json(await fetch(`${BASE}/api/health`))
  },

  async events() {
    return json(await fetch(`${BASE}/api/events`))
  },

  async photos({ event = '', limit = 60 } = {}) {
    const q = new URLSearchParams({ limit: String(limit) })
    if (event) q.set('event', event)
    return json(await fetch(`${BASE}/api/photos?${q}`))
  },

  async search(file, { tolerance = 0.5, event = '', limit = 60 } = {}) {
    const form = new FormData()
    form.append('file', file)
    form.append('tolerance', String(tolerance))
    form.append('limit', String(limit))
    if (event) form.append('event', event)
    return json(await fetch(`${BASE}/api/search`, { method: 'POST', body: form }))
  },
}

export const assetUrl = (path) => `${BASE}${path}`
