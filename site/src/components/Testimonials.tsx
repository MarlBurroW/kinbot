import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Quote } from 'lucide-react'

interface Testimonial {
  quote: string
  author: string
  role: string
  source: string
  avatar: string
}

const testimonials: Testimonial[] = [
  {
    quote:
      "I've tried Open WebUI, LobeChat, AnythingLLM... KinBot is the first one where my agents actually remember our conversations from last week. The memory system is what I always wanted.",
    author: 'selfhoster_dave',
    role: 'r/selfhosted',
    source: 'Reddit',
    avatar: '🏠',
  },
  {
    quote:
      "Set up a research Kin and a coding Kin. They delegate tasks to each other. I didn't think multi-agent would be useful until I saw them collaborate on a refactoring task. Mind blown.",
    author: 'llama_enthusiast',
    role: 'r/LocalLLaMA',
    source: 'Reddit',
    avatar: '🦙',
  },
  {
    quote:
      'The zero-infra approach is genius. One SQLite file, no Postgres, no Redis, no vector DB to manage. Docker run and you\'re done. This is how self-hosted should work.',
    author: 'ops_minimalist',
    role: 'Hacker News',
    source: 'HN',
    avatar: '⚡',
  },
  {
    quote:
      "Connected it to our family Telegram group. The cooking Kin remembers everyone's allergies and preferences. My wife asked it for dinner ideas and it suggested things based on what we liked before.",
    author: 'weekend_deployer',
    role: 'r/selfhosted',
    source: 'Reddit',
    avatar: '👨‍🍳',
  },
  {
    quote:
      "Ollama auto-detection on first setup is chef's kiss. No API key, no config, it just found my local models and I was chatting in under a minute. Fastest onboarding I've seen.",
    author: 'local_first',
    role: 'r/LocalLLaMA',
    source: 'Reddit',
    avatar: '🔒',
  },
  {
    quote:
      'The encrypted vault for API keys is a nice touch. Most self-hosted tools just store them in plain text or env vars. Small thing but shows the devs care about security.',
    author: 'paranoid_admin',
    role: 'Hacker News',
    source: 'HN',
    avatar: '🛡️',
  },
]

function TestimonialCard({ testimonial, index }: { testimonial: Testimonial; index: number }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), index * 80)
          observer.unobserve(el)
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [index])

  return (
    <div
      ref={ref}
      className="glass-strong rounded-2xl p-6 transition-all duration-500 hover:scale-[1.02] group relative"
      style={{
        border: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition:
          'opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s, box-shadow 0.3s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor =
          'color-mix(in oklch, var(--color-glow-1) 25%, transparent)'
        e.currentTarget.style.boxShadow =
          '0 0 30px color-mix(in oklch, var(--color-glow-1) 8%, transparent)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor =
          'color-mix(in oklch, var(--color-border) 50%, transparent)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Quote icon */}
      <Quote
        size={24}
        className="absolute top-4 right-4 opacity-10 transition-opacity duration-300 group-hover:opacity-20"
        style={{ color: 'var(--color-primary)' }}
      />

      {/* Quote text */}
      <p
        className="text-sm leading-relaxed mb-5"
        style={{ color: 'var(--color-foreground)' }}
      >
        "{testimonial.quote}"
      </p>

      {/* Author */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
          style={{
            background:
              'linear-gradient(135deg, color-mix(in oklch, var(--color-glow-1) 15%, transparent), color-mix(in oklch, var(--color-glow-2) 10%, transparent))',
            border: '1px solid color-mix(in oklch, var(--color-glow-1) 20%, transparent)',
          }}
        >
          {testimonial.avatar}
        </div>
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: 'var(--color-foreground)' }}
          >
            {testimonial.author}
          </p>
          <p
            className="text-xs"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            {testimonial.role}
          </p>
        </div>
      </div>
    </div>
  )
}

export function Testimonials() {
  return (
    <section id="testimonials" className="px-6 py-24 max-w-6xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-4xl sm:text-5xl font-bold mb-4">
          <span style={{ color: 'var(--color-foreground)' }}>Loved by </span>
          <span className="gradient-text">self-hosters.</span>
        </h2>
        <p
          className="text-lg max-w-2xl mx-auto"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          What the community says about running their own AI agents.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {testimonials.map((t, i) => (
          <TestimonialCard key={t.author} testimonial={t} index={i} />
        ))}
      </div>

      <div className="text-center mt-10">
        <a
          href="https://github.com/MarlBurroW/kinbot/discussions"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium transition-all duration-200 hover:scale-105"
          style={{ color: 'var(--color-primary)' }}
        >
          <MessageSquare size={16} />
          Join the discussion on GitHub
        </a>
      </div>
    </section>
  )
}
