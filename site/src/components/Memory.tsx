import { useEffect, useRef, useState } from 'react'
import {
  Brain,
  Search,
  Sparkles,
  BookOpen,
  Layers,
  Zap,
} from 'lucide-react'

/* ── Pipeline steps ─────────────────────────────────────────────────────── */

const pipelineSteps = [
  {
    icon: Sparkles,
    label: 'Extract',
    description: 'After each conversation turn, an LLM automatically identifies durable facts, preferences, and decisions worth remembering.',
  },
  {
    icon: Zap,
    label: 'Embed',
    description: 'Each memory is converted into a high-dimensional vector embedding, enabling meaning-based retrieval instead of keyword matching.',
  },
  {
    icon: Search,
    label: 'Retrieve',
    description: 'On every new message, hybrid search (vector KNN + full-text FTS5) finds the most relevant memories and injects them into the prompt.',
  },
]

/* ── Feature cards ──────────────────────────────────────────────────────── */

const memoryFeatures = [
  {
    icon: Brain,
    title: 'Hybrid Search',
    description:
      'Combines semantic vector search (sqlite-vec) with full-text search (FTS5) using reciprocal rank fusion. Multi-query expansion generates alternative phrasings for better recall.',
    color: 'var(--color-glow-1)',
  },
  {
    icon: Sparkles,
    title: 'Automatic Extraction',
    description:
      'Every compaction cycle runs an LLM extraction pipeline that pulls facts, preferences, decisions, and knowledge from conversations. Deduplication via semantic similarity prevents bloat.',
    color: 'var(--color-glow-2)',
  },
  {
    icon: Layers,
    title: 'Smart Compaction',
    description:
      'When the context window fills past the threshold, older messages compress into dated summaries. Summaries accumulate chronologically and merge telescopically when they exceed the budget — keeping recent detail sharp and older context compact.',
    color: 'var(--color-glow-3)',
  },
  {
    icon: BookOpen,
    title: 'Kin Memory Tools',
    description:
      'Kins can explicitly memorize, recall, update, and forget information using built-in tools. Categories (fact, preference, decision, knowledge) and importance scores organize what matters.',
    color: 'var(--color-glow-1)',
  },
  {
    icon: Zap,
    title: 'Temporal Decay',
    description:
      'Older memories naturally lose weight over time, with category-aware decay rates. Facts persist almost indefinitely while decisions fade faster, mimicking how human memory works.',
    color: 'var(--color-glow-2)',
  },
  {
    icon: Search,
    title: 'Contextual Injection',
    description:
      'Before every LLM call, the most relevant memories are automatically retrieved and injected into the system prompt. Your Kin always has the right context without you repeating yourself.',
    color: 'var(--color-glow-3)',
  },
]

/* ── Subcomponents ──────────────────────────────────────────────────────── */

function PipelineStep({
  icon: Icon,
  label,
  description,
  index,
  visible,
}: {
  icon: typeof Brain
  label: string
  description: string
  index: number
  visible: boolean
}) {
  return (
    <div
      className="flex flex-col items-center text-center relative"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.5s ${index * 150}ms, transform 0.5s ${index * 150}ms`,
      }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 relative z-10"
        style={{
          background: 'linear-gradient(135deg, color-mix(in oklch, var(--color-glow-1) 20%, transparent), color-mix(in oklch, var(--color-glow-2) 15%, transparent))',
          border: '1px solid color-mix(in oklch, var(--color-glow-1) 30%, transparent)',
          boxShadow: '0 0 24px color-mix(in oklch, var(--color-glow-1) 15%, transparent)',
        }}
      >
        <Icon size={22} style={{ color: 'var(--color-primary)' }} />
      </div>
      <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--color-foreground)' }}>
        {label}
      </h3>
      <p className="text-xs leading-relaxed max-w-[260px]" style={{ color: 'var(--color-muted-foreground)' }}>
        {description}
      </p>
    </div>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  color,
}: {
  icon: typeof Brain
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

/* ── Main section ───────────────────────────────────────────────────────── */

export function Memory() {
  const pipelineRef = useRef<HTMLDivElement>(null)
  const [pipelineVisible, setPipelineVisible] = useState(false)

  useEffect(() => {
    const el = pipelineRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPipelineVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.2 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="memory" className="px-6 py-24 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'color-mix(in oklch, var(--color-glow-2) 12%, transparent)',
              border: '1px solid color-mix(in oklch, var(--color-glow-2) 25%, transparent)',
            }}
          >
            <Brain size={20} style={{ color: 'var(--color-primary)' }} />
          </div>
        </div>
        <h2 className="text-4xl sm:text-5xl font-bold mb-4">
          <span style={{ color: 'var(--color-foreground)' }}>It actually</span>{' '}
          <span className="gradient-text">remembers.</span>
        </h2>
        <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--color-muted-foreground)' }}>
          Not just conversation context. Persistent, per-Kin long-term memory with
          automatic fact extraction, vector embeddings, and semantic retrieval.
          Your Kins build knowledge over months, not just minutes.
        </p>
      </div>

      {/* Pipeline visualization */}
      <div ref={pipelineRef} className="mb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 relative">
          {/* Connecting lines (desktop only) */}
          <div className="hidden md:block absolute top-7 left-[calc(16.67%+28px)] right-[calc(16.67%+28px)] h-px" style={{
            background: 'linear-gradient(90deg, color-mix(in oklch, var(--color-glow-1) 30%, transparent), color-mix(in oklch, var(--color-glow-2) 30%, transparent))',
            opacity: pipelineVisible ? 1 : 0,
            transition: 'opacity 0.8s 0.3s',
          }} />
          {pipelineSteps.map((step, i) => (
            <PipelineStep key={step.label} {...step} index={i} visible={pipelineVisible} />
          ))}
        </div>
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {memoryFeatures.map((feature) => (
          <FeatureCard key={feature.title} {...feature} />
        ))}
      </div>

      {/* Differentiator callout */}
      <div
        className="mt-10 glass-strong rounded-xl p-5 flex items-start gap-4 max-w-2xl mx-auto"
        style={{
          background: 'color-mix(in oklch, var(--color-glow-2) 3%, var(--color-card))',
          border: '1px solid color-mix(in oklch, var(--color-glow-2) 15%, transparent)',
        }}
      >
        <Brain size={20} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>
            Not a vector database bolted on.
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
            Memory is woven into every layer: extraction happens during compaction, retrieval
            happens before every LLM call, and Kins can explicitly manage their own memories.
            All stored in a single SQLite file with sqlite-vec and FTS5. No external services,
            no infrastructure to maintain.
          </p>
        </div>
      </div>
    </section>
  )
}
