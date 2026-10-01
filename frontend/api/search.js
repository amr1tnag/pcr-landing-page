import { matchSelfie, PhotoError } from '../server/matcher.js'

const MAX_BYTES = 4 * 1024 * 1024 // Vercel caps request bodies at 4.5 MB

const PROBLEMS = {
  none: 'No face found in that photo. Try a brighter, front-facing shot.',
  unclear: 'Your face is too small or unclear in that photo. Use a closer, front-facing selfie in good light.',
}

/** POST { image: base64 or data URL, tolerance?, event? } -> { matches, faces } */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ detail: 'Use POST.' })
  }

  const { image, tolerance, event } = req.body || {}
  if (typeof image !== 'string' || !image) {
    return res.status(400).json({ detail: 'Send a photo to search with.' })
  }
  const buffer = Buffer.from(image.replace(/^data:[^,]*,/, ''), 'base64')
  if (!buffer.length) return res.status(400).json({ detail: 'The photo was empty.' })
  if (buffer.length > MAX_BYTES) return res.status(413).json({ detail: 'That photo is too large. Try a smaller one.' })

  const tol = Math.min(0.65, Math.max(0.35, Number(tolerance) || 0.52))

  try {
    const result = await matchSelfie(buffer, { tolerance: tol, event: typeof event === 'string' ? event : '' })
    if (result.problem) return res.status(422).json({ detail: PROBLEMS[result.problem] })
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json(result)
  } catch (e) {
    if (e instanceof PhotoError) return res.status(400).json({ detail: e.message })
    console.error('search failed', e)
    return res.status(500).json({ detail: 'Search failed on the server. Please try again.' })
  }
}
