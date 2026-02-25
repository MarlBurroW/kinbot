import { useState, useEffect } from 'react'
import { Check, Copy, Github, ArrowRight, Star, GitFork, Tag } from 'lucide-react'

const INSTALL_CMD = 'curl -fsSL https://raw.githubusercontent.com/MarlBurroW/kinbot/main/install.sh | bash'

interface RepoStats {
  stars: number
  forks: number
  version: string
}

function useGitHubStats(): RepoStats | null {
  const [stats, setStats] = useState<RepoStats | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('https://api.github.com/repos/MarlBurroW/kinbot').then(r => r.json()),
      fetch('https://api.github.com/repos/MarlBurroW/kinbot/releases/latest').then(r => r.json()),
    ])
      .then(([repo, release]) => {
        setStats({
          stars: repo.stargazers_count ?? 0,
          forks: repo.forks_count ?? 0,
          version: release.tag_name ?? '',
        })
      })
      .catch(() => {})
  }, [])

  return stats
}

function StatBadge({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
      style={{
        background: 'color-mix(in oklch, var(--color-glow-1) 8%, transparent)',
        color: 'var(--color-muted-foreground)',
        border: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)',
      }}
      title={label}
    >
      {icon}
      <span>{value}</span>
    </div>
  )
}

export function Hero() {
  const [copied, setCopied] = useState(false)
  const stats = useGitHubStats()

  const copy = async () => {
    await navigator.clipboard.writeText(INSTALL_CMD)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 overflow-hidden">

      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="animate-pulse-glow absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--color-glow-1) 12%, transparent) 0%, transparent 70%)' }}
        />
        <div
          className="animate-pulse-glow absolute top-1/4 right-0 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--color-glow-2) 8%, transparent) 0%, transparent 70%)', animationDelay: '1s' }}
        />
        <div
          className="animate-pulse-glow absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--color-glow-3) 6%, transparent) 0%, transparent 70%)', animationDelay: '2s' }}
        />
      </div>

      {/* Badge */}
      <div className="animate-fade-in-up" style={{ animationDelay: '0s' }}>
        <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium mb-8"
          style={{ color: 'var(--color-primary)' }}>
          <span className="relative flex size-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: 'var(--color-primary)' }} />
            <span className="relative inline-flex rounded-full size-2"
              style={{ background: 'var(--color-primary)' }} />
          </span>
          Open Source · Self-hosted · AGPL-3.0
        </span>
      </div>

      {/* GitHub stats */}
      {stats && (
        <div className="animate-fade-in-up flex items-center gap-3 mb-6" style={{ animationDelay: '0.05s' }}>
          {stats.version && (
            <StatBadge
              icon={<Tag size={12} style={{ color: 'var(--color-primary)' }} />}
              label="Latest version"
              value={stats.version}
            />
          )}
          <StatBadge
            icon={<Star size={12} style={{ color: 'var(--color-primary)' }} />}
            label="GitHub stars"
            value={stats.stars.toLocaleString()}
          />
          <StatBadge
            icon={<GitFork size={12} style={{ color: 'var(--color-primary)' }} />}
            label="Forks"
            value={stats.forks.toLocaleString()}
          />
        </div>
      )}

      {/* Heading */}
      <div className="animate-fade-in-up text-center max-w-4xl" style={{ animationDelay: '0.1s' }}>
        <h1 className="text-6xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight leading-none mb-6">
          <span className="gradient-text animate-gradient">KinBot</span>
        </h1>
        <p className="text-2xl sm:text-3xl font-semibold mb-4" style={{ color: 'var(--color-foreground)' }}>
          AI agents that actually remember you.
        </p>
        <p className="text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          Self-hosted specialized AI agents with persistent identity, continuous memory,
          and real collaboration. One server. One file. Zero infrastructure.
        </p>
      </div>

      {/* CTA buttons */}
      <div className="animate-fade-in-up flex flex-col sm:flex-row items-center gap-4 mt-10" style={{ animationDelay: '0.2s' }}>
        <a
          href="https://github.com/MarlBurroW/kinbot"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
          style={{
            background: 'var(--color-primary)',
            color: 'var(--color-primary-foreground)',
            boxShadow: '0 0 24px color-mix(in oklch, var(--color-glow-1) 40%, transparent)',
          }}
        >
          <Github size={18} />
          View on GitHub
          <ArrowRight size={16} />
        </a>
        <a
          href="#install"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 active:scale-95 glass"
          style={{ color: 'var(--color-foreground)' }}
        >
          Quick install
        </a>
      </div>

      {/* Install command */}
      <div className="animate-fade-in-up w-full max-w-2xl mt-8" style={{ animationDelay: '0.3s' }}>
        <div className="glass-strong gradient-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400 opacity-70" />
              <div className="w-3 h-3 rounded-full bg-yellow-400 opacity-70" />
              <div className="w-3 h-3 rounded-full bg-green-400 opacity-70" />
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--color-muted-foreground)' }}>terminal</span>
            <button
              onClick={copy}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors"
              style={{
                color: copied ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
                background: copied ? 'color-mix(in oklch, var(--color-glow-1) 10%, transparent)' : 'transparent',
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="px-5 py-4 font-mono text-sm overflow-x-auto" style={{ color: 'var(--color-foreground)' }}>
            <span style={{ color: 'var(--color-muted-foreground)' }}>$ </span>
            <span>{INSTALL_CMD}</span>
          </div>
        </div>
        <p className="text-center text-xs mt-2" style={{ color: 'var(--color-muted-foreground)' }}>
          Linux (Debian/Ubuntu, RHEL/Fedora) and macOS · Requires git
        </p>
      </div>

      {/* Mock chat preview */}
      <div className="animate-levitate animate-fade-in-up mt-16 w-full max-w-lg" style={{ animationDelay: '0.4s' }}>
        <div className="glass-strong gradient-border rounded-2xl overflow-hidden shadow-xl">
          <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="w-8 h-8 rounded-full gradient-border flex items-center justify-center text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-mid))' }}>
              A
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>Aria</p>
              <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Research specialist · online</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex justify-end">
              <div className="rounded-xl rounded-br-sm px-3.5 py-2 text-sm max-w-[80%]"
                style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
                What did we conclude last week about the market analysis?
              </div>
            </div>
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full flex-shrink-0 mt-1 flex items-center justify-center text-xs font-bold"
                style={{ background: 'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-mid))', color: 'white' }}>
                A
              </div>
              <div className="rounded-xl rounded-bl-sm px-3.5 py-2 text-sm max-w-[85%]"
                style={{ background: 'var(--color-card)', color: 'var(--color-card-foreground)', border: '1px solid var(--color-border)' }}>
                From my memory of our session on Feb 17th: we concluded the European segment was the strongest opportunity, with 3x projected growth vs North America. I summarized the full report in your workspace.
              </div>
            </div>
            <div className="flex gap-2 items-center pl-8">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: 'var(--color-primary)', opacity: 0.6, animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
              <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Aria is typing…</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
