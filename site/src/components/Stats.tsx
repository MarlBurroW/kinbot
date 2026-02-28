import { useState, useEffect, useRef } from 'react'
import { Cpu, MessageSquare, Puzzle, Users, Star, GitFork } from 'lucide-react'

interface StaticStat {
  icon: typeof Cpu
  value: number
  suffix: string
  label: string
}

const staticStats: StaticStat[] = [
  { icon: Cpu, value: 23, suffix: '+', label: 'AI providers' },
  { icon: MessageSquare, value: 6, suffix: '', label: 'Chat platforms' },
  { icon: Puzzle, value: 0, suffix: '∞', label: 'MCP tools' },
  { icon: Users, value: 0, suffix: '∞', label: 'Kins per instance' },
]

interface GitHubData {
  stars: number | null
  forks: number | null
}

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

function StatCard({
  icon: Icon,
  value,
  suffix,
  label,
  highlight,
  href,
}: {
  icon: typeof Cpu
  value: number
  suffix: string
  label: string
  highlight?: boolean
  href?: string
}) {
  const content = (
    <div
      className={`text-center group ${href ? 'cursor-pointer' : ''}`}
      style={highlight ? {
        background: 'linear-gradient(135deg, color-mix(in oklch, var(--color-glow-1) 6%, transparent), color-mix(in oklch, var(--color-glow-2) 4%, transparent))',
        border: '1px solid color-mix(in oklch, var(--color-glow-1) 15%, transparent)',
        borderRadius: '1rem',
        padding: '1.25rem 0.5rem',
      } : undefined}
    >
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
  )

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="no-underline">
        {content}
      </a>
    )
  }

  return content
}

export function Stats() {
  const [gh, setGh] = useState<GitHubData>({ stars: null, forks: null })

  useEffect(() => {
    fetch('https://api.github.com/repos/MarlBurroW/kinbot')
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.stargazers_count === 'number') {
          setGh({
            stars: data.stargazers_count,
            forks: data.forks_count ?? null,
          })
        }
      })
      .catch(() => {})
  }, [])

  return (
    <section className="px-6 py-16 max-w-5xl mx-auto">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
        {/* GitHub stars (live) */}
        {gh.stars !== null && (
          <StatCard
            icon={Star}
            value={gh.stars}
            suffix=""
            label="GitHub stars"
            highlight
            href="https://github.com/MarlBurroW/kinbot/stargazers"
          />
        )}

        {/* GitHub forks (live) */}
        {gh.forks !== null && (
          <StatCard
            icon={GitFork}
            value={gh.forks}
            suffix=""
            label="Forks"
            href="https://github.com/MarlBurroW/kinbot/network/members"
          />
        )}

        {/* Static stats */}
        {staticStats.map(({ icon, value, suffix, label }) => (
          <StatCard
            key={label}
            icon={icon}
            value={value}
            suffix={suffix}
            label={label}
          />
        ))}
      </div>
    </section>
  )
}
