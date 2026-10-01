import { useEffect, useMemo, useRef, useState } from 'react'
import { DownloadSimple, MagnifyingGlass, ShareNetwork } from '@phosphor-icons/react'
import SelfieInput from '../components/SelfieInput.jsx'
import { club } from '../data/site.js'
import { downloadUrl, eventsOf, fetchIndex, fileToCanvas, photoUrl, shareUrl } from '../lib/faces.js'

// Euclidean distance between 128-d face descriptors. The model's textbook cut-off is 0.6;
// on low-light stage photos strangers start appearing above ~0.55, so presets sit lower.
const TOLERANCE_PRESETS = [
  { label: 'Strict', value: 0.46, hint: 'Fewer results, near-certain matches' },
  { label: 'Balanced', value: 0.52, hint: 'Recommended for event galleries' },
  { label: 'Loose', value: 0.58, hint: 'More results, some false positives' },
]

const PHASES = {
  upload: 'Sending your selfie.',
  match: 'Finding your face and comparing it with every face in the archive.',
}

const MAX_UPLOAD = 3.5 * 1024 * 1024 // base64 adds a third; Vercel caps bodies at 4.5 MB

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Shrink the selfie on the phone before upload; send the original if that fails. */
async function selfieForUpload(file) {
  try {
    const { canvas } = await fileToCanvas(file, 1280)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (blob) return readAsDataUrl(blob)
  } catch {
    /* fall back to the original file; the server can decode and rotate it */
  }
  if (file.size > MAX_UPLOAD) throw new Error('That photo is too large to send. Try a screenshot of it, or the camera button.')
  return readAsDataUrl(file)
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[4/5] bg-gradient-to-r from-smoke via-bone/5 to-smoke motion-safe:animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  )
}

function ResultCard({ match }) {
  const { photo, confidence } = match
  const [broken, setBroken] = useState(false)

  const share = async () => {
    const link = shareUrl(photo)
    if (navigator.share) {
      try {
        await navigator.share({ title: photo.event || 'PhotoCircle RAIT', url: link })
        return
      } catch {
        /* user dismissed the share sheet */
      }
    }
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      window.prompt('Copy this link', link)
    }
  }

  return (
    <figure className="group relative aspect-[4/5] overflow-hidden bg-smoke">
      {!broken ? (
        <img
          src={photoUrl(photo, 900)}
          alt={photo.event ? `${photo.event}, ${photo.name}` : photo.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-coal text-sm text-ash">Photo unavailable</div>
      )}

      <span className="absolute left-3 top-3 bg-ink/80 px-2 py-1 text-xs font-semibold text-flame backdrop-blur">
        {Math.round(confidence * 100)}% match
      </span>

      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-ink/95 via-ink/20 to-transparent p-4 opacity-0 transition-opacity duration-300 focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        <p className="font-display text-lg uppercase text-flame">{photo.event || 'Unsorted'}</p>
        <p className="mt-0.5 truncate text-xs text-bone/70">{photo.date || photo.name}</p>
        <div className="mt-3 flex gap-2">
          <a
            href={downloadUrl(photo)}
            download={photo.name}
            target={photo.src.drive ? '_blank' : undefined}
            rel="noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 bg-flame py-2.5 text-xs font-semibold text-ink active:scale-[0.98]"
          >
            <DownloadSimple size={16} weight="bold" />
            Download
          </a>
          <button
            type="button"
            onClick={share}
            className="flex flex-1 items-center justify-center gap-1.5 border border-bone/40 py-2.5 text-xs font-semibold text-bone hover:bg-bone hover:text-ink active:scale-[0.98]"
          >
            <ShareNetwork size={16} weight="bold" />
            Share
          </button>
        </div>
      </div>
    </figure>
  )
}

export default function FaceSearch() {
  const [index, setIndex] = useState(null)
  const [indexError, setIndexError] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [tolerance, setTolerance] = useState(0.52)
  const [event, setEvent] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [phase, setPhase] = useState('upload')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const resultsRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    fetchIndex()
      .then((idx) => !cancelled && setIndex(idx))
      .catch((e) => !cancelled && setIndexError(e.message))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!file) {
      setPreview('')
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const events = useMemo(() => (index ? eventsOf(index) : []), [index])
  const empty = index !== null && index.photos.length === 0
  const unavailable = empty || Boolean(indexError)

  const pick = (f) => {
    setFile(f)
    setResult(null)
    setError('')
    setStatus('idle')
  }

  const run = async () => {
    if (!file || !index) return
    setStatus('loading')
    setPhase('upload')
    setError('')
    try {
      const image = await selfieForUpload(file)
      setPhase('match')
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, tolerance, event }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.detail || `Search failed (${res.status}). Please try again.`)
      setResult(body)
      setStatus('done')
      // On phones the results sit below the controls, so bring them into view.
      if (window.matchMedia('(max-width: 1023px)').matches) {
        requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      }
    } catch (e) {
      setError(e.message === 'Failed to fetch' ? 'No connection to the search server. Check your internet and try again.' : e.message || 'Search failed.')
      setStatus('error')
    }
  }

  const reset = () => {
    setFile(null)
    setResult(null)
    setStatus('idle')
    setError('')
  }

  const matches = result?.matches || []
  const eventCount = new Set(matches.map((m) => m.photo.event || 'Unsorted')).size
  const summary =
    status !== 'done'
      ? ''
      : matches.length
        ? `${matches.length} photo${matches.length === 1 ? '' : 's'} across ${eventCount} event${eventCount === 1 ? '' : 's'}.`
        : 'No matches yet. Try the Loose setting, or a photo where your face is larger.'

  return (
    <div className="pt-24 sm:pt-28">
      <section className="shell py-12 sm:py-16">
        <p className="eyebrow">Face search</p>
        <h1 className="display mt-4 text-5xl sm:text-7xl">
          Find <span className="text-flame">yourself</span>
          <br />
          in the archive
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-ash">
          Upload a selfie or use your camera. We match it against every face from past events and hand you the
          full-resolution frames to download and share.
        </p>
      </section>

      {unavailable && (
        <section className="shell">
          <div className="border border-flame/40 bg-flame/5 p-5">
            <p className="text-sm font-semibold text-flame">Face search is coming soon</p>
            <p className="mt-2 text-sm text-bone/75">
              We&apos;re indexing the archive. Until then, catch every event&apos;s photos on Instagram at{' '}
              <a href={club.instagram} target="_blank" rel="noreferrer" className="text-flame underline-offset-4 hover:underline">
                {club.handle}
              </a>
              .
            </p>
          </div>
        </section>
      )}

      <section className="shell grid gap-10 py-10 lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-16">
        {/* Controls */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          {!file ? (
            <SelfieInput onPick={pick} disabled={status === 'loading'} />
          ) : (
            <div className="border border-bone/15 bg-coal p-4">
              <div className="aspect-square overflow-hidden bg-ink">
                <img src={preview} alt="Your selfie" className="h-full w-full object-cover" />
              </div>
              <button
                type="button"
                onClick={reset}
                disabled={status === 'loading'}
                className="mt-4 w-full border border-bone/20 py-3 text-sm font-medium text-bone/80 hover:border-bone/50 hover:text-bone disabled:opacity-50"
              >
                Choose another
              </button>
            </div>
          )}

          <div className="mt-6">
            <p id="strictness-label" className="text-sm font-semibold text-bone">
              Match strictness
            </p>
            <div role="group" aria-labelledby="strictness-label" className="mt-3 grid grid-cols-3 gap-2">
              {TOLERANCE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  title={p.hint}
                  onClick={() => setTolerance(p.value)}
                  aria-pressed={tolerance === p.value}
                  className={`border py-2.5 text-sm font-medium transition-colors active:scale-[0.98] ${
                    tolerance === p.value ? 'border-flame bg-flame text-ink' : 'border-bone/20 text-bone/75 hover:border-bone/50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ash">{TOLERANCE_PRESETS.find((p) => p.value === tolerance)?.hint}</p>
          </div>

          {events.length > 0 && (
            <div className="mt-6">
              <label htmlFor="event-filter" className="text-sm font-semibold text-bone">
                Event
              </label>
              <select
                id="event-filter"
                value={event}
                onChange={(e) => setEvent(e.target.value)}
                className="mt-3 w-full border border-bone/20 bg-coal px-3 py-3 text-sm text-bone focus:border-flame"
              >
                <option value="">All events</option>
                {events.map((e) => (
                  <option key={e.name} value={e.name}>
                    {e.name} ({e.photo_count})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={run}
            disabled={!file || status === 'loading' || !index || unavailable}
            className="btn-primary mt-6 w-full disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-bone/15 disabled:text-bone/50"
          >
            <MagnifyingGlass size={18} weight="bold" />
            {unavailable ? 'Search coming soon' : status === 'loading' ? 'Searching' : 'Search the archive'}
          </button>

          <p className="mt-4 text-xs leading-relaxed text-ash">
            Your selfie is used only for this search and is never stored.
          </p>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="min-h-[300px] scroll-mt-24">
          {status === 'loading' && (
            <>
              <p role="status" className="mb-6 text-sm font-semibold text-flame">
                {PHASES[phase]}
              </p>
              <Skeleton />
            </>
          )}

          {status === 'error' && (
            <div role="alert" className="border border-flame/40 bg-flame/5 p-6">
              <p className="text-base font-semibold text-flame">Couldn&apos;t search</p>
              <p className="mt-2 text-sm text-bone/75">{error}</p>
            </div>
          )}

          {status === 'done' && (
            <>
              <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3 border-b border-bone/10 pb-4">
                <p className="font-display text-3xl uppercase">
                  {matches.length} <span className="text-flame">result{matches.length === 1 ? '' : 's'}</span>
                </p>
                <p className="text-sm text-ash">{summary}</p>
              </div>
              {matches.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                  {matches.map((m) => (
                    <ResultCard key={`${m.photo.event}/${m.photo.name}`} match={m} />
                  ))}
                </div>
              )}
            </>
          )}

          {status === 'idle' && (
            <div className="space-y-8">
              <div className="border border-bone/10 bg-coal p-6">
                <h2 className="text-base font-semibold text-bone">How it works</h2>
                <ol className="mt-5 space-y-4">
                  {[
                    ['Index', 'We scan every event photo and store a face signature for each person in it.'],
                    ['Match', 'Your selfie becomes the same kind of signature and is compared with all of them.'],
                    ['Download', 'Every frame you appear in comes back, best match first, ready to save or share.'],
                  ].map(([label, step]) => (
                    <li key={label} className="grid grid-cols-[6.5rem_1fr] items-baseline gap-4">
                      <span className="font-display text-xl uppercase text-flame">{label}</span>
                      <span className="text-sm leading-relaxed text-bone/75">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {index?.photos.length > 0 && (
                <div>
                  <h2 className="text-base font-semibold text-bone">In the archive right now</h2>
                  <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                    {index.photos.slice(0, 12).map((p) => (
                      <img
                        key={`${p.event}/${p.name}`}
                        src={photoUrl(p, 300)}
                        alt={`${p.event}, ${p.name}`}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="aspect-square w-full object-cover opacity-60 transition-opacity hover:opacity-100"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
