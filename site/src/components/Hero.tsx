import { useState, useEffect, useRef } from 'react'
import { Check, Copy, Github, ArrowRight, Star, GitFork, Tag } from 'lucide-react'
import { useGitHubData } from './GitHubDataProvider'
import previewFallback from '/preview1.mp4'

const PREVIEW_DARK = '/kinbot/showcase/preview-dark.mp4'
const PREVIEW_LIGHT = '/kinbot/showcase/preview-light.mp4'

const INSTALL_CMD = 'curl -fsSL https://raw.githubusercontent.com/MarlBurroW/kinbot/main/install.sh | bash'

const TERMINAL_LINES = [
  { text: '$ curl -fsSL .../install.sh | bash', color: 'var(--color-foreground)', delay: 0 },
  { text: '', delay: 400 },
  { text: '  ╭──────────────────────────────────╮', color: 'var(--color-primary)', delay: 600 },
  { text: '  │        🤖 KinBot Installer        │', color: 'var(--color-primary)', delay: 700 },
  { text: '  ╰──────────────────────────────────╯', color: 'var(--color-primary)', delay: 800 },
  { text: '', delay: 900 },
  { text: '  ✓ Bun v1.2.4 detected', color: '#10B981', delay: 1100 },
  { text: '  ✓ Cloning MarlBurroW/kinbot...', color: '#10B981', delay: 1500 },
  { text: '  ✓ Installing dependencies...', color: '#10B981', delay: 2100 },
  { text: '  ✓ Building frontend...', color: '#10B981', delay: 2800 },
  { text: '  ✓ Running migrations...', color: '#10B981', delay: 3300 },
  { text: '  ✓ Creating system service...', color: '#10B981', delay: 3700 },
  { text: '', delay: 4000 },
  { text: '  🚀 KinBot is running at http://localhost:3000', color: 'var(--color-primary)', delay: 4200 },
  { text: '     Open the URL to start the setup wizard.', color: 'var(--color-muted-foreground)', delay: 4400 },
]

function TerminalAnimation() {
  const [visibleLines, setVisibleLines] = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const hasStarted = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || hasStarted.current) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setVisibleLines(TERMINAL_LINES.length)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted.current) {
          hasStarted.current = true
          setStarted(true)
          observer.disconnect()
        }
      },
      { threshold: 0.5 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!started) return
    const timers: ReturnType<typeof setTimeout>[] = []
    TERMINAL_LINES.forEach((line, i) => {
      timers.push(setTimeout(() => setVisibleLines(i + 1), line.delay))
    })
    // After all lines shown, wait and restart
    const restartTimer = setTimeout(() => {
      setVisibleLines(0)
      setTimeout(() => {
        TERMINAL_LINES.forEach((line, i) => {
          timers.push(setTimeout(() => setVisibleLines(i + 1), line.delay))
        })
      }, 600)
    }, TERMINAL_LINES[TERMINAL_LINES.length - 1].delay + 5000)
    timers.push(restartTimer)
    return () => timers.forEach(clearTimeout)
  }, [started])

  return (
    <div ref={ref} className="hidden sm:block font-mono text-xs leading-relaxed" style={{ minHeight: '14rem' }}>
      {TERMINAL_LINES.slice(0, visibleLines).map((line, i) => (
        <div
          key={i}
          style={{
            color: line.color || 'var(--color-muted-foreground)',
            opacity: i === visibleLines - 1 ? 1 : 0.9,
            transition: 'opacity 0.2s',
          }}
        >
          {line.text || '\u00A0'}
        </div>
      ))}
      {started && visibleLines < TERMINAL_LINES.length && visibleLines > 0 && (
        <span
          className="inline-block w-2 h-4 ml-0.5"
          style={{
            background: 'var(--color-primary)',
            animation: 'terminal-blink 1s step-end infinite',
          }}
        />
      )}
    </div>
  )
}

function StatBadge({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
      style={{
        background: 'color-mix(in oklch, var(--color-glow-1) 8%, transparent)',
        color: 'var(--color-muted-foreground)',
        border: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)',
      }}
      title={label}
    >
      {icon}
      <span>{value}</span>
    </div>
  )
}

function RotatingText({ phrases }: { phrases: string[] }) {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'in' | 'out'>('in')

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase('out')
      setTimeout(() => {
        setIndex(i => (i + 1) % phrases.length)
        setPhase('in')
      }, 400)
    }, 3000)
    return () => clearInterval(interval)
  }, [phrases.length])

  return (
    <span
      className="inline-block gradient-text transition-all duration-400"
      style={{
        opacity: phase === 'in' ? 1 : 0,
        transform: phase === 'in' ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}
    >
      {phrases[index]}
    </span>
  )
}

function usePreviewVideo() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  )
  const [useFallback, setUseFallback] = useState(false)

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
      setUseFallback(false)
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [])

  const src = useFallback
    ? previewFallback
    : isDark ? PREVIEW_DARK : PREVIEW_LIGHT

  return { src, onError: () => setUseFallback(true) }
}

export function Hero() {
  const [copied, setCopied] = useState(false)
  const ghData = useGitHubData()
  const stats = ghData.repo ? { stars: ghData.repo.stars, forks: ghData.repo.forks, version: ghData.latestVersion ?? '' } : null
  const preview = usePreviewVideo()

  const copy = async () => {
    await navigator.clipboard.writeText(INSTALL_CMD)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 overflow-hidden">

      {/* Dot grid background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(color-mix(in oklch, var(--color-glow-1) 25%, transparent) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, black 20%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, black 20%, transparent 70%)',
        }}
      />

      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="animate-pulse-glow absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--color-glow-1) 12%, transparent) 0%, transparent 70%)' }}
        />
        <div
          className="animate-pulse-glow absolute top-1/4 right-0 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--color-glow-2) 8%, transparent) 0%, transparent 70%)', animationDelay: '1s' }}
        />
        <div
          className="animate-pulse-glow absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--color-glow-3) 6%, transparent) 0%, transparent 70%)', animationDelay: '2s' }}
        />
      </div>

      {/* Badge */}
      <div className="animate-fade-in-up" style={{ animationDelay: '0s' }}>
        <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium mb-8"
          style={{ color: 'var(--color-primary)' }}>
          <span className="relative flex size-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: 'var(--color-primary)' }} />
            <span className="relative inline-flex rounded-full size-2"
              style={{ background: 'var(--color-primary)' }} />
          </span>
          Open Source · Self-hosted · AGPL-3.0
        </span>
      </div>

      {/* GitHub stats */}
      {stats && (
        <div className="animate-fade-in-up flex items-center gap-3 mb-6" style={{ animationDelay: '0.05s' }}>
          {stats.version && (
            <StatBadge
              icon={<Tag size={12} style={{ color: 'var(--color-primary)' }} />}
              label="Latest version"
              value={stats.version}
            />
          )}
          <StatBadge
            icon={<Star size={12} style={{ color: 'var(--color-primary)' }} />}
            label="GitHub stars"
            value={stats.stars.toLocaleString()}
          />
          <StatBadge
            icon={<GitFork size={12} style={{ color: 'var(--color-primary)' }} />}
            label="Forks"
            value={stats.forks.toLocaleString()}
          />
        </div>
      )}

      {/* Heading */}
      <div className="animate-fade-in-up text-center max-w-4xl" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center justify-center gap-4 mb-6">
          <img src="/kinbot/kinbot.svg" alt="KinBot" className="size-16 sm:size-20 lg:size-24 rounded-2xl drop-shadow-xl" fetchPriority="high" />
          <h1 className="text-6xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight leading-none">
            <span className="gradient-text animate-gradient">KinBot</span>
          </h1>
        </div>
        <p className="text-2xl sm:text-3xl font-semibold mb-4" style={{ color: 'var(--color-foreground)' }}>
          AI agents that{' '}
          <RotatingText
            phrases={[
              'actually remember you.',
              'work together.',
              'live on your server.',
              'never forget context.',
              'learn over time.',
            ]}
          />
        </p>
        <p className="text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          Create AI agents that live on your server, remember everything, and work together.
          One process, one file, zero cloud.
        </p>
      </div>

      {/* Video preview */}
      <div className="animate-levitate animate-fade-in-up mt-10 w-full max-w-6xl" style={{ animationDelay: '0.2s' }}>
        <div className="glass-strong gradient-border rounded-2xl overflow-hidden shadow-xl">
          <video
            key={preview.src}
            src={preview.src}
            autoPlay
            loop
            muted
            playsInline
            className="w-full block"
            onError={preview.onError}
          />
        </div>
      </div>

      {/* CTA buttons */}
      <div className="animate-fade-in-up flex flex-col sm:flex-row items-center gap-4 mt-10" style={{ animationDelay: '0.3s' }}>
        <a
          href="https://github.com/MarlBurroW/kinbot"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
          style={{
            background: 'var(--color-primary)',
            color: 'var(--color-primary-foreground)',
            boxShadow: '0 0 24px color-mix(in oklch, var(--color-glow-1) 40%, transparent)',
          }}
        >
          <Github size={18} />
          View on GitHub
          <ArrowRight size={16} />
        </a>
        <a
          href="#install"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 active:scale-95 glass"
          style={{ color: 'var(--color-foreground)' }}
        >
          Quick install
        </a>
      </div>

      {/* Install command */}
      <div className="animate-fade-in-up w-full max-w-2xl mt-8" style={{ animationDelay: '0.4s' }}>
        <style>{`@keyframes terminal-blink { 50% { opacity: 0; } }`}</style>
        <div className="glass-strong gradient-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400 opacity-70" />
              <div className="w-3 h-3 rounded-full bg-yellow-400 opacity-70" />
              <div className="w-3 h-3 rounded-full bg-green-400 opacity-70" />
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--color-muted-foreground)' }}>terminal</span>
            <button
              onClick={copy}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors"
              style={{
                color: copied ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
                background: copied ? 'color-mix(in oklch, var(--color-glow-1) 10%, transparent)' : 'transparent',
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="px-5 py-4 overflow-x-auto">
            {/* Static command for mobile / reduced motion */}
            <div className="sm:hidden font-mono text-sm" style={{ color: 'var(--color-foreground)' }}>
              <span style={{ color: 'var(--color-muted-foreground)' }}>$ </span>
              <span>{INSTALL_CMD}</span>
            </div>
            {/* Animated terminal for desktop */}
            <TerminalAnimation />
          </div>
        </div>
        <p className="text-center text-xs mt-2" style={{ color: 'var(--color-muted-foreground)' }}>
          Linux (Debian/Ubuntu, RHEL/Fedora) and macOS · Requires git
        </p>
      </div>
    </section>
  )
}
