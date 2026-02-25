import { useState, useEffect, useRef } from 'react'
import { Cpu, MessageSquare, Puzzle, Users, Zap, Globe } from 'lucide-react'

interface Stat {
  icon: typeof Cpu
  value: number
  suffix: string
  label: string
}

const stats: Stat[] = [
  { icon: Cpu, value: 25, suffix: '+', label: 'AI providers' },
  { icon: MessageSquare, value: 4, suffix: '', label: 'Chat platforms' },
  { icon: Puzzle, value: 0, suffix: '∞', label: 'MCP tools' },
  { icon: Zap, value: 0, suffix: '1', label: 'Single process' },
  { icon: Globe, value: 0, suffix: '0', label: 'Cloud dependency' },
  { icon: Users, value: 0, suffix: '∞', label: 'Kins per instance' },
]

function AnimatedNumber({ target, suffix }: { target: number; suffix: string }) {
  const [current, setCurrent] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (!ref.current || target === 0) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          const duration = 1200
          const start = performance.now()
          const animate = (now: number) => {
            const progress = Math.min((now - start) / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCurrent(Math.round(eased * target))
            if (progress < 1) requestAnimationFrame(animate)
          }
          requestAnimationFrame(animate)
        }
      },
      { threshold: 0.5 },
    )

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])

  if (target === 0) {
    return <span ref={ref}>{suffix}</span>
  }

  return (
    <span ref={ref}>
      {current}
      {suffix}
    </span>
  )
}

export function Stats() {
  return (
    <section className="px-6 py-16 max-w-5xl mx-auto">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
        {stats.map(({ icon: Icon, value, suffix, label }) => (
          <div key={label} className="text-center group">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3 transition-transform duration-300 group-hover:scale-110"
              style={{
                background:
                  'linear-gradient(135deg, color-mix(in oklch, var(--color-glow-1) 15%, transparent), color-mix(in oklch, var(--color-glow-2) 10%, transparent))',
                border: '1px solid color-mix(in oklch, var(--color-glow-1) 20%, transparent)',
              }}
            >
              <Icon size={18} style={{ color: 'var(--color-primary)' }} />
            </div>
            <p
              className="text-2xl sm:text-3xl font-bold mb-1"
              style={{ color: 'var(--color-foreground)' }}
            >
              <AnimatedNumber target={value} suffix={suffix} />
            </p>
            <p className="text-xs font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
              {label}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
