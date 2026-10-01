import { useEffect, useMemo, useRef, useState } from 'react'
import { api, assetUrl } from '../api.js'
import { club } from '../data/site.js'
import { DownloadSimple, MagnifyingGlass, ShareNetwork } from '@phosphor-icons/react'
import SelfieInput from '../components/SelfieInput.jsx'

const TOLERANCE_PRESETS = [
  { label: 'Strict', value: 0.42, hint: 'Fewer results, near-certain matches' },
  { label: 'Balanced', value: 0.5, hint: 'Recommended for event galleries' },
  { label: 'Loose', value: 0.58, hint: 'More results, some false positives' },
]

function Skeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[4/5] animate-pulse bg-gradient-to-r from-smoke via-white/5 to-smoke"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  )
}

function ResultCard({ photo }) {
  const url = assetUrl(photo.url)
  const [broken, setBroken] = useState(false)

  const share = async () => {
    const absolute = new URL(url, window.location.origin).href
    if (navigator.share) {
      try {
        await navigator.share({ title: photo.event || 'PhotoCircle RAIT', url: absolute })
        return
      } catch {
        /* user dismissed the share sheet */
      }
    }
    try {
      await navigator.clipboard.writeText(absolute)
    } catch {
      window.prompt('Copy this link', absolute)
    }
  }

  return (
    <figure className="group relative aspect-[4/5] overflow-hidden bg-smoke">
      {!broken ? (
        <img
          src={url}
          alt={photo.event ? `${photo.event}, ${photo.filename}` : photo.filename}
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-coal text-sm text-ash">
          File missing
        </div>
      )}

      {typeof photo.confidence === 'number' && (
        <span className="absolute left-3 top-3 bg-ink/80 px-2 py-1 text-xs font-semibold text-flame backdrop-blur">
          {Math.round(photo.confidence * 100)}% match
        </span>
      )}

      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 focus-within:opacity-100">
        <p className="font-display text-lg uppercase text-flame">{photo.event || 'Unsorted'}</p>
        <p className="mt-0.5 truncate text-xs text-bone/70">
          {photo.date ? `${photo.date} · ` : ''}
          {photo.filename}
        </p>
        <div className="mt-3 flex gap-2">
          <a
            href={assetUrl(`/api/photos/${photo.id}/download`)}
            download={photo.filename}
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
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [tolerance, setTolerance] = useState(0.5)
  const [event, setEvent] = useState('')
  const [events, setEvents] = useState([])
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [offline, setOffline] = useState(false)
  const [library, setLibrary] = useState([])
  const resultsRef = useRef(null)

  // Load the indexed-event list and a browse-all strip on mount.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [evts, photos] = await Promise.all([api.events(), api.photos({ limit: 12 })])
        if (cancelled) return
        setEvents(evts.events || [])
        setLibrary(photos.photos || [])
        setOffline(false)
      } catch {
        if (!cancelled) setOffline(true)
      }
    })()
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

  const pick = (f) => {
    setFile(f)
    setResult(null)
    setError('')
    setStatus('idle')
  }

  const run = async () => {
    if (!file) return
    setStatus('loading')
    setError('')
    try {
      const data = await api.search(file, { tolerance, event })
      setResult(data)
      setStatus('done')
      // On phones the results sit below the controls, so bring them into view.
      if (window.matchMedia('(max-width: 1023px)').matches) {
        requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      }
    } catch (e) {
      setError(e.message || 'Search failed')
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
  const summary = useMemo(() => {
    if (status !== 'done') return ''
    if (!matches.length) return 'No matches yet. Try the Loose setting, or a photo where your face is larger.'
    return `${matches.length} photo${matches.length === 1 ? '' : 's'} found across ${
      new Set(matches.map((m) => m.event || 'Unsorted')).size
    } event${new Set(matches.map((m) => m.event || 'Unsorted')).size === 1 ? '' : 's'}.`
  }, [status, matches])

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
          Upload a selfie or use your camera. We match it against every face we have indexed from past events and
          hand you the full-resolution frames to download and share.
        </p>
      </section>

      {offline && (
        <section className="shell">
          <div className="border border-flame/40 bg-flame/5 p-5">
            {import.meta.env.DEV ? (
              <>
                <p className="text-sm font-semibold text-flame">Index offline</p>
                <p className="mt-2 text-sm text-bone/75">
                  The search service isn&apos;t reachable. Start it with{' '}
                  <code className="bg-ink px-1.5 py-0.5 text-flame">uvicorn app.main:app --reload</code> from the{' '}
                  <code className="bg-ink px-1.5 py-0.5 text-flame">backend/</code> folder.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-flame">Face search is coming soon</p>
                <p className="mt-2 text-sm text-bone/75">
                  We&apos;re indexing the archive. Until then, catch every event&apos;s photos on Instagram at{' '}
                  <a href={club.instagram} target="_blank" rel="noreferrer" className="text-flame underline-offset-4 hover:underline">
                    {club.handle}
                  </a>
                  .
                </p>
              </>
            )}
          </div>
        </section>
      )}

      <section className="shell grid gap-10 py-10 lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-16">
        {/* Controls */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          {!file ? (
            <SelfieInput onPick={pick} disabled={status === 'loading'} />
          ) : (
            <div className="border border-white/15 bg-coal p-4">
              <div className="aspect-square overflow-hidden bg-ink">
                <img src={preview} alt="Your selfie" className="h-full w-full object-cover" />
              </div>
              <button
                type="button"
                onClick={reset}
                className="mt-4 w-full border border-bone/20 py-3 text-sm font-medium text-bone/80 hover:border-bone/50 hover:text-bone"
              >
                Choose another
              </button>
            </div>
          )}

          <div className="mt-6">
            <p id="strictness-label" className="text-sm font-semibold text-bone">Match strictness</p>
            <div role="group" aria-labelledby="strictness-label" className="mt-3 grid grid-cols-3 gap-2">
              {TOLERANCE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  title={p.hint}
                  onClick={() => setTolerance(p.value)}
                  aria-pressed={tolerance === p.value}
                  className={`border py-2.5 text-sm font-medium transition-colors active:scale-[0.98] ${
                    tolerance === p.value
                      ? 'border-flame bg-flame text-ink'
                      : 'border-bone/20 text-bone/75 hover:border-bone/50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ash">
              {TOLERANCE_PRESETS.find((p) => p.value === tolerance)?.hint}
            </p>
          </div>

          {events.length > 0 && (
            <div className="mt-6">
              <label htmlFor="event-filter" className="text-sm font-semibold text-bone">Event</label>
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
            disabled={!file || status === 'loading' || (offline && !import.meta.env.DEV)}
            className="btn-primary mt-6 w-full disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-bone/15 disabled:text-bone/50"
          >
            <MagnifyingGlass size={18} weight="bold" />
            {offline && !import.meta.env.DEV
              ? 'Search coming soon'
              : status === 'loading'
                ? 'Scanning the archive…'
                : 'Search the archive'}
          </button>

          <p className="mt-4 text-xs leading-relaxed text-ash">
            Your selfie is used for this search only. It is matched in memory and never saved.
          </p>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="min-h-[300px] scroll-mt-24">
          {status === 'loading' && (
            <>
              <p className="mb-6 text-sm font-semibold text-flame">
                Comparing faces across the index…
              </p>
              <Skeleton />
            </>
          )}

          {status === 'error' && (
            <div className="border border-flame/40 bg-flame/5 p-6">
              <p className="text-base font-semibold text-flame">Couldn&apos;t search</p>
              <p className="mt-2 text-sm text-bone/75">{error}</p>
            </div>
          )}

          {status === 'done' && (
            <>
              <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3 border-b border-white/10 pb-4">
                <p className="font-display text-2xl uppercase">
                  {matches.length} <span className="text-flame">result{matches.length === 1 ? '' : 's'}</span>
                </p>
                <p className="text-sm text-ash">{summary}</p>
              </div>
              {matches.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                  {matches.map((m) => (
                    <ResultCard key={m.id} photo={m} />
                  ))}
                </div>
              ) : null}
            </>
          )}

          {status === 'idle' && (
            <div className="space-y-8">
              <div className="border border-white/10 bg-coal p-6">
                <h2 className="text-base font-semibold text-bone">How it works</h2>
                <ol className="mt-5 space-y-4">
                  {[
                    ['Index', 'We scan every event photo and store a face signature for each person in it.'],
                    ['Match', 'Your selfie becomes the same kind of signature, in memory, and is compared to all of them.'],
                    ['Download', 'Every frame you appear in comes back, best match first, ready to save or share.'],
                  ].map(([label, step]) => (
                    <li key={label} className="grid grid-cols-[6.5rem_1fr] items-baseline gap-4">
                      <span className="font-display text-xl uppercase text-flame">{label}</span>
                      <span className="text-sm leading-relaxed text-bone/75">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {library.length > 0 && (
                <div>
                  <h2 className="text-base font-semibold text-bone">In the archive right now</h2>
                  <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                    {library.map((p) => (
                      <img
                        key={p.id}
                        src={assetUrl(p.url)}
                        alt={p.filename}
                        loading="lazy"
                        className="aspect-square w-full object-cover opacity-50 transition-opacity hover:opacity-100"
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
