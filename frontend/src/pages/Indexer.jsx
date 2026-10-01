import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowSquareOut, CheckCircle, LockSimple, Trash, Warning } from '@phosphor-icons/react'
import { eventsOf, fetchIndex, parseDriveFolderId } from '../lib/faces.js'

const PASS_STORAGE = 'pcr-admin-password'
const CONCURRENCY = 3 // photos indexed in parallel; each is its own short server request
const PUBLISH_BATCH = 150 // photos per commit, keeps each request well under Vercel's 4.5 MB

const stored = () => {
  try {
    return localStorage.getItem(PASS_STORAGE) || ''
  } catch {
    return ''
  }
}

async function post(path, body) {
  let res
  try {
    res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new Error('No connection to the server. Check your internet and try again.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `Server error (${res.status}).`)
  return data
}

const input = 'w-full border border-bone/20 bg-ink px-3 py-3 text-sm text-bone placeholder:text-ash/70 focus:border-accent'

function Field({ label, htmlFor, hint, children }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-bone">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-ash">{hint}</p>}
    </div>
  )
}

export default function Indexer() {
  const [password, setPassword] = useState(stored)
  const [remember, setRemember] = useState(() => Boolean(stored()))
  const [setup, setSetup] = useState(null) // { password, google, github } once signed in
  const [signingIn, setSigningIn] = useState(false)
  const [index, setIndex] = useState(null)
  const [eventName, setEventName] = useState('')
  const [date, setDate] = useState('')
  const [folder, setFolder] = useState('')
  const [state, setState] = useState('idle') // idle | listing | indexing | publishing | done
  const [progress, setProgress] = useState({ done: 0, total: 0, faces: 0 })
  const [failed, setFailed] = useState([])
  const [published, setPublished] = useState(null)
  const [error, setError] = useState('')
  const cancel = useRef(false)

  useEffect(() => {
    const meta = Object.assign(document.createElement('meta'), { name: 'robots', content: 'noindex' })
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  useEffect(() => {
    fetchIndex()
      .then(setIndex)
      .catch(() => setIndex({ photos: [] }))
  }, [])

  const events = useMemo(() => (index ? eventsOf(index) : []), [index])
  const busy = state === 'listing' || state === 'indexing' || state === 'publishing'
  const ready = setup && setup.google && setup.github

  const signIn = async (e) => {
    e?.preventDefault()
    setError('')
    setSigningIn(true)
    try {
      const res = await post('/api/admin/list', { password })
      try {
        localStorage[remember ? 'setItem' : 'removeItem'](PASS_STORAGE, password)
      } catch {
        /* storage unavailable */
      }
      setSetup(res.configured)
    } catch (err) {
      setError(err.message)
    } finally {
      setSigningIn(false)
    }
  }

  // Sign in automatically when a remembered password is present.
  useEffect(() => {
    if (password && remember) signIn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const run = async (e) => {
    e.preventDefault()
    setError('')
    setFailed([])
    setPublished(null)
    const event = eventName.trim()
    if (!event) return setError('Give the event a name.')
    if (!parseDriveFolderId(folder)) return setError('Paste the link to the Google Drive folder.')

    cancel.current = false
    setState('listing')
    let files
    try {
      files = (await post('/api/admin/list', { password, folder })).files
    } catch (err) {
      setState('idle')
      return setError(err.message)
    }

    setState('indexing')
    setProgress({ done: 0, total: files.length, faces: 0 })
    const results = []
    const misses = []
    let next = 0
    let faces = 0
    const worker = async () => {
      while (next < files.length && !cancel.current) {
        const file = files[next++]
        try {
          const r = await post('/api/admin/index-photo', { password, id: file.id })
          results.push({ id: file.id, name: file.name, ...r })
          faces += r.faces.length
        } catch (err) {
          misses.push(`${file.name}: ${err.message}`)
        }
        setProgress({ done: results.length + misses.length, total: files.length, faces })
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker))
    setFailed(misses)

    if (!results.length) {
      setState('idle')
      return setError(cancel.current ? 'Stopped before any photo was indexed.' : 'No photos could be indexed.')
    }

    setState('publishing')
    try {
      let last
      results.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      for (let i = 0; i < results.length; i += PUBLISH_BATCH) {
        last = await post('/api/admin/publish', { password, upsert: { event, date, photos: results.slice(i, i + PUBLISH_BATCH) } })
      }
      setPublished({ ...last, event, indexed: results.length, faces })
      setState('done')
    } catch (err) {
      setState('idle')
      setError(`Indexed ${results.length} photos but couldn't publish: ${err.message}`)
    }
  }

  const removeEvent = async (name) => {
    if (!window.confirm(`Remove every photo of "${name}" from face search?`)) return
    setError('')
    setState('publishing')
    try {
      const res = await post('/api/admin/publish', { password, remove: name })
      setPublished({ ...res, removed: name })
      setIndex((idx) => ({ ...idx, photos: idx.photos.filter((p) => p.event !== name) }))
      setState('done')
    } catch (err) {
      setState('idle')
      setError(err.message)
    }
  }

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="pt-24 sm:pt-28">
      <section className="shell py-12 sm:py-16">
        <p className="eyebrow">For the PhotoCircle team</p>
        <h1 className="display mt-4 text-5xl sm:text-7xl">Photo indexer</h1>
        <p className="mt-6 max-w-2xl leading-relaxed text-ash">
          Paste a Google Drive folder and the server finds every face in it, then publishes the update. Search
          includes the new photos about a minute later. Works from a phone too.
        </p>
      </section>

      <section className="shell grid gap-12 pb-24 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
        <div className="space-y-10">
          {!setup ? (
            <form onSubmit={signIn} className="max-w-md space-y-5">
              <Field label="Admin password" htmlFor="ix-pass" hint="Set once in Vercel as PCR_ADMIN_PASSWORD.">
                <input id="ix-pass" type="password" autoComplete="current-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <label className="flex items-center gap-2 text-xs text-ash">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-accent" />
                Remember on this device
              </label>
              <button type="submit" disabled={!password || signingIn} className="btn-primary disabled:opacity-50">
                <LockSimple size={18} weight="bold" />
                {signingIn ? 'Checking' : 'Sign in'}
              </button>
            </form>
          ) : (
            <>
              {!ready && (
                <div role="alert" className="flex gap-3 border border-accent/40 bg-accent/5 p-5 text-sm text-bone">
                  <Warning size={20} className="mt-0.5 shrink-0 text-accent" />
                  <p>
                    Setup isn&apos;t finished. Add {!setup.google && <code className="text-accent">GOOGLE_API_KEY</code>}
                    {!setup.google && !setup.github && ' and '}
                    {!setup.github && <code className="text-accent">GITHUB_TOKEN</code>} in Vercel (Settings, Environment
                    Variables), then redeploy.
                  </p>
                </div>
              )}

              <form onSubmit={run} className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-[1fr_200px]">
                  <Field label="Event name" htmlFor="ix-event">
                    <input id="ix-event" className={input} value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Horizon 2026" disabled={busy} />
                  </Field>
                  <Field label="Date" htmlFor="ix-date">
                    <input id="ix-date" type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
                  </Field>
                </div>
                <Field label="Google Drive folder link" htmlFor="ix-folder" hint='Share the folder as "Anyone with the link" (Viewer) first.'>
                  <input id="ix-folder" className={input} value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="https://drive.google.com/drive/folders/..." disabled={busy} />
                </Field>

                {busy ? (
                  <div className="space-y-3" role="status">
                    <div className="h-2 bg-smoke">
                      <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${state === 'indexing' ? pct : state === 'publishing' ? 100 : 0}%` }} />
                    </div>
                    <p className="text-sm text-bone/80">
                      {state === 'listing' && 'Reading the Drive folder.'}
                      {state === 'indexing' && `${progress.done} of ${progress.total} photos, ${progress.faces} faces found.`}
                      {state === 'publishing' && 'Publishing to the site.'}
                    </p>
                    {state === 'indexing' && (
                      <button type="button" onClick={() => (cancel.current = true)} className="btn-ghost">
                        Stop and publish what&apos;s done
                      </button>
                    )}
                  </div>
                ) : (
                  <button type="submit" disabled={!ready} className="btn-primary disabled:opacity-50">
                    Index and publish
                  </button>
                )}
              </form>
            </>
          )}

          {error && (
            <p role="alert" className="border border-accent/40 bg-accent/5 p-4 text-sm text-bone">
              {error}
            </p>
          )}

          {published && (
            <div className="space-y-3 border-l-4 border-accent bg-coal p-6">
              <p className="flex items-center gap-2 font-semibold text-bone">
                <CheckCircle size={20} weight="fill" className="text-accent" />
                {published.removed
                  ? `Removed "${published.removed}".`
                  : `Published "${published.event}": ${published.indexed} photos, ${published.faces} faces.`}
              </p>
              <p className="text-sm text-ash">The site redeploys automatically; search includes it in about a minute.</p>
              <a href={published.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-accent underline-offset-4 hover:underline">
                View the commit <ArrowSquareOut size={14} />
              </a>
              {failed.length > 0 && (
                <details className="text-sm text-ash">
                  <summary className="cursor-pointer text-bone">{failed.length} photo{failed.length === 1 ? '' : 's'} skipped</summary>
                  <ul className="mt-2 space-y-1">
                    {failed.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="border border-bone/10 bg-coal p-6">
            <h2 className="text-base font-semibold text-bone">On the site now</h2>
            {!index ? (
              <p className="mt-3 text-sm text-ash">Loading</p>
            ) : (
              <>
                <p className="mt-3 text-sm text-ash">
                  {index.photos.length} photos across {events.length} event{events.length === 1 ? '' : 's'}.
                </p>
                {events.length > 0 && (
                  <ul className="mt-5 space-y-2">
                    {events.map((e) => (
                      <li key={e.name} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-bone">
                          {e.name} <span className="text-ash">({e.photo_count})</span>
                        </span>
                        {setup && (
                          <button type="button" onClick={() => removeEvent(e.name)} disabled={busy} aria-label={`Remove ${e.name}`} className="p-1 text-ash hover:text-accent disabled:opacity-40">
                            <Trash size={16} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-5 text-xs leading-relaxed text-ash">This list reflects the last deploy, so a change shows here about a minute after publishing.</p>
              </>
            )}
          </div>
        </aside>
      </section>
    </div>
  )
}
