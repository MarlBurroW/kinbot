import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

type Tab = 'script' | 'docker' | 'compose' | 'manual'

const tabs: { id: Tab; label: string }[] = [
  { id: 'script', label: 'One-liner' },
  { id: 'docker', label: 'Docker' },
  { id: 'compose', label: 'Compose' },
  { id: 'manual', label: 'Manual' },
]

const code: Record<Tab, string> = {
  script: `curl -fsSL https://raw.githubusercontent.com/MarlBurroW/kinbot/main/install.sh | bash

# Customizable via env vars:
# KINBOT_DIR=/opt/kinbot \\
# KINBOT_DATA_DIR=/var/lib/kinbot \\
# KINBOT_PORT=3000 \\
#   bash <(curl -fsSL .../install.sh)`,

  docker: `docker run -d \\
  --name kinbot \\
  -p 3000:3000 \\
  -v kinbot-data:/app/data \\
  --restart unless-stopped \\
  ghcr.io/MarlBurroW/kinbot:latest`,

  compose: `# docker-compose.yml
services:
  kinbot:
    image: ghcr.io/marlburrow/kinbot:latest
    container_name: kinbot
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - kinbot-data:/app/data
    environment:
      - NODE_ENV=production
      # - PUBLIC_URL=https://kinbot.example.com

volumes:
  kinbot-data:`,

  manual: `git clone https://github.com/MarlBurroW/kinbot.git
cd kinbot
bun install
bun run build
bun run db:migrate
NODE_ENV=production bun run start`,
}

const descriptions: Record<Tab, string> = {
  script: 'Installs Bun if needed, clones the repo, builds, runs migrations, and creates a system service (systemd on Linux, launchd on macOS). Idempotent — re-run to update.',
  docker: 'Runs KinBot in a container with a persistent volume for the data directory. The official image is published to GitHub Container Registry on every release.',
  compose: 'Drop this into a docker-compose.yml, run docker compose up -d, and you\'re set. Easy to add a reverse proxy (Traefik, Caddy, nginx) later.',
  manual: 'Clone, install dependencies, build the frontend, run migrations, and start the server. Open http://localhost:3333 to complete the setup wizard.',
}

function CodeBlock({ content, lang }: { content: string; lang: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    const clean = content.split('\n').map(l => l.replace(/^#.*/, '').trim()).filter(Boolean).join('\n')
    await navigator.clipboard.writeText(clean)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--color-border)', background: 'color-mix(in oklch, var(--color-glow-1) 4%, var(--color-card))' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--color-muted-foreground)' }}>{lang}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-all duration-200"
          style={{
            color: copied ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
            background: copied ? 'color-mix(in oklch, var(--color-glow-1) 12%, transparent)' : 'transparent',
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre
        className="px-5 py-4 text-sm overflow-x-auto"
        style={{
          background: 'color-mix(in oklch, var(--color-glow-1) 3%, var(--color-background))',
          color: 'var(--color-foreground)',
          fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
          lineHeight: 1.7,
        }}
      >
        {content.split('\n').map((line, i) => (
          <span key={i} style={{ display: 'block', color: line.startsWith('#') ? 'var(--color-muted-foreground)' : 'var(--color-foreground)' }}>
            {line || '\u00A0'}
          </span>
        ))}
      </pre>
    </div>
  )
}

export function Install() {
  const [active, setActive] = useState<Tab>('script')

  return (
    <section id="install" className="px-6 py-24 max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-4xl sm:text-5xl font-bold mb-4">
          <span className="gradient-text">Get started</span>{' '}
          <span style={{ color: 'var(--color-foreground)' }}>in minutes.</span>
        </h2>
        <p className="text-lg" style={{ color: 'var(--color-muted-foreground)' }}>
          Three ways to run KinBot. The first visit launches the setup wizard —
          you'll need at least one AI provider API key.
        </p>
      </div>

      <div className="glass-strong gradient-border rounded-2xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className="flex-1 py-3.5 text-sm font-medium transition-colors"
              style={{
                color: active === tab.id ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
                borderBottom: active === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                background: active === tab.id ? 'color-mix(in oklch, var(--color-glow-1) 6%, transparent)' : 'transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            {descriptions[active]}
          </p>
          <CodeBlock
            content={code[active]}
            lang={active === 'docker' ? 'shell (Docker)' : active === 'manual' ? 'shell' : 'shell (install script)'}
          />
        </div>
      </div>

      {/* Requirements */}
      <div className="mt-6 glass rounded-xl p-4">
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-muted-foreground)' }}>
          Requirements
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Bun ≥ 1.0', note: 'auto-installed by the script' },
            { label: 'git', note: 'for cloning the repo' },
            { label: '~500 MB disk', note: 'dependencies + build' },
            { label: 'Linux or macOS', note: 'Docker: any OS' },
            { label: 'One AI API key', note: 'Anthropic, OpenAI, or Gemini' },
            { label: 'Port 3000', note: 'or configure KINBOT_PORT' },
          ].map(({ label, note }) => (
            <div key={label} className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--color-primary)' }} />
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-foreground)' }}>{label}</p>
                <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
