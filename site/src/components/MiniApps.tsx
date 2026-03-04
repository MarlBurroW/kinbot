import { useEffect, useMemo, useRef, useState } from 'react'
import { highlight } from 'sugar-high'
import {
  Blocks,
  Code2,
  Palette,
  Database,
  Puzzle,
  Globe,
  LayoutDashboard,
  Gamepad2,
  ClipboardList,
  BarChart3,
  Server,
  Sparkles,
} from 'lucide-react'

/* ── SDK capabilities ───────────────────────────────────────────────────── */

const sdkCapabilities = [
  {
    icon: Palette,
    title: 'Theme-Aware Design System',
    description:
      'Full CSS design system with tokens, components, and automatic light/dark mode. Your apps look native to KinBot without any extra work.',
    color: 'var(--color-glow-1)',
  },
  {
    icon: Database,
    title: 'Persistent Storage',
    description:
      'Key-value storage API backed by the server. Apps keep their state across sessions. No localStorage hacks, no cookies.',
    color: 'var(--color-glow-2)',
  },
  {
    icon: Server,
    title: 'Real Backend Logic',
    description:
      'Each app can include a _server.js with custom API routes. Full request/response cycle, server-side state, SSE events. Not just a frontend toy.',
    color: 'var(--color-glow-3)',
  },
  {
    icon: Globe,
    title: 'CORS-Free HTTP Proxy',
    description:
      'Fetch any external API through KinBot.http() without CORS restrictions. Your mini-apps can talk to the world.',
    color: 'var(--color-glow-1)',
  },
  {
    icon: Puzzle,
    title: 'Rich Integration APIs',
    description:
      'Clipboard, toasts, modals, confirm/prompt dialogs, notifications, badges, keyboard shortcuts, inter-app sharing, and more.',
    color: 'var(--color-glow-2)',
  },
  {
    icon: Sparkles,
    title: 'Kin Memory & Conversation',
    description:
      'Apps can search and store memories, read conversation history, and send messages back to the Kin. Deep integration, not isolation.',
    color: 'var(--color-glow-3)',
  },
]

/* ── Example apps ───────────────────────────────────────────────────────── */

const exampleApps = [
  { icon: LayoutDashboard, label: 'Dashboards', color: 'var(--color-glow-1)' },
  { icon: ClipboardList, label: 'Task trackers', color: 'var(--color-glow-2)' },
  { icon: BarChart3, label: 'Data viz', color: 'var(--color-glow-3)' },
  { icon: Gamepad2, label: 'Games', color: 'var(--color-glow-1)' },
  { icon: Code2, label: 'Dev tools', color: 'var(--color-glow-2)' },
  { icon: Globe, label: 'API clients', color: 'var(--color-glow-3)' },
]

/* ── Code snippet ───────────────────────────────────────────────────────── */

const codeSnippet = `// Your Kin generates this during conversation
import { useKinBot } from '@kinbot/react'
import { Card, Stat } from '@kinbot/components'

function App() {
  const { theme, storage } = useKinBot()
  const [count, setCount] = storage.use('visits', 0)

  return (
    <Card title="Welcome back">
      <Stat label="Visits" value={count} />
    </Card>
  )
}`

/* ── Subcomponents ──────────────────────────────────────────────────────── */

function CapabilityCard({
  icon: Icon,
  title,
  description,
  color,
}: {
  icon: typeof Blocks
  title: string
  description: string
  color: string
}) {
  return (
    <div
      className="group relative glass-strong rounded-xl p-5 transition-all duration-300 hover:scale-[1.02]"
      style={{
        border: `1px solid color-mix(in oklch, ${color} 15%, transparent)`,
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
        style={{
          background: `color-mix(in oklch, ${color} 12%, transparent)`,
          border: `1px solid color-mix(in oklch, ${color} 25%, transparent)`,
        }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <h3
        className="text-sm font-semibold mb-1.5"
        style={{ color: 'var(--color-foreground)' }}
      >
        {title}
      </h3>
      <p
        className="text-xs leading-relaxed"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        {description}
      </p>
    </div>
  )
}

function ExamplePill({
  icon: Icon,
  label,
  color,
  index,
  visible,
}: {
  icon: typeof Blocks
  label: string
  color: string
  index: number
  visible: boolean
}) {
  return (
    <div
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-strong"
      style={{
        border: `1px solid color-mix(in oklch, ${color} 20%, transparent)`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: `opacity 0.4s ${index * 80}ms, transform 0.4s ${index * 80}ms`,
      }}
    >
      <Icon size={14} style={{ color }} />
      <span className="text-xs font-medium" style={{ color: 'var(--color-foreground)' }}>
        {label}
      </span>
    </div>
  )
}

function CodeBlock({ code }: { code: string }) {
  const html = useMemo(() => highlight(code), [code])
  return (
    <pre
      className="sh p-4 text-xs leading-relaxed overflow-x-auto"
      style={{ fontFamily: 'var(--font-mono, ui-monospace, monospace)' }}
    >
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  )
}

/* ── Main section ───────────────────────────────────────────────────────── */

export function MiniApps() {
  const pillsRef = useRef<HTMLDivElement>(null)
  const [pillsVisible, setPillsVisible] = useState(false)

  useEffect(() => {
    const el = pillsRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPillsVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.2 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="mini-apps" className="px-6 py-24 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'color-mix(in oklch, var(--color-glow-1) 12%, transparent)',
              border: '1px solid color-mix(in oklch, var(--color-glow-1) 25%, transparent)',
            }}
          >
            <Blocks size={20} style={{ color: 'var(--color-primary)' }} />
          </div>
        </div>
        <h2 className="text-4xl sm:text-5xl font-bold mb-4">
          <span style={{ color: 'var(--color-foreground)' }}>Oh, and they</span>{' '}
          <span className="gradient-text">build apps too.</span>
        </h2>
        <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--color-muted-foreground)' }}>
          Your Kins already chat, use tools, remember everything, run cron jobs, collaborate
          with each other, and connect to your favorite channels. On top of all that, they can
          also create full interactive applications from scratch, right inside the conversation.
          Real React UIs, real backend logic, real persistent storage.
        </p>
      </div>

      {/* What you can build */}
      <div ref={pillsRef} className="flex flex-wrap justify-center gap-3 mb-14">
        {exampleApps.map((app, i) => (
          <ExamplePill key={app.label} {...app} index={i} visible={pillsVisible} />
        ))}
      </div>

      {/* Two-column: code + explanation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-14">
        {/* Code preview */}
        <div
          className="glass-strong rounded-xl overflow-hidden"
          style={{
            border: '1px solid color-mix(in oklch, var(--color-glow-1) 15%, transparent)',
          }}
        >
          <div
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium"
            style={{
              borderBottom: '1px solid color-mix(in oklch, var(--color-glow-1) 10%, transparent)',
              color: 'var(--color-muted-foreground)',
            }}
          >
            <Code2 size={13} />
            <span>Generated by your Kin</span>
            <span
              className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{
                background: 'color-mix(in oklch, var(--color-glow-2) 15%, transparent)',
                color: 'var(--color-glow-2)',
              }}
            >
              React + SDK
            </span>
          </div>
          <CodeBlock code={codeSnippet} />
        </div>

        {/* How it works */}
        <div className="flex flex-col gap-4 justify-center">
          {[
            {
              step: '1',
              title: 'You describe what you need',
              desc: 'In the same conversation where your Kin manages your calendar and searches the web, just say "build me a habit tracker with streaks."',
            },
            {
              step: '2',
              title: 'Your Kin writes the entire app',
              desc: 'Frontend components, backend routes, storage schema. Multi-file React app with importmaps for dependencies.',
            },
            {
              step: '3',
              title: 'It runs inside KinBot instantly',
              desc: 'Theme-aware, persistent, with its own API. Update it by just asking. No deploy, no build step.',
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex gap-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                style={{
                  background: 'color-mix(in oklch, var(--color-glow-1) 12%, transparent)',
                  border: '1px solid color-mix(in oklch, var(--color-glow-1) 25%, transparent)',
                  color: 'var(--color-primary)',
                }}
              >
                {step}
              </div>
              <div>
                <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--color-foreground)' }}>
                  {title}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Capabilities grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {sdkCapabilities.map((cap) => (
          <CapabilityCard key={cap.title} {...cap} />
        ))}
      </div>

      {/* Differentiator callout */}
      <div
        className="glass-strong rounded-xl p-5 flex items-start gap-4 max-w-2xl mx-auto"
        style={{
          background: 'color-mix(in oklch, var(--color-glow-1) 3%, var(--color-card))',
          border: '1px solid color-mix(in oklch, var(--color-glow-1) 15%, transparent)',
        }}
      >
        <Blocks size={20} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>
            Not just code in an iframe.
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
            Mini-Apps are a full platform: SDK v1.15 with 40+ APIs, a component library (@kinbot/components),
            server-side backends with SSE events, CORS-free HTTP proxy, inter-app communication,
            Kin memory access, and a design system that follows your theme. All this on top of
            the 90+ built-in tools, long-term memory, and multi-agent capabilities your Kins already have.
          </p>
        </div>
      </div>
    </section>
  )
}
