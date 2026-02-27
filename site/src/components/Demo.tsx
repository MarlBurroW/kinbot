import { useState, useEffect, useRef } from 'react'
import { Play, RotateCcw, Brain, Sparkles } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  text: string
  memory?: string // memory extracted from this message
  memoryRecall?: string // memory recalled for this response
  delay: number // ms before this message appears
}

const demoScenarios: { title: string; subtitle: string; messages: Message[] }[] = [
  {
    title: 'Memory in action',
    subtitle: 'Watch how a Kin remembers across conversations',
    messages: [
      {
        role: 'user',
        text: "Hey Atlas, I'm working on a Rust project for my home automation system. It's called HouseOS.",
        delay: 0,
      },
      {
        role: 'assistant',
        text: "Nice! Rust is a great choice for home automation — safety and performance matter when you're controlling real hardware. What does HouseOS handle so far?",
        memory: 'User is building "HouseOS", a home automation system in Rust',
        delay: 1200,
      },
      {
        role: 'user',
        text: 'Lights and thermostat for now. Planning to add door locks next.',
        delay: 2800,
      },
      {
        role: 'assistant',
        text: "Smart progression. For door locks you'll want to look into Z-Wave or Zigbee protocols — they're more reliable than WiFi for security-critical devices. Want me to research Rust crates for Z-Wave?",
        memory: 'HouseOS currently handles lights + thermostat, door locks planned next',
        delay: 4200,
      },
      {
        role: 'user',
        text: "That'd be great. Also, I prefer async code with Tokio.",
        delay: 6000,
      },
      {
        role: 'assistant',
        text: "Got it, I'll focus on async-compatible crates. I'll look into zwave-rs and see if it plays nicely with Tokio. Give me a moment...",
        memory: 'Prefers async Rust with Tokio runtime',
        delay: 7200,
      },
      // Simulated "next day" separator handled in rendering
      {
        role: 'user',
        text: "Hey Atlas, I'm stuck on a design decision for my project.",
        delay: 9500,
      },
      {
        role: 'assistant',
        text: "Is this about HouseOS? Last time you were planning to add door lock support with Z-Wave. What's the design dilemma?",
        memoryRecall: 'Recalled: HouseOS, Rust, door locks, Z-Wave, Tokio',
        delay: 10800,
      },
    ],
  },
]

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full animate-bounce"
          style={{
            background: 'var(--color-muted-foreground)',
            opacity: 0.5,
            animationDelay: `${i * 150}ms`,
            animationDuration: '0.8s',
          }}
        />
      ))}
    </div>
  )
}

function MemoryBadge({ text, type }: { text: string; type: 'stored' | 'recalled' }) {
  const isStored = type === 'stored'
  return (
    <div
      className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full mt-1.5 w-fit animate-fade-in"
      style={{
        background: isStored
          ? 'color-mix(in oklch, var(--color-glow-1) 12%, transparent)'
          : 'color-mix(in oklch, var(--color-glow-2) 12%, transparent)',
        color: isStored ? 'var(--color-glow-1)' : 'var(--color-glow-2)',
        border: `1px solid color-mix(in oklch, ${isStored ? 'var(--color-glow-1)' : 'var(--color-glow-2)'} 20%, transparent)`,
      }}
    >
      {isStored ? <Brain size={11} /> : <Sparkles size={11} />}
      {isStored ? '🧠 Stored: ' : '💡 '}{text}
    </div>
  )
}

export function Demo() {
  const scenario = demoScenarios[0]
  const [visibleCount, setVisibleCount] = useState(0)
  const [typing, setTyping] = useState(false)
  const [started, setStarted] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([])

  const DAY_BREAK_AFTER = 5 // show "next day" separator after message index 5

  const reset = () => {
    timerRefs.current.forEach(clearTimeout)
    timerRefs.current = []
    setVisibleCount(0)
    setTyping(false)
    setStarted(false)
  }

  const start = () => {
    reset()
    setStarted(true)

    scenario.messages.forEach((msg, i) => {
      // Show typing indicator before assistant messages
      if (msg.role === 'assistant') {
        const typingTimer = setTimeout(() => setTyping(true), msg.delay - 600)
        timerRefs.current.push(typingTimer)
      }

      const timer = setTimeout(() => {
        setTyping(false)
        setVisibleCount(i + 1)
      }, msg.delay)
      timerRefs.current.push(timer)
    })
  }

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [visibleCount, typing])

  useEffect(() => {
    return () => timerRefs.current.forEach(clearTimeout)
  }, [])

  const visibleMessages = scenario.messages.slice(0, visibleCount)
  const isFinished = visibleCount === scenario.messages.length

  return (
    <section id="demo" className="px-6 py-24 max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-4xl sm:text-5xl font-bold mb-4">
          <span style={{ color: 'var(--color-foreground)' }}>See it</span>{' '}
          <span className="gradient-text">in action.</span>
        </h2>
        <p className="text-lg" style={{ color: 'var(--color-muted-foreground)' }}>
          Watch a Kin remember context across conversations. No prompt stuffing, no manual setup.
        </p>
      </div>

      <div className="glass-strong gradient-border rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-md)' }}>
        {/* Chat header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
              style={{
                background: 'linear-gradient(135deg, var(--color-glow-1), var(--color-glow-2))',
                color: 'white',
              }}
            >
              A
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
                Atlas
              </div>
              <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                Research Assistant · 47 memories
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {started && (
              <button
                onClick={reset}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:scale-105"
                style={{
                  color: 'var(--color-muted-foreground)',
                  background: 'color-mix(in oklch, var(--color-muted-foreground) 8%, transparent)',
                }}
              >
                <RotateCcw size={12} />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Chat body */}
        <div
          ref={chatRef}
          className="px-5 py-4 space-y-4 overflow-y-auto"
          style={{
            height: '420px',
            background: 'color-mix(in oklch, var(--color-background) 50%, var(--color-card))',
          }}
        >
          {!started ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, var(--color-glow-1), var(--color-glow-2))',
                }}
              >
                <Play size={28} className="text-white ml-1" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-foreground)' }}>
                  {scenario.title}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                  {scenario.subtitle}
                </p>
              </div>
              <button
                onClick={start}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, var(--color-glow-1), var(--color-glow-2))',
                  color: 'white',
                }}
              >
                <Play size={14} />
                Play demo
              </button>
            </div>
          ) : (
            <>
              {visibleMessages.map((msg, i) => (
                <div key={i}>
                  {/* Day separator */}
                  {i === DAY_BREAK_AFTER + 1 && (
                    <div className="flex items-center gap-3 my-5">
                      <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full"
                        style={{
                          color: 'var(--color-muted-foreground)',
                          background: 'color-mix(in oklch, var(--color-muted-foreground) 8%, transparent)',
                        }}
                      >
                        Next day
                      </span>
                      <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
                    </div>
                  )}
                  <div
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    style={{
                      animation: 'fadeSlideIn 0.3s ease-out',
                    }}
                  >
                    <div className="max-w-[85%]">
                      <div
                        className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                        style={
                          msg.role === 'user'
                            ? {
                                background: 'linear-gradient(135deg, var(--color-glow-1), var(--color-glow-2))',
                                color: 'white',
                                borderBottomRightRadius: '6px',
                              }
                            : {
                                background: 'var(--color-card)',
                                color: 'var(--color-foreground)',
                                border: '1px solid var(--color-border)',
                                borderBottomLeftRadius: '6px',
                              }
                        }
                      >
                        {msg.text}
                      </div>
                      {msg.memory && (
                        <MemoryBadge text={msg.memory} type="stored" />
                      )}
                      {msg.memoryRecall && (
                        <MemoryBadge text={msg.memoryRecall} type="recalled" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex justify-start">
                  <div
                    className="rounded-2xl"
                    style={{
                      background: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      borderBottomLeftRadius: '6px',
                    }}
                  >
                    <TypingIndicator />
                  </div>
                </div>
              )}
              {isFinished && (
                <div
                  className="flex items-center justify-center gap-2 mt-4 px-4 py-3 rounded-xl text-sm"
                  style={{
                    background: 'color-mix(in oklch, var(--color-glow-1) 8%, transparent)',
                    border: '1px solid color-mix(in oklch, var(--color-glow-1) 15%, transparent)',
                    color: 'var(--color-primary)',
                    animation: 'fadeSlideIn 0.5s ease-out',
                  }}
                >
                  <Brain size={16} />
                  <span className="font-medium">Atlas remembered everything, no prompts needed.</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <p className="text-center mt-6 text-xs" style={{ color: 'var(--color-muted-foreground)', opacity: 0.7 }}>
        Simulated conversation showing real KinBot features. Memory extraction and recall happen automatically.
      </p>
    </section>
  )
}
