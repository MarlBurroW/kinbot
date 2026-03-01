import { useEffect, useRef, useState } from 'react'
import {
  Brain,
  Database,
  GitBranch,
  Clock,
  Shield,
  Plug,
  Puzzle,
  AppWindow,
  Webhook,
  MessageSquare,
  Wrench,
  Users,
  Layers,
  Bell,
} from 'lucide-react'

const features = [
  {
    icon: Brain,
    title: 'Persistent Kins',
    description:
      'Each agent has a name, role, character, and expertise. They know who they are and who they\'re talking to. One continuous session — never starts from zero.',
    accent: 'var(--color-glow-1)',
  },
  {
    icon: Database,
    title: 'Long-term Memory',
    description:
      'Dual-channel memory system: automatic extraction pipeline on every LLM turn + explicit memorization tools. Hybrid search (vector + full-text) across months of context.',
    accent: 'var(--color-glow-2)',
  },
  {
    icon: Layers,
    title: 'Session Compacting',
    description:
      'Automatic smart summarization keeps conversations within token limits without losing context. Original messages are always preserved, and snapshots are rollback-able. Months of history, zero context loss.',
    accent: 'var(--color-glow-3)',
  },
  {
    icon: GitBranch,
    title: 'Sub-Tasks',
    description:
      'Kins delegate work to ephemeral sub-agents. Await mode re-enters the parent queue with the result. Async mode deposits results as informational messages.',
    accent: 'var(--color-glow-3)',
  },
  {
    icon: Clock,
    title: 'Cron Jobs',
    description:
      'In-process scheduler. Kins create their own cron jobs (with user approval) and execute them autonomously. Results appear in the main session.',
    accent: 'var(--color-glow-2)',
  },
  {
    icon: Shield,
    title: 'Encrypted Vault',
    description:
      'AES-256-GCM encrypted secrets. Never exposed in prompts or logs. Message redaction prevents leaking into compacted summaries. Secrets stay yours.',
    accent: 'var(--color-glow-1)',
  },
  {
    icon: Puzzle,
    title: 'MCP Servers',
    description:
      'Connect any Model Context Protocol server to extend Kins with external tools — databases, APIs, filesystem, code execution, and more.',
    accent: 'var(--color-glow-3)',
  },
  {
    icon: Plug,
    title: 'Multi-Provider',
    description:
      '23 providers — from Anthropic and OpenAI to Ollama for fully local inference. LLM, embedding, image, and search capabilities auto-detected from a single API key.',
    accent: 'var(--color-glow-1)',
  },
  {
    icon: MessageSquare,
    title: 'Inter-Kin Communication',
    description:
      'Request/reply pattern with correlation IDs. Kins collaborate on complex problems. Rate-limited. No ping-pong by design.',
    accent: 'var(--color-glow-2)',
  },
  {
    icon: Webhook,
    title: 'Webhooks & Channels',
    description:
      'Inbound webhooks trigger Kins from external systems. Telegram, Discord, Slack, WhatsApp, and Signal integration lets Kins interact with users on their preferred platform.',
    accent: 'var(--color-glow-3)',
  },
  {
    icon: Wrench,
    title: 'Custom Tools',
    description:
      'Kins create, register, and run their own scripts from their workspace — with user approval. Combined with MCP, they extend their own capabilities without code changes.',
    accent: 'var(--color-glow-1)',
  },
  {
    icon: Users,
    title: 'Multi-User',
    description:
      'Admin and member roles. Invitation system. Shared Kins accessible to all users — messages tagged with sender identity so Kins know who they\'re talking to.',
    accent: 'var(--color-glow-2)',
  },
  {
    icon: AppWindow,
    title: 'Mini Apps',
    description:
      'Kins build and deploy interactive web apps (HTML/CSS/JS) that live in the sidebar. Auto-injected design system with theme sync, toasts, and parent-child communication.',
    accent: 'var(--color-glow-3)',
  },
  {
    icon: Bell,
    title: 'Notifications & Contacts',
    description:
      'Kins push notifications to users and maintain a contacts directory. Human-in-the-loop prompts let Kins ask for approval before sensitive actions like creating cron jobs or managing MCP servers.',
    accent: 'var(--color-glow-1)',
  },
]

function FeatureCard({ icon: Icon, title, description, accent, visible }: {
  icon: typeof Brain; title: string; description: string; accent: string; visible: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    })
  }

  return (
    <div
      ref={cardRef}
      className="relative rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] group cursor-default"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.97)',
        transition: 'opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s, scale 0.3s',
        background: 'var(--color-glass-strong-bg, var(--color-card))',
        border: hovered
          ? `1px solid color-mix(in oklch, ${accent} 50%, transparent)`
          : '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)',
        boxShadow: hovered
          ? `0 0 32px color-mix(in oklch, ${accent} 18%, transparent), var(--shadow-md)`
          : 'var(--shadow-md)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={handleMouseMove}
    >
      {/* Radial glow that follows cursor */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-300"
        style={{
          opacity: hovered ? 1 : 0,
          background: `radial-gradient(400px circle at ${mousePos.x * 100}% ${mousePos.y * 100}%, color-mix(in oklch, ${accent} 8%, transparent), transparent 60%)`,
        }}
      />

      <div className="relative">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110"
          style={{
            background: hovered
              ? `linear-gradient(135deg, color-mix(in oklch, ${accent} 25%, transparent), color-mix(in oklch, ${accent} 12%, transparent))`
              : 'linear-gradient(135deg, color-mix(in oklch, var(--color-glow-1) 20%, transparent), color-mix(in oklch, var(--color-glow-2) 15%, transparent))',
            border: `1px solid color-mix(in oklch, ${accent} ${hovered ? '40' : '25'}%, transparent)`,
            boxShadow: hovered ? `0 0 16px color-mix(in oklch, ${accent} 20%, transparent)` : 'none',
          }}
        >
          <Icon
            size={20}
            style={{
              color: hovered ? accent : 'var(--color-primary)',
              transition: 'color 0.3s',
            }}
          />
        </div>
        <h3
          className="font-semibold text-base mb-2 transition-colors duration-300"
          style={{ color: hovered ? accent : 'var(--color-foreground)' }}
        >
          {title}
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          {description}
        </p>
      </div>
    </div>
  )
}

function FeatureGrid() {
  const gridRef = useRef<HTMLDivElement>(null)
  const [visibleSet, setVisibleSet] = useState<Set<number>>(new Set())
  const observedRef = useRef(false)

  useEffect(() => {
    const el = gridRef.current
    if (!el || observedRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observedRef.current = true
          observer.unobserve(el)
          features.forEach((_, i) => {
            setTimeout(() => {
              setVisibleSet(prev => new Set(prev).add(i))
            }, i * 60)
          })
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {features.map((feature, i) => (
        <FeatureCard
          key={feature.title}
          {...feature}
          visible={visibleSet.has(i)}
        />
      ))}
    </div>
  )
}

export function Features() {
  return (
    <section id="features" className="px-6 py-24 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-4xl sm:text-5xl font-bold mb-4">
          <span className="gradient-text">Everything you need.</span>
          <br />
          <span style={{ color: 'var(--color-foreground)' }}>Nothing you don't.</span>
        </h2>
        <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--color-muted-foreground)' }}>
          90+ built-in tools, 23 providers, 6 chat platforms. Not a wrapper, not a demo.
          A complete AI platform built for long-term use on hardware you control.
        </p>
      </div>

      <FeatureGrid />
    </section>
  )
}
