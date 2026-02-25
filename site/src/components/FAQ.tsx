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
      'Yes, KinBot is completely free and open-source under the MIT license. You self-host it on your own hardware or server. The only cost is the API usage from your chosen AI providers.',
  },
  {
    question: 'What AI providers are supported?',
    answer:
      'KinBot supports Anthropic (Claude), OpenAI (GPT, DALL-E, embeddings), Google Gemini, Mistral AI, Groq, Together AI, Fireworks AI, Voyage (embeddings), and Brave Search. More providers are added regularly — contributions welcome!',
  },
  {
    question: 'Can I use local models with Ollama?',
    answer:
      'Ollama support is on the roadmap and coming soon. KinBot\'s provider architecture makes it straightforward to add any OpenAI-compatible API, so local inference is a natural fit.',
  },
  {
    question: 'How does KinBot differ from ChatGPT or Claude.ai?',
    answer:
      'KinBot is self-hosted, so your data never leaves your server. You can connect multiple AI providers and switch between them freely. It also supports channels (Telegram, Discord, etc.) so your bot can live where your users already are.',
  },
  {
    question: 'What channels can I connect?',
    answer:
      'Telegram is fully supported today. Discord, Slack, WhatsApp, Signal, and Matrix are on the roadmap. The channel adapter architecture makes adding new platforms straightforward.',
  },
  {
    question: 'Is my data private?',
    answer:
      'Completely. KinBot runs on your infrastructure. Conversations are stored locally in SQLite. Nothing is sent anywhere except to the AI provider APIs you explicitly configure.',
  },
  {
    question: 'Can I run KinBot on a Raspberry Pi?',
    answer:
      'Yes! KinBot is lightweight — it needs Bun and around 500 MB of disk space. A Raspberry Pi 4 or newer handles it well. You can also use the Docker image for easy deployment.',
  },
  {
    question: 'How do I update KinBot?',
    answer:
      'If you used the install script, just run it again — it\'s idempotent and will pull the latest changes, rebuild, and restart the service. For Docker, pull the latest image and recreate the container.',
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
          maxHeight: open ? '200px' : '0',
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
