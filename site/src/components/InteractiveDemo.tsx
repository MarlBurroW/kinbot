import { useState, useEffect, useRef } from 'react'
import { Bot, User, Brain, RotateCcw, ChevronRight } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  text: string
  memoryNote?: string
}

interface Scenario {
  title: string
  description: string
  messages: Message[]
}

const scenarios: Scenario[] = [
  {
    title: 'Memory in action',
    description: 'Watch how a Kin remembers facts across messages',
    messages: [
      { role: 'user', text: "Hey Atlas, I'm working on migrating our API from REST to GraphQL. It's a Node.js project." },
      {
        role: 'assistant',
        text: "Nice! GraphQL migrations can be tricky but worth it. Are you using Apollo Server or something lighter like Yoga? And is this a gradual migration or a full rewrite?",
        memoryNote: 'Working on REST → GraphQL migration, Node.js project',
      },
      { role: 'user', text: "Going with Yoga. We want to keep REST endpoints alive during the transition." },
      {
        role: 'assistant',
        text: "Smart. GraphQL Yoga plays well with Express, so you can mount both on the same server. Want me to sketch out a dual-endpoint setup?",
        memoryNote: 'Using GraphQL Yoga, gradual migration, keeping REST alive',
      },
      { role: 'user', text: "Actually, can we pick this up tomorrow? I need to head out." },
      {
        role: 'assistant',
        text: "Of course! I'll remember where we left off. When you're back, I can have that dual-endpoint architecture ready. Have a good evening! 👋",
      },
    ],
  },
  {
    title: 'Kin collaboration',
    description: 'See how Kins delegate tasks to each other',
    messages: [
      { role: 'user', text: "Can you write a blog post about our new feature launch?" },
      {
        role: 'assistant',
        text: "I'll draft the blog post. But let me ask **Pixel** (our design Kin) to suggest a hero image concept while I write. One sec...",
        memoryNote: 'Delegating image task to Pixel (design Kin)',
      },
      {
        role: 'assistant',
        text: "Pixel suggests a split-screen visual: the old workflow (cluttered) vs. the new one (clean). I like it. Here's my draft:\n\n**Title:** \"Less clicking, more building\"\n\nYour deploys just got 3x faster. Here's what changed and why it matters...",
      },
      { role: 'user', text: "Love the angle. Can you make it more casual?" },
      {
        role: 'assistant',
        text: "Got it, dialing down the corporate tone. Here's v2:\n\n**\"We deleted 47 buttons (and nobody missed them)\"**\n\nRemember that deploy screen with the 12-step wizard? Yeah, it's gone. Now it's one click. Here's the story of how we murdered complexity...",
        memoryNote: 'User prefers casual, non-corporate writing tone',
      },
    ],
  },
  {
    title: 'Long-term recall',
    description: 'A Kin recalls context from weeks ago',
    messages: [
      { role: 'user', text: "Hey, what was the name of that database library I was looking at last month?" },
      {
        role: 'assistant',
        text: "You were evaluating **Drizzle ORM** for the GraphQL project. You liked the type-safety but were concerned about the migration tooling. Want to revisit that?",
      },
      { role: 'user', text: "Yes! Did I end up deciding anything?" },
      {
        role: 'assistant',
        text: "You decided to go with Drizzle but keep Prisma as a fallback. On Feb 12th you said — and I quote — \"if Drizzle's migrations break one more time, I'm going back to Prisma.\" 😄 Want me to check what's changed in Drizzle since then?",
      },
      { role: 'user', text: "Haha, sounds like me. Yeah, check if they fixed the migration issues." },
      {
        role: 'assistant',
        text: "Checking... Drizzle Kit 0.22 (released Feb 20th) specifically mentions \"migration reliability improvements\" and \"fixed column rename detection.\" Looks like they heard the community. Want me to test it on your project?",
        memoryNote: 'Drizzle migration issues may be resolved in v0.22',
      },
    ],
  },
]

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full"
          style={{
            background: 'var(--color-muted-foreground)',
            opacity: 0.5,
            animation: `typing-bounce 1.2s ${i * 0.2}s infinite ease-in-out`,
          }}
        />
      ))}
    </div>
  )
}

function MemoryToast({ text }: { text: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs mx-12 animate-fade-in-up"
      style={{
        background: 'color-mix(in oklch, var(--color-glow-1) 10%, transparent)',
        border: '1px solid color-mix(in oklch, var(--color-glow-1) 20%, transparent)',
        color: 'var(--color-primary)',
      }}
    >
      <Brain size={12} className="flex-shrink-0" />
      <span className="opacity-80">Remembered: {text}</span>
    </div>
  )
}

function ChatBubble({ message, animated }: { message: Message; animated: boolean }) {
  const isUser = message.role === 'user'

  return (
    <div
      className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}
      style={{
        opacity: animated ? 1 : 0,
        transform: animated ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
        style={{
          background: isUser
            ? 'color-mix(in oklch, var(--color-muted-foreground) 15%, transparent)'
            : 'linear-gradient(135deg, color-mix(in oklch, var(--color-glow-1) 30%, transparent), color-mix(in oklch, var(--color-glow-2) 25%, transparent))',
          border: isUser
            ? '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)'
            : '1px solid color-mix(in oklch, var(--color-glow-1) 35%, transparent)',
        }}
      >
        {isUser ? (
          <User size={13} style={{ color: 'var(--color-muted-foreground)' }} />
        ) : (
          <Bot size={13} style={{ color: 'var(--color-primary)' }} />
        )}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser ? 'rounded-tr-md' : 'rounded-tl-md'
        }`}
        style={{
          background: isUser
            ? 'color-mix(in oklch, var(--color-primary) 15%, transparent)'
            : 'color-mix(in oklch, var(--color-muted-foreground) 8%, transparent)',
          color: 'var(--color-foreground)',
          border: isUser
            ? '1px solid color-mix(in oklch, var(--color-primary) 20%, transparent)'
            : '1px solid color-mix(in oklch, var(--color-border) 40%, transparent)',
        }}
      >
        {message.text.split('\n').map((line, i) => (
          <span key={i}>
            {line.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
              part.startsWith('**') && part.endsWith('**') ? (
                <strong key={j} style={{ color: 'var(--color-primary)' }}>
                  {part.slice(2, -2)}
                </strong>
              ) : (
                <span key={j}>{part}</span>
              )
            )}
            {i < message.text.split('\n').length - 1 && <br />}
          </span>
        ))}
      </div>
    </div>
  )
}

export function InteractiveDemo() {
  const [activeScenario, setActiveScenario] = useState(0)
  const [visibleCount, setVisibleCount] = useState(0)
  const [showMemory, setShowMemory] = useState<number | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasAutoPlayed = useRef(false)

  const scenario = scenarios[activeScenario]

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [visibleCount, isTyping, showMemory])

  // Clean up timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Auto-play when scrolled into view (respect prefers-reduced-motion)
  useEffect(() => {
    const el = sectionRef.current
    if (!el || hasAutoPlayed.current) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAutoPlayed.current && !isPlaying && visibleCount === 0) {
          hasAutoPlayed.current = true
          observer.disconnect()
          // Small delay so the section is comfortably visible before animation starts
          setTimeout(() => play(), 600)
        }
      },
      { threshold: 0.4 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [isPlaying, visibleCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisibleCount(0)
    setShowMemory(null)
    setIsTyping(false)
    setIsPlaying(false)
  }

  const play = () => {
    reset()
    setIsPlaying(true)

    let step = 0
    const msgs = scenario.messages

    function next() {
      if (step >= msgs.length) {
        setIsPlaying(false)
        return
      }

      const msg = msgs[step]

      if (msg.role === 'assistant') {
        // Show typing first
        setIsTyping(true)
        timerRef.current = setTimeout(() => {
          setIsTyping(false)
          setVisibleCount(step + 1)

          // Show memory toast if applicable
          if (msg.memoryNote) {
            timerRef.current = setTimeout(() => {
              setShowMemory(step)
              timerRef.current = setTimeout(() => {
                setShowMemory(null)
                step++
                next()
              }, 1800)
            }, 600)
          } else {
            step++
            timerRef.current = setTimeout(next, 800)
          }
        }, 800 + Math.random() * 600)
      } else {
        setVisibleCount(step + 1)
        step++
        timerRef.current = setTimeout(next, 900)
      }
    }

    timerRef.current = setTimeout(next, 400)
  }

  const switchScenario = (idx: number) => {
    if (idx === activeScenario) return
    reset()
    hasAutoPlayed.current = true // don't auto-play after manual tab switch
    setActiveScenario(idx)
  }

  return (
    <section ref={sectionRef} id="demo" className="px-6 py-24 max-w-4xl mx-auto">
      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>

      <div className="text-center mb-12">
        <h2 className="text-4xl sm:text-5xl font-bold mb-4">
          <span style={{ color: 'var(--color-foreground)' }}>Try it </span>
          <span className="gradient-text">before you install.</span>
        </h2>
        <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--color-muted-foreground)' }}>
          Watch a simulated conversation to see how Kins remember, collaborate, and build context over time.
        </p>
      </div>

      {/* Scenario tabs */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {scenarios.map((s, i) => (
          <button
            key={i}
            onClick={() => switchScenario(i)}
            className="text-sm font-medium px-4 py-2 rounded-full transition-all duration-200"
            style={{
              background:
                activeScenario === i
                  ? 'color-mix(in oklch, var(--color-glow-1) 20%, transparent)'
                  : 'color-mix(in oklch, var(--color-muted-foreground) 8%, transparent)',
              color:
                activeScenario === i
                  ? 'var(--color-primary)'
                  : 'var(--color-muted-foreground)',
              border:
                activeScenario === i
                  ? '1px solid color-mix(in oklch, var(--color-glow-1) 40%, transparent)'
                  : '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)',
              transform: activeScenario === i ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Chat window */}
      <div className="glass-strong gradient-border rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-md)' }}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, color-mix(in oklch, var(--color-glow-1) 30%, transparent), color-mix(in oklch, var(--color-glow-2) 25%, transparent))',
                border: '1px solid color-mix(in oklch, var(--color-glow-1) 35%, transparent)',
              }}
            >
              <Bot size={16} style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
                Atlas
              </p>
              <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                {scenario.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={reset}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
              style={{ color: 'var(--color-muted-foreground)' }}
              title="Reset"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Chat area */}
        <div
          ref={chatRef}
          className="p-5 space-y-4 overflow-y-auto"
          style={{ height: '380px', scrollbarWidth: 'thin' }}
        >
          {visibleCount === 0 && !isPlaying && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                Press play to start the demo
              </p>
              <button
                onClick={play}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  background: 'var(--color-primary)',
                  color: 'var(--color-primary-foreground)',
                  boxShadow: '0 0 20px color-mix(in oklch, var(--color-glow-1) 30%, transparent)',
                }}
              >
                <ChevronRight size={16} />
                Play scenario
              </button>
            </div>
          )}

          {scenario.messages.slice(0, visibleCount).map((msg, i) => (
            <div key={`${activeScenario}-${i}`}>
              <ChatBubble message={msg} animated />
              {showMemory === i && msg.memoryNote && (
                <div className="mt-2">
                  <MemoryToast text={msg.memoryNote} />
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-2.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                style={{
                  background: 'linear-gradient(135deg, color-mix(in oklch, var(--color-glow-1) 30%, transparent), color-mix(in oklch, var(--color-glow-2) 25%, transparent))',
                  border: '1px solid color-mix(in oklch, var(--color-glow-1) 35%, transparent)',
                }}
              >
                <Bot size={13} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div
                className="rounded-2xl rounded-tl-md px-4 py-2.5"
                style={{
                  background: 'color-mix(in oklch, var(--color-muted-foreground) 8%, transparent)',
                  border: '1px solid color-mix(in oklch, var(--color-border) 40%, transparent)',
                }}
              >
                <TypingIndicator />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {visibleCount > 0 && !isPlaying && (
          <div
            className="flex items-center justify-center px-5 py-3 border-t"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <button
              onClick={play}
              className="text-xs font-medium transition-colors duration-200"
              style={{ color: 'var(--color-primary)' }}
            >
              ↻ Replay this scenario
            </button>
          </div>
        )}
      </div>

      <p
        className="text-center mt-4 text-sm"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        This is a simulation. Real Kins remember across sessions, days, and months.
      </p>
    </section>
  )
}
