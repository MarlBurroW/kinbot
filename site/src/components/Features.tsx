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
} from 'lucide-react'

const features = [
  {
    icon: Brain,
    title: 'Persistent Kins',
    description:
      'Each agent has a name, role, character, and expertise. They know who they are and who they\'re talking to. One continuous session — never starts from zero.',
  },
  {
    icon: Database,
    title: 'Long-term Memory',
    description:
      'Dual-channel memory system: automatic extraction pipeline on every LLM turn + explicit memorization tools. Hybrid search (vector + full-text) across months of context.',
  },
  {
    icon: GitBranch,
    title: 'Sub-Tasks',
    description:
      'Kins delegate work to ephemeral sub-agents. Await mode re-enters the parent queue with the result. Async mode deposits results as informational messages.',
  },
  {
    icon: Clock,
    title: 'Cron Jobs',
    description:
      'In-process scheduler. Kins create their own cron jobs (with user approval) and execute them autonomously. Results appear in the main session.',
  },
  {
    icon: Shield,
    title: 'Encrypted Vault',
    description:
      'AES-256-GCM encrypted secrets. Never exposed in prompts or logs. Message redaction prevents leaking into compacted summaries. Secrets stay yours.',
  },
  {
    icon: Puzzle,
    title: 'MCP Servers',
    description:
      'Connect any Model Context Protocol server to extend Kins with external tools — databases, APIs, filesystem, code execution, and more.',
  },
  {
    icon: Plug,
    title: 'Multi-Provider',
    description:
      '23 providers — from Anthropic and OpenAI to Ollama for fully local inference. LLM, embedding, image, and search capabilities auto-detected from a single API key.',
  },
  {
    icon: MessageSquare,
    title: 'Inter-Kin Communication',
    description:
      'Request/reply pattern with correlation IDs. Kins collaborate on complex problems. Rate-limited. No ping-pong by design.',
  },
  {
    icon: Webhook,
    title: 'Webhooks & Channels',
    description:
      'Inbound webhooks trigger Kins from external systems. Telegram, Discord, Slack, WhatsApp, and Signal integration lets Kins interact with users on their preferred platform.',
  },
  {
    icon: Wrench,
    title: 'Custom Tools',
    description:
      'Kins create, register, and run their own scripts from their workspace — with user approval. Combined with MCP, they extend their own capabilities without code changes.',
  },
  {
    icon: Users,
    title: 'Multi-User',
    description:
      'Admin and member roles. Invitation system. Shared Kins accessible to all users — messages tagged with sender identity so Kins know who they\'re talking to.',
  },
  {
    icon: AppWindow,
    title: 'Mini Apps',
    description:
      'Kins build and deploy interactive web apps (HTML/CSS/JS) that live in the sidebar. Auto-injected design system with theme sync, toasts, and parent-child communication.',
  },
]

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
          // Stagger each card with 60ms delay
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
      {features.map(({ icon: Icon, title, description }, i) => {
        const visible = visibleSet.has(i)
        return (
          <div
            key={title}
            className="glass-strong gradient-border rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg group"
            style={{
              boxShadow: 'var(--shadow-md)',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.97)',
              transition: 'opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s, scale 0.3s',
            }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
              style={{
                background: 'linear-gradient(135deg, color-mix(in oklch, var(--color-glow-1) 20%, transparent), color-mix(in oklch, var(--color-glow-2) 15%, transparent))',
                border: '1px solid color-mix(in oklch, var(--color-glow-1) 25%, transparent)',
              }}
            >
              <Icon size={20} style={{ color: 'var(--color-primary)' }} />
            </div>
            <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--color-foreground)' }}>
              {title}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
              {description}
            </p>
          </div>
        )
      })}
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
          KinBot is a complete self-hosted AI platform — not a wrapper, not a demo.
          Built for real, long-term use on hardware you control.
        </p>
      </div>

      <FeatureGrid />
    </section>
  )
}
