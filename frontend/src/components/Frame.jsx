import { useState } from 'react'

/**
 * A photo tile. Falls back to a plain dark tile if the file is missing, so the
 * layout holds while real photos are being added. No text over images.
 */
export default function Frame({ src, alt, className = '', imgClassName = '', priority = false }) {
  const [failed, setFailed] = useState(!src)

  return (
    <div className={`group relative overflow-hidden bg-smoke ${className}`}>
      {!failed && (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04] ${imgClassName}`}
        />
      )}
    </div>
  )
}
