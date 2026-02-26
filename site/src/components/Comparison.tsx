import { useState } from 'react'
import { Check, X, Minus, ChevronDown } from 'lucide-react'

type Support = 'yes' | 'no' | 'partial'

interface Row {
  feature: string
  kinbot: Support
  chatgpt: Support
  openwebui: Support
  lobechat: Support
  anythingllm: Support
}

type Competitor = 'chatgpt' | 'openwebui' | 'lobechat' | 'anythingllm'

const competitors: { id: Competitor; label: string }[] = [
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'openwebui', label: 'Open WebUI' },
  { id: 'lobechat', label: 'LobeChat' },
  { id: 'anythingllm', label: 'AnythingLLM' },
]

const rows: Row[] = [
  { feature: 'Self-hosted / your data', kinbot: 'yes', chatgpt: 'no', openwebui: 'yes', lobechat: 'yes', anythingllm: 'yes' },
  { feature: 'Persistent agent identity', kinbot: 'yes', chatgpt: 'partial', openwebui: 'no', lobechat: 'partial', anythingllm: 'partial' },
  { feature: 'Long-term memory', kinbot: 'yes', chatgpt: 'partial', openwebui: 'no', lobechat: 'no', anythingllm: 'partial' },
  { feature: 'Session compacting', kinbot: 'yes', chatgpt: 'no', openwebui: 'no', lobechat: 'no', anythingllm: 'no' },
  { feature: 'Inter-agent communication', kinbot: 'yes', chatgpt: 'no', openwebui: 'no', lobechat: 'no', anythingllm: 'no' },
  { feature: 'Sub-tasks / delegation', kinbot: 'yes', chatgpt: 'no', openwebui: 'no', lobechat: 'no', anythingllm: 'no' },
  { feature: 'Cron jobs / autonomy', kinbot: 'yes', chatgpt: 'no', openwebui: 'no', lobechat: 'no', anythingllm: 'no' },
  { feature: 'Encrypted vault', kinbot: 'yes', chatgpt: 'no', openwebui: 'no', lobechat: 'no', anythingllm: 'no' },
  { feature: 'MCP tool servers', kinbot: 'yes', chatgpt: 'no', openwebui: 'yes', lobechat: 'no', anythingllm: 'no' },
  { feature: 'Multi-provider (25+)', kinbot: 'yes', chatgpt: 'no', openwebui: 'yes', lobechat: 'yes', anythingllm: 'yes' },
  { feature: 'Webhooks', kinbot: 'yes', chatgpt: 'no', openwebui: 'no', lobechat: 'no', anythingllm: 'no' },
  { feature: 'Chat integrations (6 platforms)', kinbot: 'yes', chatgpt: 'no', openwebui: 'no', lobechat: 'no', anythingllm: 'no' },
  { feature: 'RAG / document embedding', kinbot: 'no', chatgpt: 'partial', openwebui: 'yes', lobechat: 'partial', anythingllm: 'yes' },
  { feature: 'Multi-user with roles', kinbot: 'yes', chatgpt: 'yes', openwebui: 'yes', lobechat: 'partial', anythingllm: 'yes' },
  { feature: 'Free & open source', kinbot: 'yes', chatgpt: 'no', openwebui: 'yes', lobechat: 'yes', anythingllm: 'yes' },
]

const positioningBlurbs: { id: Competitor; title: string; text: string; when: string }[] = [
  {
    id: 'chatgpt',
    title: 'vs ChatGPT',
    text: "ChatGPT is great for quick questions, but your conversations are ephemeral and your data lives on someone else's servers. KinBot gives you agents that truly remember you, run on your hardware, and work autonomously with cron jobs and webhooks. No subscription, no data sharing, no limits.",
    when: 'If you just need quick one-off answers without caring about privacy or persistence.',
  },
  {
    id: 'openwebui',
    title: 'vs Open WebUI',
    text: "Open WebUI is a solid chat interface for local models. But it treats every conversation as disposable. There's no concept of an agent with a persistent identity, no memory that carries across sessions, and no way for agents to collaborate. If you want a chat UI for Ollama, Open WebUI is solid. If you want AI agents that remember you and work as a team, that's KinBot.",
    when: 'If you just want a nice UI to talk to local models without needing persistence or agent features.',
  },
  {
    id: 'lobechat',
    title: 'vs LobeChat',
    text: 'LobeChat has a beautiful interface and a large plugin marketplace. But like most chat UIs, sessions are ephemeral. You can set system prompts for different personas, but there\'s no real memory, no agent-to-agent communication, and no automation layer. KinBot agents have continuous sessions that never reset, searchable memory, cron jobs, and webhooks.',
    when: 'If you prioritize visual polish and a large plugin marketplace over persistence and autonomy.',
  },
  {
    id: 'anythingllm',
    title: 'vs AnythingLLM',
    text: "AnythingLLM is document-centric: you upload files, it RAGs over them. That's powerful for knowledge bases but fundamentally different from having agents with identities and ongoing memory. AnythingLLM doesn't remember your conversations, it remembers your documents. KinBot agents remember both, plus they extract knowledge automatically from every interaction.",
    when: "If your primary use case is corporate document Q&A rather than persistent AI agents.",
  },
]

function Cell({ value }: { value: Support }) {
  if (value === 'yes') {
    return (
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-full"
        style={{ background: 'color-mix(in oklch, var(--color-glow-1) 20%, transparent)' }}
      >
        <Check size={14} style={{ color: 'var(--color-primary)' }} strokeWidth={3} />
      </span>
    )
  }
  if (value === 'partial') {
    return (
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-full"
        style={{ background: 'color-mix(in oklch, var(--color-muted-foreground) 15%, transparent)' }}
      >
        <Minus size={14} style={{ color: 'var(--color-muted-foreground)' }} strokeWidth={3} />
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-full"
      style={{ background: 'color-mix(in oklch, var(--color-muted-foreground) 10%, transparent)' }}
    >
      <X size={14} style={{ color: 'var(--color-muted-foreground)', opacity: 0.5 }} strokeWidth={3} />
    </span>
  )
}

function CellLabel({ value }: { value: Support }) {
  if (value === 'yes') return <span className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>Yes</span>
  if (value === 'partial') return <span className="text-xs font-medium" style={{ color: 'var(--color-muted-foreground)' }}>Partial</span>
  return <span className="text-xs font-medium" style={{ color: 'var(--color-muted-foreground)', opacity: 0.5 }}>No</span>
}

/** Expandable positioning blurbs */
function PositioningSection() {
  const [expanded, setExpanded] = useState<Competitor | null>(null)

  return (
    <div className="mt-10 space-y-3">
      <p className="text-center text-sm font-medium mb-4" style={{ color: 'var(--color-muted-foreground)' }}>
        Wondering how KinBot stacks up? Read the honest take.
      </p>
      {positioningBlurbs.map(({ id, title, text, when }) => {
        const isOpen = expanded === id
        return (
          <div
            key={id}
            className="glass-strong rounded-xl overflow-hidden transition-all duration-300"
            style={{
              border: isOpen
                ? '1px solid color-mix(in oklch, var(--color-glow-1) 25%, transparent)'
                : '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)',
            }}
          >
            <button
              onClick={() => setExpanded(isOpen ? null : id)}
              className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors duration-150"
              style={{
                background: isOpen
                  ? 'color-mix(in oklch, var(--color-glow-1) 5%, transparent)'
                  : 'transparent',
              }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
                {title}
              </span>
              <ChevronDown
                size={16}
                className="transition-transform duration-300 flex-shrink-0 ml-3"
                style={{
                  color: 'var(--color-muted-foreground)',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </button>
            <div
              className="overflow-hidden transition-all duration-300"
              style={{
                maxHeight: isOpen ? '300px' : '0',
                opacity: isOpen ? 1 : 0,
              }}
            >
              <div className="px-5 pb-5 space-y-3">
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
                  {text}
                </p>
                <div
                  className="text-xs px-3 py-2 rounded-lg"
                  style={{
                    background: 'color-mix(in oklch, var(--color-muted-foreground) 6%, transparent)',
                    color: 'var(--color-muted-foreground)',
                  }}
                >
                  <span className="font-semibold">When to pick the other tool: </span>
                  {when}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Mobile: compare KinBot vs one selected competitor, card-style */
function MobileComparison() {
  const [selected, setSelected] = useState<Competitor>('chatgpt')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const competitor = competitors.find(c => c.id === selected)!

  const kinbotWins = rows.filter(r => {
    const k = r.kinbot
    const c = r[selected]
    if (k === 'yes' && c !== 'yes') return true
    return false
  }).length

  return (
    <div className="md:hidden">
      {/* Competitor selector */}
      <div className="relative mb-6">
        <button
          onClick={() => setDropdownOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl glass-strong text-sm font-medium"
          style={{ color: 'var(--color-foreground)' }}
        >
          <span>
            <span className="gradient-text font-semibold">KinBot</span>
            <span style={{ color: 'var(--color-muted-foreground)' }}> vs </span>
            <span>{competitor.label}</span>
          </span>
          <ChevronDown
            size={16}
            className="transition-transform duration-200"
            style={{
              color: 'var(--color-muted-foreground)',
              transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </button>
        {dropdownOpen && (
          <div
            className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-10 glass-strong"
            style={{ border: '1px solid var(--color-border)' }}
          >
            {competitors.map(c => (
              <button
                key={c.id}
                onClick={() => { setSelected(c.id); setDropdownOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-sm transition-colors duration-150"
                style={{
                  color: c.id === selected ? 'var(--color-primary)' : 'var(--color-foreground)',
                  background: c.id === selected ? 'color-mix(in oklch, var(--color-glow-1) 8%, transparent)' : 'transparent',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Score summary */}
      <div
        className="flex items-center justify-center gap-2 mb-6 px-4 py-2.5 rounded-xl text-sm font-medium"
        style={{
          background: 'color-mix(in oklch, var(--color-glow-1) 8%, transparent)',
          color: 'var(--color-primary)',
          border: '1px solid color-mix(in oklch, var(--color-glow-1) 20%, transparent)',
        }}
      >
        KinBot leads on {kinbotWins} of {rows.length} features
      </div>

      {/* Feature cards */}
      <div className="space-y-2">
        {rows.map((row) => {
          const kinbotVal = row.kinbot
          const competitorVal = row[selected]
          const kinbotBetter = kinbotVal === 'yes' && competitorVal !== 'yes'

          return (
            <div
              key={row.feature}
              className="flex items-center justify-between px-4 py-3 rounded-xl transition-colors duration-150"
              style={{
                background: kinbotBetter
                  ? 'color-mix(in oklch, var(--color-glow-1) 5%, transparent)'
                  : 'color-mix(in oklch, var(--color-muted-foreground) 3%, transparent)',
                border: kinbotBetter
                  ? '1px solid color-mix(in oklch, var(--color-glow-1) 12%, transparent)'
                  : '1px solid color-mix(in oklch, var(--color-border) 30%, transparent)',
              }}
            >
              <span className="text-sm flex-1 pr-4" style={{ color: 'var(--color-foreground)' }}>
                {row.feature}
              </span>
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="flex flex-col items-center gap-0.5 w-14">
                  <Cell value={kinbotVal} />
                  <span className="text-[10px] font-medium gradient-text">KinBot</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 w-14">
                  <Cell value={competitorVal} />
                  <CellLabel value={competitorVal} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Desktop: full comparison table */
function DesktopComparison() {
  return (
    <div
      className="hidden md:block glass-strong gradient-border rounded-2xl overflow-hidden"
      style={{ boxShadow: 'var(--shadow-md)' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' }}>
              <th
                className="text-left py-4 px-5 font-semibold"
                style={{ color: 'var(--color-foreground)' }}
              >
                Feature
              </th>
              <th className="py-4 px-4 text-center font-semibold">
                <span className="gradient-text">KinBot</span>
              </th>
              {competitors.map(c => (
                <th
                  key={c.id}
                  className="py-4 px-4 text-center font-medium"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.feature}
                className="transition-colors duration-150"
                style={{
                  borderBottom:
                    i < rows.length - 1
                      ? '1px solid color-mix(in oklch, var(--color-border) 30%, transparent)'
                      : undefined,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    'color-mix(in oklch, var(--color-glow-1) 5%, transparent)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <td className="py-3 px-5" style={{ color: 'var(--color-foreground)' }}>
                  {row.feature}
                </td>
                <td className="py-3 px-4 text-center">
                  <Cell value={row.kinbot} />
                </td>
                {competitors.map(c => (
                  <td key={c.id} className="py-3 px-4 text-center">
                    <Cell value={row[c.id]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function Comparison() {
  return (
    <section id="comparison" className="px-6 py-24 max-w-5xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-4xl sm:text-5xl font-bold mb-4">
          <span className="gradient-text">How KinBot compares.</span>
        </h2>
        <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--color-muted-foreground)' }}>
          Not another chat wrapper. KinBot gives your agents identity, memory, and autonomy.
        </p>
      </div>

      <MobileComparison />
      <DesktopComparison />

      <p className="text-center mt-6 text-xs" style={{ color: 'var(--color-muted-foreground)', opacity: 0.7 }}>
        Comparison based on default capabilities as of February 2026. Some features may be available via plugins.
      </p>

      <PositioningSection />
    </section>
  )
}
