import { useState } from 'react'
import { Check, Copy, UserPlus, Cpu, MessageCircle, Brain, ChevronRight } from 'lucide-react'

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
          Three ways to run KinBot. The first visit launches the setup wizard.
          Using Ollama? It's auto-detected, no API key needed.
        </p>
      </div>

      <div className="glass-strong gradient-border rounded-2xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }} role="tablist" aria-label="Installation methods">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              role="tab"
              aria-selected={active === tab.id}
              aria-controls={`install-panel-${tab.id}`}
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
        <div className="p-6 space-y-4" role="tabpanel" id={`install-panel-${active}`} aria-label={`${active} installation instructions`}>
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
            { label: 'One AI provider', note: 'Ollama (no key) or any cloud API key' },
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
      {/* Post-install journey */}
      <div className="mt-12">
        <h3 className="text-center text-lg font-semibold mb-2" style={{ color: 'var(--color-foreground)' }}>
          What happens next?
        </h3>
        <p className="text-center text-sm mb-8" style={{ color: 'var(--color-muted-foreground)' }}>
          From install to &ldquo;wow&rdquo; in under 3 minutes.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            {
              icon: UserPlus,
              time: '30s',
              title: 'Setup wizard starts',
              desc: 'Create your admin account. No email verification, no third-party auth required.',
              color: 'var(--color-glow-3)',
            },
            {
              icon: Cpu,
              time: '60s',
              title: 'Connect a provider',
              desc: 'Running Ollama? It\'s auto-detected. Otherwise, paste an API key from any of the 23+ supported providers.',
              color: 'var(--color-glow-1)',
            },
            {
              icon: MessageCircle,
              time: '90s',
              title: 'Create your first Kin',
              desc: 'Give it a name, a role, a personality. Pick a model. Your agent is born.',
              color: 'var(--color-glow-2)',
            },
            {
              icon: Brain,
              time: '3 min',
              title: 'Memory kicks in',
              desc: 'Chat naturally. Your Kin automatically extracts and remembers facts from the conversation. Come back tomorrow, it still knows.',
              color: 'var(--color-glow-1)',
            },
          ] as const).map((step, i) => {
            const Icon = step.icon
            return (
              <div
                key={i}
                className="glass-strong rounded-xl p-5 transition-all duration-200 hover:scale-[1.02]"
                style={{
                  border: `1px solid color-mix(in oklch, ${step.color} 20%, transparent)`,
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `color-mix(in oklch, ${step.color} 15%, transparent)`,
                      border: `1px solid color-mix(in oklch, ${step.color} 30%, transparent)`,
                    }}
                  >
                    <Icon size={18} style={{ color: step.color }} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-mono font-bold px-2.5 py-1 rounded-full"
                      style={{
                        background: `color-mix(in oklch, ${step.color} 10%, transparent)`,
                        color: step.color,
                        border: `1px solid color-mix(in oklch, ${step.color} 25%, transparent)`,
                      }}
                    >
                      {step.time}
                    </span>
                    <h4 className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
                      {step.title}
                    </h4>
                  </div>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
                  {step.desc}
                </p>
              </div>
            )
          })}
        </div>

        {/* Ollama fast path callout */}
        <div
          className="mt-8 glass-strong rounded-xl p-4 flex items-start gap-3"
          style={{
            background: 'color-mix(in oklch, var(--color-glow-1) 4%, var(--color-card))',
            border: '1px solid color-mix(in oklch, var(--color-glow-1) 18%, transparent)',
          }}
        >
          <ChevronRight size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
          <div>
            <p className="text-sm font-medium mb-0.5" style={{ color: 'var(--color-foreground)' }}>
              Already running Ollama?
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
              KinBot auto-detects Ollama on localhost:11434. No API key, no config, no data leaving your machine.
              Just <code className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in oklch, var(--color-muted-foreground) 10%, transparent)' }}>docker run</code> and go.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
