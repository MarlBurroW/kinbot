import { useEffect, useRef, useState } from 'react'
import { Terminal, Sparkles, MessageCircle, Brain } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: Terminal,
    title: 'Install in one command',
    description: 'Docker, shell script, or git clone. One process, one SQLite file, no external dependencies. Running in under 60 seconds.',
    detail: 'docker run -d --name kinbot -p 3000:3000 -v kinbot-data:/app/data ghcr.io/marlburrow/kinbot:latest',
    color: 'var(--color-glow-3)',
  },
  {
    number: '02',
    icon: Sparkles,
    title: 'Create your first Kin',
    description: 'The setup wizard guides you. Give your agent a name, a role, a personality. Connect any provider, or just point to a local Ollama instance.',
    detail: 'Ollama auto-detected. No API key needed for local models.',
    color: 'var(--color-glow-1)',
  },
  {
    number: '03',
    icon: MessageCircle,
    title: 'Start talking',
    description: 'Chat through the web UI, Telegram, Discord, Slack, WhatsApp, or Signal. Your Kin answers from any platform, with full context.',
    detail: '6 messaging platforms supported out of the box.',
    color: 'var(--color-glow-2)',
  },
  {
    number: '04',
    icon: Brain,
    title: 'Watch it remember',
    description: 'Come back tomorrow, next week, next month. Your Kin remembers every conversation, extracts facts automatically, and builds context over time.',
    detail: 'Vector + full-text hybrid search across months of history.',
    color: 'var(--color-primary)',
  },
]

export function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visibleSet, setVisibleSet] = useState<Set<number>>(new Set())
  const observedRef = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el || observedRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observedRef.current = true
          observer.unobserve(el)
          steps.forEach((_, i) => {
            setTimeout(() => {
              setVisibleSet(prev => new Set(prev).add(i))
            }, i * 150)
          })
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="how-it-works" className="px-6 py-24 max-w-4xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-4xl sm:text-5xl font-bold mb-4">
          <span style={{ color: 'var(--color-foreground)' }}>From zero to </span>
          <span className="gradient-text">"wow"</span>
          <span style={{ color: 'var(--color-foreground)' }}> in minutes.</span>
        </h2>
        <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--color-muted-foreground)' }}>
          No Postgres. No Redis. No YAML sprawl. Just run it.
        </p>
      </div>

      <div ref={containerRef} className="relative">
        {/* Vertical timeline line */}
        <div
          className="absolute left-6 sm:left-8 top-0 bottom-0 w-px hidden sm:block"
          style={{ background: 'linear-gradient(to bottom, color-mix(in oklch, var(--color-border) 60%, transparent), color-mix(in oklch, var(--color-primary) 30%, transparent), color-mix(in oklch, var(--color-border) 60%, transparent))' }}
        />

        <div className="space-y-6 sm:space-y-8">
          {steps.map(({ number, icon: Icon, title, description, detail, color }, i) => {
            const visible = visibleSet.has(i)
            return (
              <div
                key={number}
                className="relative flex gap-5 sm:gap-8"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateX(0)' : 'translateX(-20px)',
                  transition: `opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)`,
                }}
              >
                {/* Step number circle */}
                <div
                  className="relative z-10 flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-500"
                  style={{
                    background: visible
                      ? `linear-gradient(135deg, color-mix(in oklch, ${color} 22%, var(--color-background)), color-mix(in oklch, ${color} 10%, var(--color-background)))`
                      : 'var(--color-background)',
                    border: `1.5px solid color-mix(in oklch, ${color} ${visible ? '45' : '15'}%, transparent)`,
                    boxShadow: visible ? `0 0 24px color-mix(in oklch, ${color} 18%, transparent)` : 'none',
                  }}
                >
                  <Icon size={22} style={{ color }} />
                </div>

                {/* Content */}
                <div className="flex-1 pt-1 pb-2">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className="text-xs font-mono font-bold px-2 py-0.5 rounded-md"
                      style={{
                        background: `color-mix(in oklch, ${color} 12%, transparent)`,
                        color,
                      }}
                    >
                      {number}
                    </span>
                    <h3 className="font-semibold text-lg" style={{ color: 'var(--color-foreground)' }}>
                      {title}
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--color-muted-foreground)' }}>
                    {description}
                  </p>
                  <p
                    className="text-xs font-medium px-3 py-1.5 rounded-lg inline-block"
                    style={{
                      background: `color-mix(in oklch, ${color} 6%, transparent)`,
                      color: `color-mix(in oklch, ${color} 80%, var(--color-muted-foreground))`,
                      border: `1px solid color-mix(in oklch, ${color} 15%, transparent)`,
                    }}
                  >
                    {detail}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
