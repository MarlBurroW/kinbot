import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface FAQItem {
  question: string
  answer: string
}

const faqs: FAQItem[] = [
  {
    question: 'Is KinBot free?',
    answer:
      'Yes, KinBot is completely free and open-source under the AGPL-3.0 license. You self-host it on your own hardware or server. The only cost is the API usage from your chosen AI providers.',
  },
  {
    question: 'What makes KinBot different from ChatGPT or Open WebUI?',
    answer:
      'Three things no one else combines: persistent agent identity (each agent has a name, role, and personality that never resets), continuous long-term memory (vector + full-text search across all conversations), and inter-agent collaboration (agents can delegate tasks, share context, and work together). ChatGPT resets every session. Open WebUI is a chat wrapper with no memory layer. KinBot gives your agents a life, not just a session.',
  },
  {
    question: 'What does "persistent memory" actually mean?',
    answer:
      'Every conversation is indexed into a vector database and a full-text search engine. When you talk to an agent next week, it remembers what you discussed last month. Sessions are also automatically compacted so context stays relevant without hitting token limits. No manual prompt stuffing required.',
  },
  {
    question: 'Can agents talk to each other?',
    answer:
      'Yes. Agents can communicate, delegate sub-tasks, and share results. You can build teams of specialized agents: a researcher that feeds findings to a writer, a code reviewer that escalates to an architect. Each agent maintains its own identity and memory while collaborating.',
  },
  {
    question: 'What AI providers are supported?',
    answer:
      'Over 25 providers including Anthropic (Claude), OpenAI (GPT, DALL-E, embeddings), Google Gemini, Mistral, Groq, Together AI, Fireworks AI, DeepSeek, xAI (Grok), OpenRouter, Cohere, Ollama (local models), Replicate, Stability AI, FAL AI, Jina, Nomic, Voyage, Tavily, and Brave Search. New providers are added regularly.',
  },
  {
    question: 'Can I use local models with Ollama?',
    answer:
      'Yes! Ollama is fully supported. Point KinBot at your local Ollama instance and use any model you\'ve pulled. No API key needed, no data leaves your machine. Great for fully air-gapped setups.',
  },
  {
    question: 'What channels can I connect?',
    answer:
      'Telegram, Discord, and Slack are fully supported today. WhatsApp, Signal, and Matrix are on the roadmap. The channel adapter architecture makes adding new platforms straightforward. Your agents can live where your users already are.',
  },
  {
    question: 'Is my data private?',
    answer:
      'Completely. KinBot runs on your infrastructure. Conversations, memories, and agent configurations are stored locally in SQLite. Nothing is sent anywhere except to the AI provider APIs you explicitly configure. There is no telemetry, no analytics, no phone-home.',
  },
  {
    question: 'Can I run KinBot on a Raspberry Pi?',
    answer:
      'Yes! KinBot is lightweight: one binary, one SQLite file. A Raspberry Pi 4 or newer handles it well. You can also use the Docker image for easy deployment on any hardware.',
  },
  {
    question: 'Can agents run tasks on a schedule?',
    answer:
      'Yes. KinBot has built-in cron jobs so agents can perform tasks autonomously on a schedule: daily reports, monitoring, data collection, or anything else. Combined with webhooks, agents can also react to external events in real-time.',
  },
  {
    question: 'How much RAM and disk space does KinBot need?',
    answer:
      'Minimal. KinBot uses ~100MB RAM at idle. Storage depends on your usage — a SQLite file grows with conversations and memory entries. A typical single-user instance stays under 500MB for months. No Redis, no Postgres, no external services needed.',
  },
  {
    question: 'Can I migrate from ChatGPT or Open WebUI?',
    answer:
      'Not yet, but it\'s on the roadmap. For now, KinBot starts fresh with a clean memory. The upside: your agents build genuine long-term context from day one instead of importing noisy chat logs.',
  },
  {
    question: 'How do I update KinBot?',
    answer:
      'If you used the install script, just run it again. It\'s idempotent and will pull the latest changes, rebuild, and restart the service. For Docker, pull the latest image and recreate the container.',
  },
]

function FAQEntry({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="border-b last:border-b-0 transition-colors"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-5 px-1 text-left gap-4 group"
      >
        <span
          className="text-base font-medium transition-colors"
          style={{ color: open ? 'var(--color-primary)' : 'var(--color-foreground)' }}
        >
          {item.question}
        </span>
        <ChevronDown
          size={18}
          className="flex-shrink-0 transition-transform duration-300"
          style={{
            color: 'var(--color-muted-foreground)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{
          maxHeight: open ? '300px' : '0',
          opacity: open ? 1 : 0,
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

      <div className="glass-strong gradient-border rounded-2xl p-6 sm:p-8">
        {faqs.map((faq, i) => (
          <FAQEntry key={i} item={faq} />
        ))}
      </div>
    </section>
  )
}
