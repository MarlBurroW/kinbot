import {
  Server,
  BookOpen,
  Code2,
  Home,
  Users,
  Briefcase,
} from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

interface UseCase {
  icon: Icon
  title: string
  description: string
  agents: string[]
  highlight: string
}

const useCases: UseCase[] = [
  {
    icon: Server,
    title: 'Homelab assistant',
    description:
      'A Kin that monitors your services, remembers every config change, and alerts you when something breaks. Ask it "what did we change on the reverse proxy last week?" and get an instant answer.',
    agents: ['SysAdmin Kin', 'Monitoring Kin'],
    highlight: 'Remembers every config change',
  },
  {
    icon: Code2,
    title: 'Dev team',
    description:
      'A code reviewer, an architecture advisor, and a documentation writer that share context. The reviewer flags issues, the architect suggests patterns, and the writer keeps your docs in sync.',
    agents: ['Reviewer', 'Architect', 'DocWriter'],
    highlight: 'Agents collaborate on PRs',
  },
  {
    icon: BookOpen,
    title: 'Research & learning',
    description:
      'A research Kin that reads papers, extracts key findings, and builds a knowledge base over weeks. Come back months later and ask "what did we learn about transformer efficiency?" — it remembers.',
    agents: ['Research Kin', 'Summary Kin'],
    highlight: 'Knowledge compounds over time',
  },
  {
    icon: Home,
    title: 'Smart home brain',
    description:
      'Connect a Kin to your home automation via webhooks. It learns your preferences, schedules routines, and adapts over time. "Why is the heating on?" — it explains its reasoning.',
    agents: ['Home Kin'],
    highlight: 'Learns your habits',
  },
  {
    icon: Users,
    title: 'Family / team hub',
    description:
      'Shared Kins accessible via Telegram or Discord. A cooking Kin that remembers everyone\'s dietary preferences, a trip planner that knows your past vacations and budget.',
    agents: ['Chef Kin', 'Travel Kin'],
    highlight: 'Multi-user via chat platforms',
  },
  {
    icon: Briefcase,
    title: 'Freelance ops',
    description:
      'A client manager that tracks projects, deadlines, and conversations across channels. A finance Kin that remembers invoicing patterns. Delegate between them with sub-tasks.',
    agents: ['Client Kin', 'Finance Kin'],
    highlight: 'Cross-agent delegation',
  },
]

function UseCaseCard({ useCase }: { useCase: UseCase }) {
  const { icon: Icon, title, description, agents, highlight } = useCase

  return (
    <div
      className="glass-strong rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] group"
      style={{
        border: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor =
          'color-mix(in oklch, var(--color-glow-1) 30%, transparent)'
        e.currentTarget.style.boxShadow =
          '0 0 30px color-mix(in oklch, var(--color-glow-1) 10%, transparent)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor =
          'color-mix(in oklch, var(--color-border) 50%, transparent)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Icon + highlight badge */}
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
          style={{
            background:
              'linear-gradient(135deg, color-mix(in oklch, var(--color-glow-1) 15%, transparent), color-mix(in oklch, var(--color-glow-2) 10%, transparent))',
            border: '1px solid color-mix(in oklch, var(--color-glow-1) 20%, transparent)',
          }}
        >
          <Icon size={20} style={{ color: 'var(--color-primary)' }} />
        </div>
        <span
          className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
          style={{
            background: 'color-mix(in oklch, var(--color-glow-1) 8%, transparent)',
            color: 'var(--color-primary)',
            border: '1px solid color-mix(in oklch, var(--color-glow-1) 15%, transparent)',
          }}
        >
          {highlight}
        </span>
      </div>

      {/* Title */}
      <h3
        className="text-lg font-semibold mb-2"
        style={{ color: 'var(--color-foreground)' }}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        className="text-sm leading-relaxed mb-4"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        {description}
      </p>

      {/* Agent pills */}
      <div className="flex flex-wrap gap-1.5">
        {agents.map((agent) => (
          <span
            key={agent}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
            style={{
              background: 'color-mix(in oklch, var(--color-muted-foreground) 8%, transparent)',
              color: 'var(--color-muted-foreground)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--color-primary)' }}
            />
            {agent}
          </span>
        ))}
      </div>
    </div>
  )
}

export function UseCases() {
  return (
    <section id="use-cases" className="px-6 py-24 max-w-6xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-4xl sm:text-5xl font-bold mb-4">
          <span style={{ color: 'var(--color-foreground)' }}>What will</span>{' '}
          <span className="gradient-text">you build?</span>
        </h2>
        <p
          className="text-lg max-w-2xl mx-auto"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          KinBot isn't a chatbot. It's a platform for persistent, collaborative AI agents.
          Here's what people are building.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {useCases.map((uc) => (
          <UseCaseCard key={uc.title} useCase={uc} />
        ))}
      </div>
    </section>
  )
}
