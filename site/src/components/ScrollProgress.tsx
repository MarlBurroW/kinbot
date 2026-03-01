import { useState, useEffect } from 'react'

export function ScrollProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let ticking = false

    const update = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      setProgress(docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0)
      ticking = false
    }

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(update)
        ticking = true
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    update()

    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] pointer-events-none"
      style={{ height: '3px' }}
    >
      <div
        className="h-full origin-left transition-opacity duration-300"
        style={{
          background: 'linear-gradient(90deg, var(--color-glow-1), var(--color-glow-2, var(--color-glow-1)), var(--color-glow-3, var(--color-glow-1)))',
          transform: `scaleX(${progress})`,
          opacity: progress > 0.01 ? 1 : 0,
          boxShadow: '0 0 8px color-mix(in oklch, var(--color-glow-1) 50%, transparent)',
        }}
      />
    </div>
  )
}
