import { useState, useEffect } from 'react'
import { ArrowUp } from 'lucide-react'

export function BackToTop() {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const handler = () => {
      setVisible(window.scrollY > 600)
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      setProgress(docHeight > 0 ? Math.min(window.scrollY / docHeight, 1) : 0)
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // SVG circle progress params
  const size = 48
  const strokeWidth = 2.5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <button
      onClick={scrollToTop}
      aria-label={`Back to top (${Math.round(progress * 100)}% scrolled)`}
      className="fixed bottom-6 right-6 z-40 flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 group"
      style={{
        width: size,
        height: size,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
      }}
    >
      {/* Circular progress ring */}
      <svg
        width={size}
        height={size}
        className="absolute inset-0 -rotate-90"
        style={{ filter: 'drop-shadow(0 0 6px color-mix(in oklch, var(--color-glow-1) 40%, transparent))' }}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="color-mix(in oklch, var(--color-primary) 20%, transparent)"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.15s ease-out' }}
        />
      </svg>
      {/* Center fill */}
      <div
        className="absolute rounded-full flex items-center justify-center transition-colors duration-200"
        style={{
          width: size - strokeWidth * 2 - 4,
          height: size - strokeWidth * 2 - 4,
          background: 'var(--color-primary)',
          color: 'var(--color-primary-foreground)',
        }}
      >
        <ArrowUp size={16} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
      </div>
    </button>
  )
}
