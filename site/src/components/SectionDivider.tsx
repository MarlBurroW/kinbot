/**
 * Subtle gradient mesh divider between landing page sections.
 * Three variants for visual variety when used between different sections.
 */

type Variant = 'wave' | 'glow' | 'fade'

interface SectionDividerProps {
  variant?: Variant
  flip?: boolean
  className?: string
}

function WaveDivider({ flip }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 1440 48"
      preserveAspectRatio="none"
      className="w-full block"
      style={{
        height: '48px',
        transform: flip ? 'scaleY(-1)' : undefined,
      }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="wave-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style={{ stopColor: 'var(--color-glow-1)', stopOpacity: 0.12 }} />
          <stop offset="50%" style={{ stopColor: 'var(--color-glow-2)', stopOpacity: 0.08 }} />
          <stop offset="100%" style={{ stopColor: 'var(--color-glow-3)', stopOpacity: 0.12 }} />
        </linearGradient>
      </defs>
      <path
        d="M0,24 C240,4 480,44 720,24 C960,4 1200,44 1440,24 L1440,48 L0,48 Z"
        fill="url(#wave-grad)"
      />
      <path
        d="M0,28 C360,8 720,44 1080,20 C1260,10 1380,28 1440,32 L1440,48 L0,48 Z"
        fill="url(#wave-grad)"
        opacity="0.5"
      />
    </svg>
  )
}

function GlowDivider() {
  return (
    <div
      className="w-full flex justify-center py-4"
      aria-hidden="true"
    >
      <div className="relative w-full max-w-2xl">
        {/* Base gradient line */}
        <div
          className="w-full h-px"
          style={{
            background: `linear-gradient(90deg,
              transparent 0%,
              color-mix(in oklch, var(--color-glow-1) 30%, transparent) 20%,
              color-mix(in oklch, var(--color-glow-2) 40%, transparent) 50%,
              color-mix(in oklch, var(--color-glow-3) 30%, transparent) 80%,
              transparent 100%
            )`,
          }}
        />
        {/* Animated shimmer pulse */}
        <div
          className="absolute inset-0 h-px overflow-hidden"
          style={{
            maskImage: 'linear-gradient(90deg, transparent 0%, transparent 20%, black 50%, transparent 80%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, transparent 20%, black 50%, transparent 80%, transparent 100%)',
          }}
        >
          <div
            className="h-px w-full"
            style={{
              background: `linear-gradient(90deg,
                transparent 0%,
                transparent 40%,
                color-mix(in oklch, var(--color-glow-2) 80%, transparent) 48%,
                var(--color-glow-2) 50%,
                color-mix(in oklch, var(--color-glow-2) 80%, transparent) 52%,
                transparent 60%,
                transparent 100%
              )`,
              backgroundSize: '200% 100%',
              animation: 'divider-shimmer 3s ease-in-out infinite',
            }}
          />
        </div>
        {/* Glow halo behind the shimmer */}
        <div
          className="absolute -top-2 h-5 w-full overflow-hidden pointer-events-none"
          style={{
            maskImage: 'linear-gradient(90deg, transparent 0%, transparent 20%, black 50%, transparent 80%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, transparent 20%, black 50%, transparent 80%, transparent 100%)',
          }}
        >
          <div
            className="h-full w-full"
            style={{
              background: `radial-gradient(ellipse 8% 100% at 50% 50%,
                color-mix(in oklch, var(--color-glow-2) 20%, transparent),
                transparent 70%
              )`,
              backgroundSize: '200% 100%',
              animation: 'divider-shimmer 3s ease-in-out infinite',
            }}
          />
        </div>
      </div>
      <style>{`
        @keyframes divider-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .divider-shimmer-anim { animation: none !important; }
        }
      `}</style>
    </div>
  )
}

function FadeDivider() {
  return (
    <div
      className="w-full h-16 pointer-events-none"
      aria-hidden="true"
      style={{
        background: `radial-gradient(ellipse 60% 100% at 50% 50%,
          color-mix(in oklch, var(--color-glow-1) 6%, transparent) 0%,
          transparent 70%
        )`,
      }}
    />
  )
}

export function SectionDivider({ variant = 'glow', flip = false, className = '' }: SectionDividerProps) {
  return (
    <div className={`select-none ${className}`}>
      {variant === 'wave' && <WaveDivider flip={flip} />}
      {variant === 'glow' && <GlowDivider />}
      {variant === 'fade' && <FadeDivider />}
    </div>
  )
}
