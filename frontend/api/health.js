import { status } from '../server/matcher.js'

export default async function handler(req, res) {
  try {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json(await status())
  } catch (e) {
    console.error('health failed', e)
    return res.status(500).json({ status: 'error', detail: String(e?.message || e) })
  }
}
