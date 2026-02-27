import { useState, useEffect } from 'react'
import { Github, Star, GitFork, ArrowRight, GitCommit, Clock } from 'lucide-react'

interface RepoStats {
  stars: number
  forks: number
  openIssues: number
  pushedAt: string
}

interface Contributor {
  login: string
  avatar_url: string
  html_url: string
  contributions: number
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
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

function ContributorAvatars({ contributors }: { contributors: Contributor[] }) {
  return (
    <div className="flex flex-col items-center gap-3 mb-8">
      <div className="flex items-center -space-x-2.5">
        {contributors.slice(0, 12).map((c, i) => (
          <a
            key={c.login}
            href={c.html_url}
            target="_blank"
            rel="noopener noreferrer"
            title={`${c.login} (${c.contributions} commits)`}
            className="relative transition-all duration-200 hover:scale-110 hover:z-10"
            style={{ zIndex: contributors.length - i }}
          >
            <img
              src={c.avatar_url}
              alt={c.login}
              width={36}
              height={36}
              loading="lazy"
              className="rounded-full ring-2"
              style={{
                ringColor: 'var(--color-background)',
                boxShadow: '0 0 0 2px var(--color-background)',
              }}
            />
          </a>
        ))}
        {contributors.length > 12 && (
          <div
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              background: 'color-mix(in oklch, var(--color-glow-1) 15%, var(--color-card))',
              color: 'var(--color-primary)',
              boxShadow: '0 0 0 2px var(--color-background)',
              zIndex: 0,
            }}
          >
            +{contributors.length - 12}
          </div>
        )}
      </div>
      <p className="text-xs font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
        {contributors.length} contributor{contributors.length !== 1 ? 's' : ''} and counting
      </p>
    </div>
  )
}

export function GitHubCTA() {
  const [stats, setStats] = useState<RepoStats | null>(null)
  const [contributors, setContributors] = useState<Contributor[]>([])

  useEffect(() => {
    fetch('https://api.github.com/repos/MarlBurroW/kinbot')
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.stargazers_count === 'number') {
          setStats({
            stars: data.stargazers_count,
            forks: data.forks_count,
            openIssues: data.open_issues_count,
            pushedAt: data.pushed_at,
          })
        }
      })
      .catch(() => {})

    fetch('https://api.github.com/repos/MarlBurroW/kinbot/contributors?per_page=20')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setContributors(data.filter((c: any) => c.type === 'User'))
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

        {/* Contributors */}
        {contributors.length > 0 && <ContributorAvatars contributors={contributors} />}

        {/* Stats */}
        {stats && (
          <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
            <StatBadge icon={Star} value={formatNumber(stats.stars)} label="stars" />
            <StatBadge icon={GitFork} value={formatNumber(stats.forks)} label="forks" />
          </div>
        )}

        {/* Last activity */}
        {stats?.pushedAt && (
          <div
            className="inline-flex items-center gap-1.5 text-xs font-medium mb-8 px-3 py-1.5 rounded-full"
            style={{
              background: 'color-mix(in oklch, var(--color-glow-1) 8%, transparent)',
              color: 'var(--color-primary)',
              border: '1px solid color-mix(in oklch, var(--color-glow-1) 15%, transparent)',
            }}
          >
            <Clock size={11} />
            Last commit {timeAgo(stats.pushedAt)}
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
