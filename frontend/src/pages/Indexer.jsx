import { useEffect, useMemo, useRef, useState } from 'react'
import { DownloadSimple, FolderOpen, Images, Trash } from '@phosphor-icons/react'
import {
  emptyIndex,
  encodeAll,
  eventsOf,
  fetchIndex,
  fileToCanvas,
  listDriveFolder,
  parseDriveFolderId,
  prepare,
  toB64,
  usableForIndex,
} from '../lib/faces.js'

const REPO_UPLOAD_URL = 'https://github.com/amr1tnag/pcr-landing-page/upload/main/frontend/public/data'
const KEY_STORAGE = 'pcr-drive-api-key'
const IMAGE_RE = /\.(jpe?g|png|webp|bmp)$/i

const readKey = () => {
  try {
    return localStorage.getItem(KEY_STORAGE) || ''
  } catch {
    return ''
  }
}

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

const input =
  'w-full border border-bone/20 bg-ink px-3 py-3 text-sm text-bone placeholder:text-ash/70 focus:border-flame'

export default function Indexer() {
  const [index, setIndex] = useState(null)
  const [loadNote, setLoadNote] = useState('')
  const [eventName, setEventName] = useState('')
  const [date, setDate] = useState('')
  const [source, setSource] = useState('drive') // drive | site
  const [folder, setFolder] = useState('')
  const [apiKey, setApiKey] = useState(readKey)
  const [remember, setRemember] = useState(() => Boolean(readKey()))
  const [prefix, setPrefix] = useState('/img/')
  const [files, setFiles] = useState([])
  const [state, setState] = useState('idle') // idle | running | done
  const [progress, setProgress] = useState({ done: 0, total: 0, faces: 0, current: '' })
  const [skipped, setSkipped] = useState([])
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const cancel = useRef(false)

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  useEffect(() => {
    fetchIndex()
      .then(setIndex)
      .catch(() => {
        setIndex(emptyIndex())
        setLoadNote('No index was found on the site, so this starts a new one.')
      })
  }, [])

  const events = useMemo(() => (index ? eventsOf(index) : []), [index])
  const faceTotal = useMemo(() => (index ? index.photos.reduce((n, p) => n + p.faces.length, 0) : 0), [index])

  const chooseFiles = (list) => {
    const picked = [...(list || [])].filter((f) => IMAGE_RE.test(f.name)).sort((a, b) => a.name.localeCompare(b.name))
    setFiles(picked)
    if (!eventName && picked[0]?.webkitRelativePath) {
      // Pre-fill from the folder name, e.g. "Horizon 2026-03-14".
      const folderName = picked[0].webkitRelativePath.split('/')[0]
      const m = folderName.match(/(20\d{2})[-_.](\d{2})[-_.](\d{2})/)
      setEventName(folderName.replace(/(20\d{2})[-_.](\d{2})[-_.](\d{2})/, '').replace(/[-_]+/g, ' ').trim())
      if (m && !date) setDate(`${m[1]}-${m[2]}-${m[3]}`)
    }
  }

  const loadLocalIndex = async (file) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      if (!Array.isArray(parsed.photos)) throw new Error()
      setIndex(parsed)
      setLoadNote(`Loaded ${file.name} from your computer.`)
      setDirty(false)
    } catch {
      setError(`${file.name} isn't a faces.json index.`)
    }
  }

  const removeEvent = (name) => {
    if (!window.confirm(`Remove every photo of "${name}" from the index?`)) return
    setIndex((idx) => ({ ...idx, photos: idx.photos.filter((p) => p.event !== name), updated: new Date().toISOString() }))
    setDirty(true)
  }

  const run = async () => {
    setError('')
    setSkipped([])
    const event = eventName.trim()
    if (!event) return setError('Give the event a name.')
    if (!files.length) return setError('Choose the photos to index.')

    let driveIds = null
    if (source === 'drive') {
      const folderId = parseDriveFolderId(folder)
      if (!folderId) return setError('Paste the link to the Google Drive folder.')
      if (!apiKey.trim()) return setError('Add a Google API key with the Drive API enabled.')
      try {
        localStorage[remember ? 'setItem' : 'removeItem'](KEY_STORAGE, apiKey.trim())
      } catch {
        /* storage unavailable; the key just won't be remembered */
      }
      try {
        setState('running')
        setProgress({ done: 0, total: files.length, faces: 0, current: 'Reading the Drive folder' })
        driveIds = await listDriveFolder(folderId, apiKey.trim())
      } catch (e) {
        setState('idle')
        return setError(e.message)
      }
    }

    cancel.current = false
    setState('running')
    setProgress({ done: 0, total: files.length, faces: 0, current: 'Loading the face model' })
    try {
      await prepare('ssd')
    } catch (e) {
      setState('idle')
      return setError(`Couldn't load the face model: ${e.message}`)
    }

    const added = []
    const misses = []
    let faces = 0
    for (let i = 0; i < files.length; i++) {
      if (cancel.current) break
      const file = files[i]
      setProgress({ done: i, total: files.length, faces, current: file.name })

      let src
      if (driveIds) {
        const id = driveIds.get(file.name)
        if (!id) {
          misses.push(`${file.name}: not in the Drive folder`)
          continue
        }
        src = { drive: id }
      } else {
        const base = prefix.endsWith('/') ? prefix : `${prefix}/`
        src = { url: `${base}${encodeURIComponent(file.name)}` }
      }

      try {
        const { canvas, size } = await fileToCanvas(file)
        const found = (await encodeAll(canvas, 'ssd')).filter(usableForIndex)
        faces += found.length
        added.push({ event, date, name: file.name, src, w: size.w, h: size.h, faces: found.map((f) => toB64(f.descriptor)) })
      } catch (e) {
        misses.push(`${file.name}: ${e.message || 'could not be read'}`)
      }
      // Yield so the progress bar repaints between photos.
      await new Promise((r) => setTimeout(r, 0))
    }

    const names = new Set(added.map((p) => p.name))
    setIndex((idx) => ({
      ...idx,
      updated: new Date().toISOString(),
      photos: [...idx.photos.filter((p) => !(p.event === event && names.has(p.name))), ...added],
    }))
    setSkipped(misses)
    setProgress({ done: added.length + misses.length, total: files.length, faces, current: '' })
    setState('done')
    setDirty(dirty || added.length > 0)
  }

  const download = () => {
    const blob = new Blob([JSON.stringify(index)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: 'faces.json' })
    a.click()
    URL.revokeObjectURL(url)
  }

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="pt-24 sm:pt-28">
      <section className="shell py-12 sm:py-16">
        <p className="eyebrow">For the PhotoCircle team</p>
        <h1 className="display mt-4 text-5xl sm:text-7xl">Photo indexer</h1>
        <p className="mt-6 max-w-2xl leading-relaxed text-ash">
          Add an event to face search. Your browser finds every face in the photos you choose and writes an updated
          index file. Nothing is uploaded anywhere until you commit that file to GitHub.
        </p>
      </section>

      <section className="shell grid gap-12 pb-24 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
        <div className="space-y-10">
          <div className="grid gap-6 sm:grid-cols-[1fr_200px]">
            <Field label="Event name" htmlFor="ix-event">
              <input id="ix-event" className={input} value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Horizon" />
            </Field>
            <Field label="Date" htmlFor="ix-date">
              <input id="ix-date" type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-bone">Where the photos are hosted</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ['drive', 'Google Drive folder', 'Shared as "Anyone with the link"'],
                ['site', 'This website', 'Files committed under frontend/public'],
              ].map(([value, label, sub]) => (
                <label
                  key={value}
                  className={`cursor-pointer border p-4 transition-colors ${source === value ? 'border-flame bg-flame/5' : 'border-bone/20 hover:border-bone/40'}`}
                >
                  <input type="radio" name="source" value={value} checked={source === value} onChange={() => setSource(value)} className="sr-only" />
                  <span className="block text-sm font-semibold text-bone">{label}</span>
                  <span className="mt-1 block text-xs text-ash">{sub}</span>
                </label>
              ))}
            </div>

            {source === 'drive' ? (
              <div className="space-y-6 pt-2">
                <Field label="Drive folder link" htmlFor="ix-folder" hint="The folder with this event's photos. File names must match the photos you choose below.">
                  <input id="ix-folder" className={input} value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="https://drive.google.com/drive/folders/..." />
                </Field>
                <Field
                  label="Google API key"
                  htmlFor="ix-key"
                  hint="Free from Google Cloud Console with the Drive API enabled; no billing needed. It is only used here to list the folder and is never added to the site."
                >
                  <input id="ix-key" type="password" autoComplete="off" className={input} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIza..." />
                  <label className="flex items-center gap-2 text-xs text-ash">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-flame" />
                    Remember on this device
                  </label>
                </Field>
              </div>
            ) : (
              <div className="pt-2">
                <Field label="Path on the site" htmlFor="ix-prefix" hint="Where these files live under frontend/public, e.g. /photos/horizon-2026/.">
                  <input id="ix-prefix" className={input} value={prefix} onChange={(e) => setPrefix(e.target.value)} />
                </Field>
              </div>
            )}
          </fieldset>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-bone">Photos to index</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="btn-ghost cursor-pointer">
                <FolderOpen size={18} weight="bold" />
                Choose a folder
                <input type="file" className="sr-only" webkitdirectory="" directory="" multiple onChange={(e) => chooseFiles(e.target.files)} />
              </label>
              <label className="btn-ghost cursor-pointer">
                <Images size={18} weight="bold" />
                Choose photos
                <input type="file" className="sr-only" accept="image/*" multiple onChange={(e) => chooseFiles(e.target.files)} />
              </label>
            </div>
            <p className="text-xs text-ash">
              {files.length ? `${files.length} photo${files.length === 1 ? '' : 's'} selected.` : 'Use the same photos you put in the Drive folder.'}
            </p>
          </div>

          {error && (
            <p role="alert" className="border border-flame/40 bg-flame/5 p-4 text-sm text-bone">
              {error}
            </p>
          )}

          {state === 'running' ? (
            <div className="space-y-3" role="status">
              <div className="h-2 bg-smoke">
                <div className="h-full bg-flame transition-[width] duration-300" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-sm text-bone/80">
                {progress.done} of {progress.total} photos, {progress.faces} faces found. {progress.current}
              </p>
              <button type="button" onClick={() => (cancel.current = true)} className="btn-ghost">
                Stop after this photo
              </button>
            </div>
          ) : (
            <button type="button" onClick={run} disabled={!index} className="btn-primary disabled:opacity-50">
              Index photos
            </button>
          )}

          {state === 'done' && (
            <div className="space-y-3 border-l-4 border-flame bg-coal p-6">
              <p className="font-semibold text-bone">
                Indexed {progress.done - skipped.length} photos and found {progress.faces} faces.
              </p>
              {skipped.length > 0 && (
                <details className="text-sm text-ash">
                  <summary className="cursor-pointer text-bone">{skipped.length} skipped</summary>
                  <ul className="mt-2 space-y-1">
                    {skipped.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-8 lg:sticky lg:top-28 lg:self-start">
          <div className="border border-bone/10 bg-coal p-6">
            <h2 className="text-base font-semibold text-bone">Current index</h2>
            {!index ? (
              <p className="mt-3 text-sm text-ash">Loading</p>
            ) : (
              <>
                <p className="mt-3 text-sm text-ash">
                  {index.photos.length} photos and {faceTotal} faces across {events.length} event{events.length === 1 ? '' : 's'}.
                </p>
                {loadNote && <p className="mt-2 text-xs text-ash">{loadNote}</p>}
                {events.length > 0 && (
                  <ul className="mt-5 space-y-2">
                    {events.map((e) => (
                      <li key={e.name} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-bone">
                          {e.name} <span className="text-ash">({e.photo_count})</span>
                        </span>
                        <button type="button" onClick={() => removeEvent(e.name)} aria-label={`Remove ${e.name}`} className="p-1 text-ash hover:text-flame">
                          <Trash size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <label className="mt-5 inline-block cursor-pointer text-xs text-flame underline-offset-4 hover:underline">
                  Continue from a faces.json on this computer
                  <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => loadLocalIndex(e.target.files?.[0])} />
                </label>
              </>
            )}
          </div>

          <div className="border border-bone/10 bg-coal p-6">
            <h2 className="text-base font-semibold text-bone">Publish</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ash">
              <li>Download the updated faces.json.</li>
              <li>
                Open the{' '}
                <a href={REPO_UPLOAD_URL} target="_blank" rel="noreferrer" className="text-flame underline-offset-4 hover:underline">
                  upload page on GitHub
                </a>
                , drop the file in and commit. It replaces the old one.
              </li>
              <li>Vercel redeploys in about a minute and search includes the new photos.</li>
            </ol>
            <button type="button" onClick={download} disabled={!index || !dirty} className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:bg-bone/15 disabled:text-bone/50">
              <DownloadSimple size={18} weight="bold" />
              Download faces.json
            </button>
          </div>
        </aside>
      </section>
    </div>
  )
}
