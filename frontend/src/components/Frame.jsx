import { useState } from 'react'

/**
 * An image tile that degrades into a branded gradient placeholder when the
 * file isn't on disk yet — so the site looks finished before real photos land.
 */
export default function Frame({ src, alt, event, caption, tone = 'from-flame/30', className = '', ratio = 'aspect-[4/5]' }) {
  const [failed, setFailed] = useState(!src)

  return (
    <figure className={`group relative overflow-hidden bg-smoke ${ratio} ${className}`}>
      {!failed && (
        <img
          src={src}
          alt={alt || caption || event}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
        />
      )}

      {failed && (
        <div className={`h-full w-full bg-gradient-to-br ${tone} via-coal to-black`}>
          <div className="grain absolute inset-0" />
          <span className="absolute bottom-4 left-4 font-display text-[11px] uppercase tracking-[0.3em] text-white/25">
            {event || 'PCR'}
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-100" />

      {(event || caption) && (
        <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-1 p-4 transition-transform duration-500 group-hover:translate-y-0">
          {event && <span className="font-display text-xs uppercase tracking-[0.2em] text-flame">{event}</span>}
          {caption && <p className="mt-1 font-cond text-base uppercase tracking-wide text-white/90">{caption}</p>}
        </figcaption>
      )}
    </figure>
  )
}
