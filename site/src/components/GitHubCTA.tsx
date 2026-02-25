import { useState, useEffect } from 'react'
import { Github, Star, GitFork, ArrowRight } from 'lucide-react'

interface RepoStats {
  stars: number
  forks: number
  openIssues: number
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

function StatBadge({ icon: Icon, value, label }: { icon: typeof Star; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-xl glass">
      <Icon size={16} style={{ color: 'var(--color-primary)' }} />
      <span className="font-mono font-bold text-sm" style={{ color: 'var(--color-foreground)' }}>
        {value}
      </span>
      <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
        {label}
      </span>
    </div>
  )
}

export function GitHubCTA() {
  const [stats, setStats] = useState<RepoStats | null>(null)

  useEffect(() => {
    fetch('https://api.github.com/repos/MarlBurroW/kinbot')
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.stargazers_count === 'number') {
          setStats({
            stars: data.stargazers_count,
            forks: data.forks_count,
            openIssues: data.open_issues_count,
          })
        }
      })
      .catch(() => {})
  }, [])

  return (
    <section className="px-6 py-24">
      <div className="max-w-3xl mx-auto text-center">
        {/* Heading */}
        <h2 className="text-4xl sm:text-5xl font-bold mb-4">
          <span style={{ color: 'var(--color-foreground)' }}>Built in the open.</span>
        </h2>
        <p className="text-lg mb-8 max-w-xl mx-auto" style={{ color: 'var(--color-muted-foreground)' }}>
          KinBot is built by someone who got tired of AI forgetting everything.
          It's open source, actively developed, and looking for early adopters who want to push it further.
        </p>

        {/* Stats */}
        {stats && (
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
            <StatBadge icon={Star} value={formatNumber(stats.stars)} label="stars" />
            <StatBadge icon={GitFork} value={formatNumber(stats.forks)} label="forks" />
          </div>
        )}

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="https://github.com/MarlBurroW/kinbot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-primary-foreground)',
              boxShadow: '0 0 30px color-mix(in oklch, var(--color-glow-1) 35%, transparent)',
            }}
          >
            <Star size={18} />
            Star on GitHub
          </a>
          <a
            href="https://github.com/MarlBurroW/kinbot/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold transition-all duration-200 hover:scale-105 active:scale-95 glass"
            style={{ color: 'var(--color-foreground)' }}
          >
            <Github size={18} />
            Contribute
            <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  )
}
