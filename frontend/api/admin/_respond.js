import { AdminError } from '../../server/admin.js'
import { PhotoError } from '../../server/matcher.js'

/** Shared POST-only wrapper: JSON in, JSON out, friendly errors. */
export function adminRoute(fn) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ detail: 'Use POST.' })
    }
    try {
      return res.status(200).json(await fn(req.body || {}))
    } catch (e) {
      if (e instanceof AdminError) return res.status(e.status).json({ detail: e.message })
      if (e instanceof PhotoError) return res.status(422).json({ detail: e.message })
      console.error('admin route failed', e)
      return res.status(500).json({ detail: 'Something went wrong on the server. Please try again.' })
    }
  }
}
