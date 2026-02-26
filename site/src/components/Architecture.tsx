import { Server, Database, Layout, Cpu, Wifi, Bot, Shield, ArrowRight } from 'lucide-react'

// ── Animated connector dots (horizontal) ──────────────────────────────
function HorizontalConnector({ color, reverse = false, className = '' }: { color: string; reverse?: boolean; className?: string }) {
  const dotCount = 3
  return (
    <div className={`hidden lg:flex items-center justify-center w-12 relative ${className}`}>
      <div
        className="absolute inset-y-[45%] left-0 right-0"
        style={{
          borderTop: `1.5px dashed color-mix(in oklch, ${color} 30%, transparent)`,
        }}
      />
      {Array.from({ length: dotCount }).map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{
            background: color,
            boxShadow: `0 0 8px ${color}`,
            animation: `arch-dot-h 2s ${i * 0.6}s infinite ease-in-out`,
            ...(reverse ? { animationDirection: 'reverse' } : {}),
          }}
        />
      ))}
    </div>
  )
}

// ── Mobile vertical connector ─────────────────────────────────────────
function VerticalConnector({ color, className = '' }: { color: string; className?: string }) {
  return (
    <div className={`flex lg:hidden items-center justify-center h-8 relative ${className}`}>
      <div
        className="absolute inset-x-[49%] top-0 bottom-0"
        style={{
          borderLeft: `1.5px dashed color-mix(in oklch, ${color} 30%, transparent)`,
        }}
      />
      {[0, 0.7].map((delay, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{
            background: color,
            boxShadow: `0 0 8px ${color}`,
            animation: `arch-dot-v 2s ${delay}s infinite ease-in-out`,
          }}
        />
      ))}
    </div>
  )
}

const layers = [
  {
    icon: Layout,
    label: 'Frontend',
    items: ['React 19', 'Vite', 'Tailwind CSS 4', 'shadcn/ui'],
    glow: 'var(--color-glow-1)',
  },
  {
    icon: Server,
    label: 'API + SSE',
    items: ['Hono', 'Better Auth', 'Real-time SSE'],
    glow: 'var(--color-glow-2)',
  },
  {
    icon: Bot,
    label: 'Kin Engine',
    items: ['Vercel AI SDK', 'FIFO Queue', 'Compacting', 'Memory'],
    glow: 'var(--color-glow-3)',
  },
  {
    icon: Database,
    label: 'Database',
    items: ['SQLite', 'Drizzle ORM', 'FTS5', 'sqlite-vec'],
    glow: 'var(--color-glow-1)',
  },
]

const providers = ['Anthropic', 'OpenAI', 'Gemini', 'Mistral', 'DeepSeek', '+ 16 more']
const integrations = ['Telegram', 'Discord', 'Slack', 'Webhooks', 'MCP Servers', 'Cron Jobs']

export function Architecture() {
  return (
    <section
      id="architecture"
      className="px-6 py-24"
      style={{
        background:
          'color-mix(in oklch, var(--color-glow-1) 3%, var(--color-background))',
      }}
    >
      {/* Keyframes for animated dots */}
      <style>{`
        @keyframes arch-dot-h {
          0%, 100% { left: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: calc(100% - 8px); opacity: 0; }
        }
        @keyframes arch-dot-v {
          0%, 100% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: calc(100% - 8px); opacity: 0; }
        }
        @keyframes arch-pulse {
          0%, 100% { box-shadow: 0 0 0px transparent; }
          50% { box-shadow: 0 0 20px color-mix(in oklch, var(--color-glow-1) 20%, transparent); }
        }
      `}</style>

      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2
            className="text-4xl sm:text-5xl font-bold mb-4"
            style={{ color: 'var(--color-foreground)' }}
          >
            One process.{' '}
            <span className="gradient-text">Zero complexity.</span>
          </h2>
          <p
            className="text-lg max-w-2xl mx-auto"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            KinBot runs as a single Bun process with a single SQLite database file. No
            Redis, no message queue, no microservices. Just one thing to run and one
            thing to backup.
          </p>
        </div>

        <div className="relative flex flex-col lg:flex-row items-stretch gap-0">
          {/* Left sidebar: Integrations */}
          <div className="order-5 lg:order-1 glass-strong gradient-border rounded-2xl p-5 w-full lg:w-52 flex-shrink-0">
            <p
              className="text-xs font-bold uppercase tracking-widest mb-4"
              style={{ color: 'var(--color-gradient-mid, var(--color-primary))' }}
            >
              Integrations
            </p>
            <div className="flex flex-col gap-2">
              {integrations.map((item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      background: 'var(--color-gradient-mid, var(--color-primary))',
                      boxShadow:
                        '0 0 6px color-mix(in oklch, var(--color-gradient-mid, var(--color-primary)) 40%, transparent)',
                    }}
                  />
                  <span
                    className="text-sm"
                    style={{ color: 'var(--color-foreground)' }}
                  >
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Left connector */}
          <VerticalConnector color="var(--color-gradient-mid, var(--color-primary))" className="order-4" />
          <HorizontalConnector color="var(--color-gradient-mid, var(--color-primary))" reverse className="lg:order-2" />

          {/* Main process box */}
          <div
            className="order-3 lg:order-3 flex-1 glass-strong gradient-border rounded-3xl p-6 sm:p-8"
            style={{
              animation: 'arch-pulse 4s ease-in-out infinite',
            }}
          >
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2">
                <Cpu
                  size={14}
                  style={{ color: 'var(--color-primary)' }}
                />
                <span
                  className="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
                  style={{
                    background:
                      'color-mix(in oklch, var(--color-glow-1) 15%, transparent)',
                    color: 'var(--color-primary)',
                  }}
                >
                  Single Process
                </span>
              </div>
              <p
                className="text-sm font-mono mt-2"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                bun src/server/index.ts
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {layers.map(({ icon: Icon, label, items, glow }) => (
                <div
                  key={label}
                  className="rounded-xl p-4 transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    background: `color-mix(in oklch, ${glow} 8%, var(--color-card))`,
                    border: `1px solid color-mix(in oklch, ${glow} 25%, transparent)`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon
                      size={14}
                      style={{
                        color: `color-mix(in oklch, ${glow} 80%, var(--color-foreground))`,
                      }}
                    />
                    <p
                      className="text-xs font-bold uppercase tracking-wider"
                      style={{
                        color: `color-mix(in oklch, ${glow} 80%, var(--color-foreground))`,
                      }}
                    >
                      {label}
                    </p>
                  </div>
                  {items.map((item) => (
                    <p
                      key={item}
                      className="text-xs mb-0.5"
                      style={{ color: 'var(--color-muted-foreground)' }}
                    >
                      {item}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Right connector */}
          <VerticalConnector color="var(--color-primary)" className="order-2" />
          <HorizontalConnector color="var(--color-primary)" className="lg:order-4" />

          {/* Right sidebar: AI Providers */}
          <div className="order-1 lg:order-5 glass-strong gradient-border rounded-2xl p-5 w-full lg:w-52 flex-shrink-0">
            <p
              className="text-xs font-bold uppercase tracking-widest mb-4"
              style={{ color: 'var(--color-primary)' }}
            >
              AI Providers
            </p>
            <div className="flex flex-col gap-2">
              {providers.map((item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      background: 'var(--color-primary)',
                      boxShadow:
                        '0 0 6px color-mix(in oklch, var(--color-primary) 40%, transparent)',
                    }}
                  />
                  <span
                    className="text-sm"
                    style={{ color: 'var(--color-foreground)' }}
                  >
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Key principles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          {[
            {
              icon: ArrowRight,
              title: 'Queue per Kin',
              desc: 'One message processed at a time per Kin. User messages always have priority.',
            },
            {
              icon: Database,
              title: 'Original messages preserved',
              desc: 'Compacting summarizes history, never deletes. Every conversation is recoverable.',
            },
            {
              icon: Shield,
              title: 'Secrets never leak',
              desc: 'Vault secrets are never in prompts or logs. Redaction prevents summary leakage.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass rounded-xl p-4 group">
              <div className="flex items-center gap-2 mb-1">
                <Icon
                  size={14}
                  style={{ color: 'var(--color-primary)' }}
                  className="transition-transform duration-300 group-hover:scale-110"
                />
                <p
                  className="text-sm font-semibold"
                  style={{ color: 'var(--color-foreground)' }}
                >
                  {title}
                </p>
              </div>
              <p
                className="text-xs"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
