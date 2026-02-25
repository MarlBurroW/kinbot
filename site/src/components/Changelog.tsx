import { useState, useEffect } from 'react'
import { Tag, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'

interface Release {
  tag_name: string
  name: string
  published_at: string
  html_url: string
  body: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function parseBody(body: string): string[] {
  if (!body) return []
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- ') || l.startsWith('* '))
    .map((l) => l.replace(/^[-*]\s+/, ''))
}

function ReleaseCard({ release, isLatest }: { release: Release; isLatest: boolean }) {
  const changes = parseBody(release.body)

  return (
    <div className="relative pl-8 pb-8 last:pb-0">
      {/* Timeline line */}
      <div
        className="absolute left-[11px] top-6 bottom-0 w-px last:hidden"
        style={{ background: 'var(--color-border)' }}
      />
      {/* Timeline dot */}
      <div
        className={`absolute left-0 top-1.5 w-6 h-6 rounded-full flex items-center justify-center ${
          isLatest ? 'bg-gradient-to-r from-purple-500 to-pink-500' : ''
        }`}
        style={isLatest ? {} : { background: 'var(--color-border)' }}
      >
        <Tag size={12} className={isLatest ? 'text-white' : ''} style={isLatest ? {} : { color: 'var(--color-muted-foreground)' }} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-2">
        <span className="font-mono font-bold text-lg" style={{ color: 'var(--color-foreground)' }}>
          {release.tag_name}
        </span>
        {isLatest && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            Latest
          </span>
        )}
        <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          {formatDate(release.published_at)}
        </span>
      </div>

      {changes.length > 0 && (
        <ul className="space-y-1 mt-2">
          {changes.map((change, i) => (
            <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              <span className="gradient-text mt-0.5">•</span>
              <span>{change}</span>
            </li>
          ))}
        </ul>
      )}

      {!changes.length && release.name && (
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          {release.name}
        </p>
      )}

      <a
        href={release.html_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm mt-2 transition-colors hover:opacity-80"
        style={{ color: 'var(--color-purple-400, #c084fc)' }}
      >
        View on GitHub <ExternalLink size={12} />
      </a>
    </div>
  )
}

export function Changelog() {
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetch('https://api.github.com/repos/MarlBurroW/kinbot/releases?per_page=20')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setReleases(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const visible = expanded ? releases : releases.slice(0, 5)

  return (
    <section id="changelog" className="px-6 py-24 max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-4xl sm:text-5xl font-bold mb-4">
          <span style={{ color: 'var(--color-foreground)' }}>What's</span>{' '}
          <span className="gradient-text">new.</span>
        </h2>
        <p className="text-lg" style={{ color: 'var(--color-muted-foreground)' }}>
          Latest releases and updates, straight from GitHub.
        </p>
      </div>

      <div className="glass-strong gradient-border rounded-2xl p-6 sm:p-8">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : releases.length === 0 ? (
          <p className="text-center py-8" style={{ color: 'var(--color-muted-foreground)' }}>
            No releases yet. Stay tuned!
          </p>
        ) : (
          <>
            {visible.map((release, i) => (
              <ReleaseCard key={release.tag_name} release={release} isLatest={i === 0} />
            ))}

            {releases.length > 5 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 mx-auto mt-6 text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: 'var(--color-purple-400, #c084fc)' }}
              >
                {expanded ? (
                  <>
                    Show less <ChevronUp size={16} />
                  </>
                ) : (
                  <>
                    Show all {releases.length} releases <ChevronDown size={16} />
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}
