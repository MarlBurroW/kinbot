const layers = [
  {
    label: 'Frontend',
    items: ['React 19', 'Vite', 'Tailwind CSS 4', 'shadcn/ui'],
    glow: 'var(--color-glow-1)',
  },
  {
    label: 'API + SSE',
    items: ['Hono', 'Better Auth', 'Real-time SSE'],
    glow: 'var(--color-glow-2)',
  },
  {
    label: 'Kin Engine',
    items: ['Vercel AI SDK', 'FIFO Queue', 'Compacting', 'Memory'],
    glow: 'var(--color-glow-3)',
  },
  {
    label: 'Database',
    items: ['SQLite', 'Drizzle ORM', 'FTS5', 'sqlite-vec'],
    glow: 'var(--color-glow-1)',
  },
]

const providers = ['Anthropic', 'OpenAI', 'Gemini', 'Mistral', 'DeepSeek', '+ 15 more']
const external = ['Telegram', 'Webhooks', 'MCP Servers', 'Crons']

export function Architecture() {
  return (
    <section id="architecture" className="px-6 py-24" style={{ background: 'color-mix(in oklch, var(--color-glow-1) 3%, var(--color-background))' }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4" style={{ color: 'var(--color-foreground)' }}>
            One process.{' '}
            <span className="gradient-text">Zero complexity.</span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--color-muted-foreground)' }}>
            KinBot runs as a single Bun process with a single SQLite database file.
            No Redis, no message queue, no microservices. Just one thing to run and one thing to backup.
          </p>
        </div>

        <div className="relative flex flex-col lg:flex-row items-stretch gap-6">
          {/* Main box */}
          <div className="flex-1 glass-strong gradient-border rounded-3xl p-8">
            <div className="text-center mb-6">
              <span className="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
                style={{ background: 'color-mix(in oklch, var(--color-glow-1) 15%, transparent)', color: 'var(--color-primary)' }}>
                Single Process
              </span>
              <p className="text-sm font-semibold mt-2" style={{ color: 'var(--color-muted-foreground)' }}>
                bun src/server/index.ts
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {layers.map(({ label, items, glow }) => (
                <div
                  key={label}
                  className="rounded-xl p-4"
                  style={{
                    background: `color-mix(in oklch, ${glow} 8%, var(--color-card))`,
                    border: `1px solid color-mix(in oklch, ${glow} 20%, transparent)`,
                  }}
                >
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: `color-mix(in oklch, ${glow} 80%, var(--color-foreground))` }}>
                    {label}
                  </p>
                  {items.map(item => (
                    <p key={item} className="text-xs mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                      {item}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Arrows + sides */}
          <div className="flex flex-row lg:flex-col items-center justify-center gap-4 lg:gap-8">
            <div className="text-2xl" style={{ color: 'var(--color-muted-foreground)' }}>⟷</div>
            <div className="text-2xl" style={{ color: 'var(--color-muted-foreground)' }}>⟷</div>
          </div>

          {/* Right columns */}
          <div className="flex flex-col gap-4 w-full lg:w-48">
            {/* Providers */}
            <div className="glass-strong gradient-border rounded-2xl p-4">
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-primary)' }}>
                AI Providers
              </p>
              {providers.map(p => (
                <div key={p} className="flex items-center gap-2 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--color-primary)' }} />
                  <span className="text-sm" style={{ color: 'var(--color-foreground)' }}>{p}</span>
                </div>
              ))}
            </div>

            {/* External */}
            <div className="glass-strong gradient-border rounded-2xl p-4">
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-gradient-mid)' }}>
                External
              </p>
              {external.map(e => (
                <div key={e} className="flex items-center gap-2 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--color-gradient-mid)' }} />
                  <span className="text-sm" style={{ color: 'var(--color-foreground)' }}>{e}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Key principles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          {[
            { title: 'Queue per Kin', desc: 'One message processed at a time per Kin. User messages always have priority.' },
            { title: 'Original messages preserved', desc: 'Compacting summarizes history, never deletes. Every conversation is recoverable.' },
            { title: 'Secrets never leak', desc: 'Vault secrets are never in prompts or logs. Redaction prevents summary leakage.' },
          ].map(({ title, desc }) => (
            <div key={title} className="glass rounded-xl p-4">
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-foreground)' }}>{title}</p>
              <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
