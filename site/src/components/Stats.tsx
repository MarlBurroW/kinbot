import { useEffect, useRef, useState } from 'react'
import { Cpu, MessageSquare, Puzzle, Users, Star, GitFork, GitCommit, AlertCircle, Wrench } from 'lucide-react'
import { useGitHubData } from './GitHubDataProvider'

interface StaticStat {
  icon: typeof Cpu
  value: number
  suffix: string
  label: string
}

const staticStats: StaticStat[] = [
  { icon: Cpu, value: 23, suffix: '+', label: 'AI providers' },
  { icon: MessageSquare, value: 6, suffix: '', label: 'Chat platforms' },
  { icon: Wrench, value: 90, suffix: '+', label: 'Built-in tools' },
  { icon: Puzzle, value: 0, suffix: '∞', label: 'MCP tools' },
  { icon: Users, value: 0, suffix: '∞', label: 'Kins per instance' },
]

interface GitHubData {
  stars: number | null
  forks: number | null
  totalCommits: number | null
  openIssues: number | null
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
  const ghData = useGitHubData()
  const gh: GitHubData = {
    stars: ghData.repo?.stars ?? null,
    forks: ghData.repo?.forks ?? null,
    openIssues: ghData.repo?.openIssues ?? null,
    totalCommits: ghData.totalCommits,
  }

  return (
    <section className="relative px-6 py-16 overflow-hidden">
      {/* Gradient mesh background */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(ellipse 50% 60% at 20% 50%, color-mix(in oklch, var(--color-glow-1) 8%, transparent), transparent),
            radial-gradient(ellipse 40% 50% at 80% 40%, color-mix(in oklch, var(--color-glow-2) 6%, transparent), transparent),
            radial-gradient(ellipse 60% 40% at 50% 80%, color-mix(in oklch, var(--color-glow-3) 5%, transparent), transparent)
          `,
        }}
      />
      <div className="relative max-w-5xl mx-auto">
      <p className="text-center text-sm font-medium mb-8 tracking-wide uppercase" style={{ color: 'var(--color-muted-foreground)', letterSpacing: '0.1em' }}>
        Making your LLM stack work
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
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

        {/* Total commits (live) */}
        {gh.totalCommits !== null && (
          <StatCard
            icon={GitCommit}
            value={gh.totalCommits}
            suffix="+"
            label="Commits"
            href="https://github.com/MarlBurroW/kinbot/commits/main"
          />
        )}

        {/* Open issues (live) */}
        {gh.openIssues !== null && gh.openIssues > 0 && (
          <StatCard
            icon={AlertCircle}
            value={gh.openIssues}
            suffix=""
            label="Open issues"
            href="https://github.com/MarlBurroW/kinbot/issues"
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
      </div>
    </section>
  )
}
