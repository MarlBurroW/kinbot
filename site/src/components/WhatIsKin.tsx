import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import { User, Github, Code2, Globe, Search, FileEdit, Lock, Send, MessageCircle, Hash, ShieldCheck, Slack } from 'lucide-react'

// Container fixed at 480px so SVG path endpoints align with CSS grid columns.
// 3 columns with no CSS gap (spacing comes from px-2 inside each cell).
// Column centers in SVG viewBox (0–480): 80, 240, 400 (i.e. 1/6, 1/2, 5/6 × 480).
const CONTAINER_W = 480
const FANOUT_H    = 52
const COL_CX      = [80, 240, 400] as const  // SVG x of each sub-Kin center
const MAIN_COLOR  = 'var(--color-primary)'

// The channel the message is shown flowing through
const ACTIVE_CHANNEL_COLOR = '#5865F2'

// Dot arrival offsets — delay + (duration × fraction) = arrival time at target node.
// CSS wik-flow-down: visible 10%→90%, "arrives" near 90% of animation duration.
// SVG animateMotion: motion completes at keyTime 0.65 of animation duration.
const FLOW_ARRIVE   = (delay: string, dur = 1.8) => parseFloat(delay) + dur * 0.9
const FANOUT_ARRIVE = (delay: string, dur = 1.5) => parseFloat(delay) + dur * 0.65
const TOOL_ARRIVE   = (delay: string, dur = 1.2) => parseFloat(delay) + dur * 0.65
const s = (n: number) => `${n.toFixed(2)}s`

type Channel = { id: string; label: string; Icon: LucideIcon; color: string; active?: boolean }
type Tool = { id: string; label: string; Icon: LucideIcon; color: string }
type SubKin = {
  id: string; label: string; sublabel: string; color: string
  fanDelays: string[]   // animated dot delays on the fan-out paths
  toolDelays: string[]  // animated dot delays on tool fan-out (one per tool)
  tools: Tool[]
}

const CHANNELS: Channel[] = [
  { id: 'telegram', label: 'Telegram', Icon: Send,         color: '#3B9EDA' },
  { id: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle,color: '#25D366' },
  { id: 'discord',  label: 'Discord',  Icon: Slack,        color: '#5865F2', active: true },
  { id: 'signal',   label: 'Signal',   Icon: ShieldCheck,  color: '#3A76F0' },
  { id: 'slack',    label: 'Slack',    Icon: Hash,         color: '#E01E5A' },
]

const SUB_KINS: SubKin[] = [
  {
    id: 'dev', label: 'Dev Kin', sublabel: 'Code review',
    color: 'var(--color-glow-3)',
    fanDelays: ['0.9s', '2.2s'], toolDelays: ['2.0s', '3.0s'],
    tools: [
      { id: 'github', label: 'GitHub', Icon: Github, color: '#94a3b8'              },
      { id: 'code',   label: 'Code',   Icon: Code2,  color: 'var(--color-glow-3)' },
    ],
  },
  {
    id: 'analyst', label: 'Analyst Kin', sublabel: 'Research',
    color: 'var(--color-glow-2)',
    fanDelays: ['1.2s', '2.5s'], toolDelays: ['2.3s', '3.3s'],
    tools: [
      { id: 'web',    label: 'Web',    Icon: Globe,  color: '#3B9EDA'              },
      { id: 'search', label: 'Search', Icon: Search, color: 'var(--color-glow-2)' },
    ],
  },
  {
    id: 'editor', label: 'Editor Kin', sublabel: 'Writes summary',
    color: '#10B981',
    fanDelays: ['1.5s', '2.8s'], toolDelays: ['2.6s', '3.6s'],
    tools: [
      { id: 'edit',  label: 'Edit',  Icon: FileEdit, color: '#10B981'  },
      { id: 'vault', label: 'Vault', Icon: Lock,     color: MAIN_COLOR },
    ],
  },
]

// ── Node receive ping ─────────────────────────────────────────────────
// Absolute overlay on a card/chip. Flashes a glow when the incoming dot arrives.
// arrivalDelay = delay + (animDuration × travelFraction) for that connector's dot.
// period       = animation duration of that connector's dots (so ping repeats in sync).
function NodePing({ color, arrivalDelay, period, radius = '1rem' }: {
  color: string; arrivalDelay: string; period: string; radius?: string
}) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        borderRadius: radius,
        '--wik-ping-color': `color-mix(in oklch, ${color} 55%, transparent)`,
        animationName: 'wik-node-ping',
        animationDuration: period,
        animationDelay: arrivalDelay,
        animationTimingFunction: 'ease-out',
        animationIterationCount: 'infinite',
      } as CSSProperties}
    />
  )
}

// ── Kin avatar ────────────────────────────────────────────────────────
function KinAvatar({ color, size = 44 }: { color: string; size?: number }) {
  const dot = Math.max(6, Math.round(size * 0.15))
  const dotOffset = Math.round(size * 0.1)
  return (
    <div
      className="relative flex-shrink-0 flex items-center justify-center rounded-full"
      style={{
        width: size, height: size,
        background: `radial-gradient(circle at 35% 30%,
          color-mix(in oklch, ${color} 28%, var(--color-background)),
          color-mix(in oklch, ${color} 12%, var(--color-background)))`,
        border: `1.5px solid color-mix(in oklch, ${color} 45%, transparent)`,
        boxShadow: `0 0 18px color-mix(in oklch, ${color} 22%, transparent)`,
      }}
    >
      <span style={{ color, fontSize: Math.round(size * 0.38), fontWeight: 900, lineHeight: 1 }}>K</span>
      <span
        className="absolute rounded-full"
        style={{ top: dotOffset, right: dotOffset, width: dot, height: dot, background: '#10B981', boxShadow: '0 0 5px #10B981' }}
      />
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0" style={{
      background: `color-mix(in oklch, ${color} 14%, transparent)`,
      color,
    }}>
      {label}
    </span>
  )
}

// ── Vertical animated connector ───────────────────────────────────────
function FlowConnector({ color, label, dotDelays, height = 56 }: {
  color: string; label?: string; dotDelays: string[]; height?: number
}) {
  return (
    <div className="relative flex justify-center overflow-hidden" style={{ height }}>
      <div style={{
        position: 'absolute', top: 0, bottom: 0, width: 0,
        borderLeft: `1.5px dashed color-mix(in oklch, ${color} 30%, transparent)`,
      }} />
      {dotDelays.map((delay, i) => (
        <div key={i} className="wik-flow-dot" style={{
          background: color,
          boxShadow: `0 0 8px ${color}`,
          animationDuration: '1.8s',
          animationDelay: delay,
        }} />
      ))}
      {label && (
        <span style={{
          position: 'absolute', left: 'calc(50% + 14px)', top: '50%',
          transform: 'translateY(-50%)', fontSize: 10, fontStyle: 'italic',
          whiteSpace: 'nowrap', color: 'var(--color-muted-foreground)',
        }}>
          {label}
        </span>
      )}
    </div>
  )
}

// ── Channels row ──────────────────────────────────────────────────────
// The active channel (Discord) gets a NodePing timed to when the dot from
// the "You → Channels" connector arrives (delay=0s, dur=1.8s, arrive at 90%).
function ChannelsRow() {
  const channelArrival = s(FLOW_ARRIVE('0s'))  // 1.62s
  return (
    <div className="flex justify-center gap-1.5 flex-wrap">
      {CHANNELS.map(ch => (
        <div
          key={ch.id}
          className="relative flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium"
          style={{
            background: `color-mix(in oklch, ${ch.color} ${ch.active ? '18' : '8'}%, transparent)`,
            border: `1px solid color-mix(in oklch, ${ch.color} ${ch.active ? '55' : '22'}%, transparent)`,
            color: ch.active ? ch.color : `color-mix(in oklch, ${ch.color} 70%, var(--color-muted-foreground))`,
            boxShadow: ch.active ? `0 0 14px color-mix(in oklch, ${ch.color} 28%, transparent)` : undefined,
            opacity: ch.active ? 1 : 0.55,
          }}
        >
          <ch.Icon size={11} strokeWidth={1.5} />
          <span>{ch.label}</span>
          {ch.active && (
            <NodePing color={ch.color} arrivalDelay={channelArrival} period="1.8s" radius="9999px" />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Fan-out SVG: Main Kin → 3 Sub-Kins ───────────────────────────────
// viewBox = 0 0 CONTAINER_W FANOUT_H with preserveAspectRatio="none"
// Column centers (1/6, 1/2, 5/6) stay aligned with grid-cols-3 at any width.
function DispatchFanOut() {
  return (
    <svg
      style={{ width: '100%', height: FANOUT_H, display: 'block' }}
      viewBox={`0 0 ${CONTAINER_W} ${FANOUT_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {SUB_KINS.map((kin, i) => {
        const cx = COL_CX[i]
        const mid = CONTAINER_W / 2
        const d = cx === mid
          ? `M ${mid} 0 L ${mid} ${FANOUT_H}`
          : `M ${mid} 0 C ${mid} ${FANOUT_H * 0.5} ${cx} ${FANOUT_H * 0.5} ${cx} ${FANOUT_H}`
        return (
          <g key={kin.id}>
            <path d={d} fill="none" style={{
              stroke: `color-mix(in oklch, ${kin.color} 35%, transparent)`,
              strokeWidth: 1.5,
              strokeDasharray: '4 5',
            }} />
            {kin.fanDelays.map((delay, j) => (
              <circle key={j} r={3.5} style={{ fill: kin.color }}>
                <animateMotion
                  dur="1.5s" begin={delay} repeatCount="indefinite"
                  keyPoints="0;1;1" keyTimes="0;0.65;1" calcMode="linear"
                  path={d}
                />
                <animate
                  attributeName="opacity" values="0;1;1;0;0"
                  keyTimes="0;0.06;0.58;0.68;1"
                  dur="1.5s" begin={delay} repeatCount="indefinite"
                />
              </circle>
            ))}
          </g>
        )
      })}
    </svg>
  )
}

// ── Tool fan-out SVG: Sub-Kin → 2 tools ──────────────────────────────
// Paths from (50,0) to (25,H) and (75,H); preserveAspectRatio="none"
// stretches to column width — tool chips at flex-1 align with endpoints.
function ToolFanOut({ color, toolDelays }: { color: string; toolDelays: string[] }) {
  const H = 32
  const W = 100
  const paths = [
    `M 50 0 C 50 ${H * 0.5} 25 ${H * 0.5} 25 ${H}`,
    `M 50 0 C 50 ${H * 0.5} 75 ${H * 0.5} 75 ${H}`,
  ]
  return (
    <svg
      style={{ width: '100%', height: H, display: 'block' }}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <g key={i}>
          <path d={d} fill="none" style={{
            stroke: `color-mix(in oklch, ${color} 35%, transparent)`,
            strokeWidth: 1.5,
            strokeDasharray: '3 4',
          }} />
          <circle r={3} style={{ fill: color }}>
            <animateMotion
              dur="1.2s" begin={toolDelays[i] ?? '0s'} repeatCount="indefinite"
              keyPoints="0;1;1" keyTimes="0;0.65;1" calcMode="linear"
              path={d}
            />
            <animate
              attributeName="opacity" values="0;1;1;0;0"
              keyTimes="0;0.1;0.55;0.65;1"
              dur="1.2s" begin={toolDelays[i] ?? '0s'} repeatCount="indefinite"
            />
          </circle>
        </g>
      ))}
    </svg>
  )
}

// ── Compact sub-Kin card ──────────────────────────────────────────────
// pingDelay = when the dot from Main Kin's fan-out arrives at this card.
function SubKinCard({ kin, pingDelay }: { kin: SubKin; pingDelay: string }) {
  return (
    <div className="relative w-full glass-strong rounded-xl p-2" style={{
      border: `1px solid color-mix(in oklch, ${kin.color} 38%, transparent)`,
      boxShadow: `0 0 18px color-mix(in oklch, ${kin.color} 14%, transparent)`,
    }}>
      <div className="flex items-center gap-1.5 mb-1">
        <KinAvatar color={kin.color} size={28} />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold leading-tight truncate" style={{ color: 'var(--color-foreground)' }}>
            {kin.label}
          </p>
          <p className="text-[9px] leading-tight" style={{ color: 'var(--color-muted-foreground)' }}>
            {kin.sublabel}
          </p>
        </div>
      </div>
      <Badge label="Expert" color={kin.color} />
      <NodePing color={kin.color} arrivalDelay={pingDelay} period="1.5s" radius="0.75rem" />
    </div>
  )
}

// ── Tool chips (horizontal, 2 side by side) ───────────────────────────
// pingDelays[i] = when the tool fan-out dot arrives at tool i.
function ToolChips({ tools, pingDelays }: { tools: Tool[]; pingDelays: string[] }) {
  return (
    <div className="w-full flex gap-1">
      {tools.map((t, i) => (
        <div
          key={t.id}
          className="relative flex-1 flex items-center gap-1 rounded-lg px-1.5 py-1 text-[9px] font-medium min-w-0"
          style={{
            background: `color-mix(in oklch, var(--color-background) 80%, ${t.color} 20%)`,
            border: `1px solid color-mix(in oklch, ${t.color} 35%, transparent)`,
            color: t.color,
          }}
        >
          <t.Icon size={10} strokeWidth={1.5} style={{ flexShrink: 0 }} />
          <span className="truncate">{t.label}</span>
          <NodePing color={t.color} arrivalDelay={pingDelays[i]} period="1.2s" radius="0.5rem" />
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────
export function WhatIsKin() {
  // Main Kin receives the dot from the "Channels → Main Kin" connector
  // (delay=0.3s, dur=1.8s, arrives at 90% of duration).
  const mainKinPingDelay = s(FLOW_ARRIVE('0.3s'))  // 1.92s

  return (
    <section id="what-is-a-kin" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium mb-6"
            style={{
              background: 'color-mix(in oklch, var(--color-glow-1) 10%, transparent)',
              border: '1px solid color-mix(in oklch, var(--color-glow-1) 30%, transparent)',
              color: 'var(--color-primary)',
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{
              background: 'var(--color-primary)', boxShadow: '0 0 8px var(--color-primary)',
            }} />
            Core concept
          </div>

          <h2 className="gradient-text text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            What&rsquo;s a Kin?
          </h2>

          <p className="text-lg max-w-2xl mx-auto leading-relaxed"
            style={{ color: 'var(--color-muted-foreground)' }}>
            A Kin is a specialized AI agent that lives on your server — with its own identity,
            memory, and expertise. Kins delegate, collaborate, and call tools to get things done.
          </p>
        </div>

        {/* ── Sequence diagram ── */}
        <div style={{ maxWidth: CONTAINER_W, margin: '0 auto' }}>

          {/* 1 ─ User */}
          <div className="glass-strong gradient-border rounded-2xl p-4 flex items-center gap-4">
            <div
              className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
              style={{ background: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
            >
              <User size={20} style={{ color: 'var(--color-muted-foreground)' }} />
            </div>
            <div>
              <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--color-foreground)' }}>You</p>
              <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                "Can you review my PR and write release notes?"
              </p>
            </div>
          </div>

          {/* Short connector: You → Channels */}
          <FlowConnector color="var(--color-muted-foreground)" dotDelays={['0s', '1.1s']} height={28} />

          {/* 2 ─ Channels (active channel gets a ping when the dot arrives) */}
          <ChannelsRow />

          {/* Connector: Channels → Main Kin (colored with active channel) */}
          <FlowConnector
            color={ACTIVE_CHANNEL_COLOR}
            label="via Discord"
            dotDelays={['0.3s', '1.4s']}
            height={40}
          />

          {/* 3 ─ Main Kin (orchestrator) — pings when Discord's dot arrives */}
          <div
            className="relative glass-strong rounded-2xl p-4 flex items-center gap-3"
            style={{
              border: `1px solid color-mix(in oklch, ${MAIN_COLOR} 38%, transparent)`,
              boxShadow: `0 0 30px color-mix(in oklch, ${MAIN_COLOR} 16%, transparent)`,
            }}
          >
            <KinAvatar color={MAIN_COLOR} size={44} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
                  Main Kin
                </p>
                <Badge label="Orchestrator" color={MAIN_COLOR} />
              </div>
              <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                Routes your request to the right specialists
              </p>
            </div>
            {/* Dispatching indicator: 3 colored dots */}
            <div className="flex-shrink-0 flex flex-col gap-1.5 items-center pr-1">
              {SUB_KINS.map(k => (
                <span key={k.id} className="w-2 h-2 rounded-full" style={{
                  background: k.color, boxShadow: `0 0 6px ${k.color}`,
                }} />
              ))}
            </div>
            <NodePing color={MAIN_COLOR} arrivalDelay={mainKinPingDelay} period="1.8s" />
          </div>

          {/* 4 ─ Fan-out: Main Kin → 3 sub-Kin columns */}
          <DispatchFanOut />

          {/* 5 ─ Sub-Kin columns (no gap — spacing via px inside each cell) */}
          <div className="grid grid-cols-3">
            {SUB_KINS.map((kin, i) => {
              // Each sub-Kin receives from Main's fan-out (first fanDelay dot, dur=1.5s)
              const subKinPingDelay = s(FANOUT_ARRIVE(kin.fanDelays[0]))
              // Each tool receives from that sub-Kin's tool fan-out (dur=1.2s)
              const toolPingDelays = kin.toolDelays.map(d => s(TOOL_ARRIVE(d)))
              return (
                <div key={kin.id} className={`flex flex-col items-center ${i === 0 ? 'pr-2' : i === 2 ? 'pl-2' : 'px-1'}`}>
                  <SubKinCard kin={kin} pingDelay={subKinPingDelay} />
                  {/* Tool fan-out: Sub-Kin → 2 tools (SVG bezier paths with traveling dots) */}
                  <ToolFanOut color={kin.color} toolDelays={kin.toolDelays} />
                  <ToolChips tools={kin.tools} pingDelays={toolPingDelays} />
                </div>
              )
            })}
          </div>

          {/* Caption */}
          <p className="text-center text-xs mt-8" style={{ color: 'var(--color-muted-foreground)', opacity: 0.65 }}>
            Spawn unlimited sub-Kins — each one remembers, each one specializes.
          </p>
        </div>
      </div>
    </section>
  )
}
