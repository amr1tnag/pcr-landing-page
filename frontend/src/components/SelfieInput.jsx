import { useCallback, useEffect, useRef, useState } from 'react'

/** Upload box with drag-and-drop plus an in-browser camera capture. */
export default function SelfieInput({ onPick, disabled }) {
  const fileRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [camera, setCamera] = useState(false)
  const [camError, setCamError] = useState('')

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCamera(false)
  }, [])

  useEffect(() => stopCamera, [stopCamera])

  const startCamera = async () => {
    setCamError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 } },
        audio: false,
      })
      streamRef.current = stream
      setCamera(true)
      // Wait for the <video> to mount before attaching the stream.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      })
    } catch {
      setCamError('Camera unavailable — upload a photo instead.')
    }
  }

  const capture = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 720
    canvas.height = video.videoHeight || 960
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        stopCamera()
        onPick(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.92
    )
  }

  const handleFiles = (files) => {
    const file = files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    onPick(file)
  }

  if (camera) {
    return (
      <div className="border border-white/15 bg-coal p-4">
        <div className="relative overflow-hidden bg-black">
          <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={capture}
            className="flex-1 bg-flame px-5 py-3 font-display text-sm uppercase tracking-wide text-black"
          >
            Capture
          </button>
          <button
            type="button"
            onClick={stopCamera}
            className="border border-white/20 px-5 py-3 font-cond text-sm uppercase tracking-[0.2em] text-white/70 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        onClick={() => !disabled && fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
        className={`grid cursor-pointer place-items-center border border-dashed px-6 py-14 text-center transition-colors ${
          dragging ? 'border-flame bg-flame/5' : 'border-white/20 bg-coal hover:border-white/40'
        } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      >
        <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-flame text-2xl text-flame">+</span>
        <p className="mt-5 font-display text-lg uppercase">Drop a selfie here</p>
        <p className="mt-2 font-sans text-sm text-ash">or click to browse · JPG, PNG · one clear face works best</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={startCamera}
          disabled={disabled}
          className="font-cond text-sm uppercase tracking-[0.2em] text-flame underline-offset-8 hover:underline disabled:opacity-50"
        >
          Use camera instead
        </button>
        {camError && <span className="font-sans text-xs text-ash">{camError}</span>}
      </div>
    </div>
  )
}
