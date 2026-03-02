import { useState, useEffect, useMemo, useRef } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

interface FAQItem {
  question: string
  answer: string
  category: string
}

const categories = ['All', 'Getting Started', 'Features', 'Privacy & Hosting', 'Technical'] as const

type Category = (typeof categories)[number]

const faqs: FAQItem[] = [
  {
    question: 'Is KinBot free?',
    answer:
      'Yes, KinBot is completely free and open-source under the AGPL-3.0 license. You self-host it on your own hardware or server. The only cost is the API usage from your chosen AI providers.',
    category: 'Getting Started',
  },
  {
    question: 'What makes KinBot different from ChatGPT or Open WebUI?',
    answer:
      'Three things no one else combines: persistent agent identity (each agent has a name, role, and personality that never resets), continuous long-term memory (vector + full-text search across all conversations), and inter-agent collaboration (agents can delegate tasks, share context, and work together). ChatGPT resets every session. Open WebUI is a chat wrapper with no memory layer. KinBot gives your agents a life, not just a session.',
    category: 'Features',
  },
  {
    question: 'What does "persistent memory" actually mean?',
    answer:
      'Every conversation is indexed into a vector database and a full-text search engine. When you talk to an agent next week, it remembers what you discussed last month. Sessions are also automatically compacted so context stays relevant without hitting token limits. No manual prompt stuffing required.',
    category: 'Features',
  },
  {
    question: 'Can agents talk to each other?',
    answer:
      'Yes. Agents can communicate, delegate sub-tasks, and share results. You can build teams of specialized agents: a researcher that feeds findings to a writer, a code reviewer that escalates to an architect. Each agent maintains its own identity and memory while collaborating.',
    category: 'Features',
  },
  {
    question: 'What AI providers are supported?',
    answer:
      '23 providers including Anthropic (Claude), OpenAI (GPT, DALL-E, embeddings), Google Gemini, Mistral, Groq, Together AI, Fireworks AI, DeepSeek, xAI (Grok), OpenRouter, Cohere, Ollama (local models), Replicate, Stability AI, FAL AI, Jina, Nomic, Voyage, Tavily, Serper, Perplexity, and Brave Search. New providers are added regularly.',
    category: 'Features',
  },
  {
    question: 'Can I use local models with Ollama?',
    answer:
      'Yes! Ollama is fully supported. Point KinBot at your local Ollama instance and use any model you\'ve pulled. No API key needed, no data leaves your machine. Great for fully air-gapped setups.',
    category: 'Getting Started',
  },
  {
    question: 'What channels can I connect?',
    answer:
      'Telegram, Discord, Slack, WhatsApp, Signal, and Matrix are fully supported today. The channel adapter architecture makes adding new platforms straightforward. Your agents can live where your users already are.',
    category: 'Features',
  },
  {
    question: 'Is my data private?',
    answer:
      'Completely. KinBot runs on your infrastructure. Conversations, memories, and agent configurations are stored locally in SQLite. Nothing is sent anywhere except to the AI provider APIs you explicitly configure. There is no telemetry, no analytics, no phone-home.',
    category: 'Privacy & Hosting',
  },
  {
    question: 'Can I run KinBot on a Raspberry Pi?',
    answer:
      'Yes! KinBot is lightweight: one binary, one SQLite file. A Raspberry Pi 4 or newer handles it well. You can also use the Docker image for easy deployment on any hardware.',
    category: 'Privacy & Hosting',
  },
  {
    question: 'Can agents run tasks on a schedule?',
    answer:
      'Yes. KinBot has built-in cron jobs so agents can perform tasks autonomously on a schedule: daily reports, monitoring, data collection, or anything else. Combined with webhooks, agents can also react to external events in real-time.',
    category: 'Features',
  },
  {
    question: 'How much RAM and disk space does KinBot need?',
    answer:
      'Minimal. KinBot uses ~100MB RAM at idle. Storage depends on your usage — a SQLite file grows with conversations and memory entries. A typical single-user instance stays under 500MB for months. No Redis, no Postgres, no external services needed.',
    category: 'Technical',
  },
  {
    question: 'Can I migrate from ChatGPT or Open WebUI?',
    answer:
      'Not yet, but it\'s on the roadmap. For now, KinBot starts fresh with a clean memory. The upside: your agents build genuine long-term context from day one instead of importing noisy chat logs.',
    category: 'Getting Started',
  },
  {
    question: 'How do I update KinBot?',
    answer:
      'If you used the install script, just run it again. It\'s idempotent and will pull the latest changes, rebuild, and restart the service. For Docker, pull the latest image and recreate the container.',
    category: 'Technical',
  },
  {
    question: 'Why SQLite instead of Postgres?',
    answer:
      'Deliberate trade-off: one file means zero ops. No Postgres to configure, no Redis to babysit, no migrations headaches. Just cp kinbot.db backup.db and you\'re backed up. SQLite with WAL mode handles millions of rows and concurrent reads comfortably. A typical single-user instance stays under 500MB for months. For the target audience — self-hosters on a Pi or VPS — simplicity is a feature.',
    category: 'Technical',
  },
  {
    question: 'Why AGPL-3.0 and not MIT?',
    answer:
      'AGPL only matters if you plan to offer KinBot as a hosted service without sharing modifications. For self-hosters running it on their own server, it works exactly like GPL — modify it however you want. AGPL prevents a cloud provider from taking KinBot, wrapping it in a SaaS, and contributing nothing back. Your freedom to use, modify, and self-host is fully preserved.',
    category: 'Technical',
  },
  {
    question: 'Can agents create their own tools?',
    answer:
      'Yes. Kins can create custom tools at runtime (with user approval). Combined with MCP server support, this means your agents can extend their own capabilities — connecting to databases, calling APIs, running code, or interacting with any system you expose. No code changes needed.',
    category: 'Features',
  },
  {
    question: 'Can KinBot work fully offline?',
    answer:
      'Yes. Point KinBot at a local Ollama instance (or any OpenAI-compatible endpoint like vLLM, llama.cpp, or LM Studio) and nothing ever leaves your machine. For memory embeddings, Ollama supports local embedding models too. The only reason KinBot would reach the internet is if you configure a cloud AI provider. No telemetry, no phone-home, no hidden calls.',
    category: 'Privacy & Hosting',
  },
  {
    question: 'Is there a hosted or cloud version?',
    answer:
      'No, and that\'s by design. KinBot is self-hosted only. Your conversations, memories, and agent configurations live on your hardware, not someone else\'s server. The trade-off is you need somewhere to run it, but a Raspberry Pi, old laptop, or $5/mo VPS is all it takes.',
    category: 'Getting Started',
  },
  {
    question: 'What gets stored in the memory system?',
    answer:
      'When you chat with a Kin, it automatically extracts facts and knowledge from the conversation (names, preferences, decisions, technical details) and stores them as searchable memory entries in the local SQLite database. Memories are indexed both as vector embeddings (for semantic search) and full-text (for exact matches). You can see, search, and delete any memory through the UI. Vault secrets are never included in memories, and message redaction prevents sensitive data from leaking into compacted summaries.',
    category: 'Privacy & Hosting',
  },
  {
    question: 'What are Mini Apps?',
    answer:
      'Mini Apps are interactive web applications (HTML/CSS/JS) that Kins can build and deploy directly in the KinBot sidebar. Think dashboards, calculators, forms, or data visualizations, all created by your agents on the fly. They come with an auto-injected design system that matches your chosen theme, a JavaScript SDK for persistent storage and inter-app communication, and an App Gallery to browse and clone community-built apps.',
    category: 'Features',
  },
]

function FAQEntry({ item, forceOpen }: { item: FAQItem; forceOpen?: boolean }) {
  const [open, setOpen] = useState(false)
  const isOpen = forceOpen || open
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight)
    }
  }, [isOpen, item.answer])

  return (
    <div
      className="border-b last:border-b-0 transition-colors"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-5 px-1 text-left gap-4 group"
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${item.question.replace(/\s+/g, '-').toLowerCase().slice(0, 30)}`}
      >
        <span
          className="text-base font-medium transition-colors"
          style={{ color: isOpen ? 'var(--color-primary)' : 'var(--color-foreground)' }}
        >
          {item.question}
        </span>
        <ChevronDown
          size={18}
          className="flex-shrink-0 transition-transform duration-300"
          aria-hidden="true"
          style={{
            color: 'var(--color-muted-foreground)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>
      <div
        ref={contentRef}
        id={`faq-answer-${item.question.replace(/\s+/g, '-').toLowerCase().slice(0, 30)}`}
        role="region"
        className="overflow-hidden transition-all duration-300"
        style={{
          maxHeight: isOpen ? `${height}px` : '0',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <p
          className="pb-5 px-1 text-sm leading-relaxed"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          {item.answer}
        </p>
      </div>
    </div>
  )
}

export function FAQ() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category>('All')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = 'faq-jsonld'
    if (document.getElementById(id)) return
    const script = document.createElement('script')
    script.id = id
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(f => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.answer,
        },
      })),
    })
    document.head.appendChild(script)
    return () => { document.getElementById(id)?.remove() }
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return faqs.filter(faq => {
      if (activeCategory !== 'All' && faq.category !== activeCategory) return false
      if (!q) return true
      return faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q)
    })
  }, [search, activeCategory])

  const isSearching = search.trim().length > 0
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: faqs.length }
    for (const faq of faqs) {
      counts[faq.category] = (counts[faq.category] || 0) + 1
    }
    return counts
  }, [])

  return (
    <section id="faq" className="px-6 py-24 max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-4xl sm:text-5xl font-bold mb-4">
          <span style={{ color: 'var(--color-foreground)' }}>Frequently asked</span>{' '}
          <span className="gradient-text">questions.</span>
        </h2>
        <p className="text-lg" style={{ color: 'var(--color-muted-foreground)' }}>
          Everything you need to know about KinBot.
        </p>
      </div>

      {/* Search + Category filters */}
      <div className="mb-6 space-y-4">
        {/* Search input */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--color-muted-foreground)' }}
          />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search questions..."
            className="w-full pl-11 pr-10 py-3 rounded-xl text-sm transition-all duration-200 outline-none"
            style={{
              background: 'color-mix(in oklch, var(--color-muted-foreground) 6%, var(--color-background))',
              color: 'var(--color-foreground)',
              border: search
                ? '1.5px solid color-mix(in oklch, var(--color-glow-1) 40%, transparent)'
                : '1.5px solid color-mix(in oklch, var(--color-border) 50%, transparent)',
            }}
          />
          {search && (
            <button
              onClick={() => { setSearch(''); inputRef.current?.focus() }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors hover:opacity-80"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => {
            const isActive = activeCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200"
                style={{
                  background: isActive
                    ? 'color-mix(in oklch, var(--color-glow-1) 18%, transparent)'
                    : 'color-mix(in oklch, var(--color-muted-foreground) 8%, transparent)',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
                  border: isActive
                    ? '1px solid color-mix(in oklch, var(--color-glow-1) 30%, transparent)'
                    : '1px solid transparent',
                }}
              >
                {cat}
                <span
                  className="ml-1.5 opacity-60"
                >
                  {categoryCounts[cat] || 0}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="glass-strong gradient-border rounded-2xl p-6 sm:p-8">
        {filtered.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              No questions match your search. Try different keywords.
            </p>
            <button
              onClick={() => { setSearch(''); setActiveCategory('All') }}
              className="mt-3 text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: 'var(--color-primary)' }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          filtered.map((faq, i) => (
            <FAQEntry key={i} item={faq} forceOpen={isSearching} />
          ))
        )}
      </div>

      {filtered.length > 0 && filtered.length < faqs.length && (
        <p className="text-center mt-4 text-xs" style={{ color: 'var(--color-muted-foreground)', opacity: 0.7 }}>
          Showing {filtered.length} of {faqs.length} questions
        </p>
      )}
    </section>
  )
}
