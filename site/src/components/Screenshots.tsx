import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Play } from 'lucide-react'

interface Video {
  src: string
  title: string
  description: string
}

const videos: Video[] = [
  {
    src: '/kinbot/videos/create-kin-wizard.mp4',
    title: 'Create a Kin',
    description:
      'Walk through the creation wizard to set up a new specialized agent with its own identity and expertise.',
  },
  {
    src: '/kinbot/videos/inter-kin-communication.mp4',
    title: 'Inter-Kin Communication',
    description:
      'Watch Kins collaborate and delegate tasks to each other in real time.',
  },
  {
    src: '/kinbot/videos/kin-add-mcp.mp4',
    title: 'Add an MCP Server',
    description:
      'Connect external tools and services via the Model Context Protocol.',
  },
  {
    src: '/kinbot/videos/kin-ask-prompt-choice.mp4',
    title: 'Prompt Choice',
    description:
      'See how Kins can present options and let users pick the best direction.',
  },
  {
    src: '/kinbot/videos/kin-create-mini-app.mp4',
    title: 'Create Mini Apps',
    description:
      'Kins generate interactive mini applications on the fly, right in the chat.',
  },
  {
    src: '/kinbot/videos/quick-ephemeral-chat.mp4',
    title: 'Quick Ephemeral Chat',
    description:
      'Start fast, temporary conversations without needing a persistent Kin.',
  },
]

function VideoLightbox({
  video,
  index,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  video: Video
  index: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && hasPrev) onPrev()
      else if (e.key === 'ArrowRight' && hasNext) onNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, onPrev, onNext, hasPrev, hasNext])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Autoplay when opening or switching video
  useEffect(() => {
    videoRef.current?.play()
  }, [video.src])

  const touchStartX = useRef<number | null>(null)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return
      const dx = e.changedTouches[0].clientX - touchStartX.current
      touchStartX.current = null
      if (Math.abs(dx) < 50) return
      if (dx > 0 && hasPrev) onPrev()
      else if (dx < 0 && hasNext) onNext()
    },
    [hasPrev, hasNext, onPrev, onNext]
  )

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
        style={{ color: 'white' }}
        aria-label="Close (Esc)"
      >
        <X size={24} />
      </button>

      {hasPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onPrev()
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
          style={{ color: 'white' }}
          aria-label="Previous (←)"
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {hasNext && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onNext()
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
          style={{ color: 'white' }}
          aria-label="Next (→)"
        >
          <ChevronRight size={28} />
        </button>
      )}

      <div className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
        <video
          ref={videoRef}
          key={video.src}
          src={video.src}
          controls
          autoPlay
          className="w-full rounded-xl shadow-2xl"
          style={{ maxHeight: '75vh' }}
        />
        <div className="text-center mt-4">
          <h3 className="text-lg font-semibold text-white">{video.title}</h3>
          <p className="text-sm text-white/60 mt-1 max-w-xl mx-auto">
            {video.description}
          </p>
          <p className="text-xs text-white/30 mt-2">
            {index + 1} / {videos.length}
            <span className="hidden sm:inline">
              {' '}
              · Arrow keys to navigate · Esc to close
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

function VideoCard({
  video,
  onClick,
}: {
  video: Video
  onClick: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseEnter = () => {
    setIsHovered(true)
    videoRef.current?.play()
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group glass-strong gradient-border rounded-2xl overflow-hidden text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
      style={{ boxShadow: 'var(--shadow-md)' }}
    >
      <div className="relative overflow-hidden aspect-video bg-black/5">
        <video
          ref={videoRef}
          src={video.src}
          muted
          loop
          playsInline
          preload="metadata"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Play icon overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
          style={{
            opacity: isHovered ? 0 : 1,
            background: 'rgba(0,0,0,0.25)',
          }}
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center bg-white/20 backdrop-blur-sm">
            <Play size={24} className="text-white ml-1" fill="white" />
          </div>
        </div>
      </div>
      <div className="p-5">
        <h3
          className="font-semibold text-base mb-1"
          style={{ color: 'var(--color-foreground)' }}
        >
          {video.title}
        </h3>
        <p
          className="text-sm leading-relaxed"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          {video.description}
        </p>
      </div>
    </button>
  )
}

export function Screenshots() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  return (
    <>
      <section id="screenshots" className="px-6 py-24 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            <span style={{ color: 'var(--color-foreground)' }}>
              See it in{' '}
            </span>
            <span className="gradient-text">action.</span>
          </h2>
          <p
            className="text-lg max-w-2xl mx-auto"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            Real demos from a live KinBot instance — hover to preview, click to
            watch.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video, i) => (
            <VideoCard
              key={i}
              video={video}
              onClick={() => setLightboxIndex(i)}
            />
          ))}
        </div>
      </section>

      {lightboxIndex !== null && (
        <VideoLightbox
          video={videos[lightboxIndex]}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() =>
            setLightboxIndex((i) =>
              Math.min(videos.length - 1, (i ?? 0) + 1)
            )
          }
          hasPrev={lightboxIndex > 0}
          hasNext={lightboxIndex < videos.length - 1}
        />
      )}
    </>
  )
}
