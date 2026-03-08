import { useRef, useState, useCallback, type ReactNode, type CSSProperties } from 'react'

interface TiltCardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  /** Max tilt in degrees (default 6) */
  maxTilt?: number
  /** Glow intensity 0-1 (default 0.15) */
  glowIntensity?: number
  /** Glow color (CSS value) */
  glowColor?: string
}

/**
 * Wraps children in a card that subtly tilts toward the cursor on hover,
 * with a radial glow that follows the pointer. Respects prefers-reduced-motion.
 */
export function TiltCard({
  children,
  className = '',
  style,
  maxTilt = 6,
  glowIntensity = 0.15,
  glowColor = 'var(--color-primary)',
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState('perspective(600px) rotateX(0deg) rotateY(0deg)')
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 })
  const [hovering, setHovering] = useState(false)
  const rafRef = useRef<number | null>(null)

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = ref.current
      if (!el) return
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width // 0..1
        const y = (e.clientY - rect.top) / rect.height // 0..1
        const rotateY = (x - 0.5) * maxTilt * 2
        const rotateX = (0.5 - y) * maxTilt * 2
        setTransform(`perspective(600px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale(1.02)`)
        setGlowPos({ x: x * 100, y: y * 100 })
      })
    },
    [maxTilt],
  )

  const handleEnter = useCallback(() => setHovering(true), [])
  const handleLeave = useCallback(() => {
    setHovering(false)
    setTransform('perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)')
  }, [])

  // Check reduced motion on first render
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reduced) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={handleMove}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{
        ...style,
        transform,
        transition: hovering
          ? 'transform 0.1s ease-out'
          : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: hovering ? 'transform' : 'auto',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Radial glow that follows cursor */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          pointerEvents: 'none',
          opacity: hovering ? glowIntensity : 0,
          background: `radial-gradient(circle at ${glowPos.x}% ${glowPos.y}%, ${glowColor}, transparent 60%)`,
          transition: 'opacity 0.3s ease',
          zIndex: 0,
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )
}
