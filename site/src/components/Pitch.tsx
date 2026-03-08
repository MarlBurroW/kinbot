import { useRef, useEffect, useState } from 'react'
import { Server, Brain, Users, Shield, Puzzle, MessageSquare } from 'lucide-react'

const points = [
  {
    icon: Server,
    title: 'Runs on your hardware',
    desc: 'Install on any Linux or macOS machine. Your data never leaves your network. No cloud account, no subscription.',
    color: 'var(--color-glow-3)',
  },
  {
    icon: Brain,
    title: 'Agents with real memory',
    desc: 'Each agent (called a "Kin") remembers past conversations, extracts facts, and builds context over time. Not just chat history, actual persistent knowledge.',
    color: 'var(--color-glow-1)',
  },
  {
    icon: Users,
    title: 'Multi-agent collaboration',
    desc: 'Create specialized agents (dev, writer, analyst...) and let them delegate tasks to each other. A Hub Kin routes your requests to the right specialist.',
    color: 'var(--color-glow-2)',
  },
  {
    icon: Puzzle,
    title: 'Any LLM provider',
    desc: 'Works with 23+ providers: OpenAI, Anthropic, Ollama, local models, whatever. Swap models per agent. Ollama is auto-detected, no API key needed.',
    color: 'var(--color-primary)',
  },
  {
    icon: MessageSquare,
    title: 'Talk from anywhere',
    desc: 'Web UI, Telegram, Discord, Slack, WhatsApp, Signal. Connect a channel and your agents are reachable from any platform.',
    color: 'var(--color-glow-3)',
  },
  {
    icon: Shield,
    title: 'Zero dependencies',
    desc: 'No Postgres, no Redis, no Docker required. One process, one SQLite file. Backup is copying a folder. Updates are pulling and rebuilding.',
    color: 'var(--color-glow-1)',
  },
]

function PitchCard({
  icon: Icon,
  title,
  desc,
  color,
  index,
}: {
  icon: React.ComponentType<{ size: number; style?: React.CSSProperties }>
  title: string
  desc: string
  color: string
  index: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className="glass-strong rounded-xl p-5 transition-all duration-300 hover:scale-[1.02]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: `1px solid color-mix(in oklch, ${color} ${hovered ? '40%' : '20%'}, transparent)`,
        boxShadow: hovered
          ? `0 0 24px color-mix(in oklch, ${color} 15%, transparent), 0 0 48px color-mix(in oklch, ${color} 8%, transparent)`
          : 'none',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.08}s, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.08}s, border-color 0.3s ease, box-shadow 0.3s ease`,
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-all duration-300"
        style={{
          background: `color-mix(in oklch, ${color} ${hovered ? '22%' : '14%'}, transparent)`,
          border: `1px solid color-mix(in oklch, ${color} ${hovered ? '40%' : '28%'}, transparent)`,
        }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <h3 className="text-sm font-semibold mb-1.5" style={{ color: 'var(--color-foreground)' }}>
        {title}
      </h3>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
        {desc}
      </p>
    </div>
  )
}

export function Pitch() {
  return (
    <section className="px-6 py-24 max-w-5xl mx-auto">
      <div className="text-center mb-14">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--color-foreground)' }}>
          What is KinBot?
        </h2>
        <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--color-muted-foreground)' }}>
          An open-source platform for running persistent AI agents on your own server.
          Think of it as a self-hosted team of AI assistants that actually remember who you are.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {points.map(({ icon: Icon, title, desc, color }, i) => (
          <PitchCard key={title} icon={Icon} title={title} desc={desc} color={color} index={i} />
        ))}
      </div>
    </section>
  )
}
