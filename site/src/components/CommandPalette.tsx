import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router'
import {
  Search,
  Zap,
  Cpu,
  MessageSquare,
  Layout,
  Download,
  HelpCircle,
  GitBranch,
  Github,
  ArrowRight,
  BarChart3,
  Layers,
  Users,
  DollarSign,
  Command,
} from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

interface PaletteItem {
  id: string
  label: string
  description: string
  icon: Icon
  action: () => void
  keywords: string[]
}

interface SectionDef {
  id: string
  label: string
  description: string
  icon: Icon
  keywords: string[]
  route?: string // if set, navigate to this route instead of scrolling
}

const sections: SectionDef[] = [
  { id: 'hero', label: 'Home', description: 'Back to the top', icon: Zap, keywords: ['home', 'top', 'start', 'hero'] },
  { id: 'demo', label: 'Interactive Demo', description: 'Watch simulated conversations', icon: Zap, keywords: ['demo', 'interactive', 'try', 'simulation', 'chat'] },
  { id: 'what-is-a-kin', label: 'What is a Kin?', description: 'Core concept explained', icon: Users, keywords: ['kin', 'agent', 'concept', 'what'] },
  { id: 'comparison', label: 'Comparison', description: 'vs ChatGPT, Open WebUI, etc.', icon: BarChart3, keywords: ['compare', 'versus', 'vs', 'alternative'] },
  { id: 'install', label: 'Install', description: 'Get started in minutes', icon: Download, keywords: ['install', 'setup', 'docker', 'download', 'get started'] },
  { id: 'features', label: 'Features', description: 'Core capabilities', icon: Zap, keywords: ['features', 'capabilities'], route: '/features' },
  { id: 'tools', label: 'Built-in Tools', description: '90+ tools out of the box', icon: Zap, keywords: ['tools', 'built-in', 'recall', 'memorize', 'shell', 'cron', 'vault'], route: '/features' },
  { id: 'memory', label: 'Memory', description: 'Persistent long-term memory system', icon: Zap, keywords: ['memory', 'remember', 'vector', 'search', 'context', 'persistent'], route: '/features' },
  { id: 'mini-apps', label: 'Mini Apps', description: 'Agent-built interactive UIs', icon: Layers, keywords: ['mini apps', 'apps', 'ui', 'dashboard', 'react', 'sidebar'], route: '/features' },
  { id: 'use-cases', label: 'Use Cases', description: 'What people are building', icon: Layers, keywords: ['use case', 'build', 'homelab', 'dev'], route: '/features' },
  { id: 'plugins', label: 'Plugin System', description: 'Extend with tools, providers, channels, hooks', icon: Layers, keywords: ['plugin', 'extension', 'hook', 'registry', 'marketplace', 'hot reload'], route: '/features' },
  { id: 'providers', label: 'Providers', description: '23+ AI providers', icon: Cpu, keywords: ['provider', 'model', 'openai', 'anthropic', 'ollama', 'gemini'], route: '/features' },
  { id: 'channels', label: 'Channels', description: 'Telegram, Discord, Slack...', icon: MessageSquare, keywords: ['channel', 'telegram', 'discord', 'slack', 'whatsapp', 'signal', 'matrix'], route: '/features' },
  { id: 'architecture', label: 'Architecture', description: 'How it works under the hood', icon: Layout, keywords: ['architecture', 'stack', 'tech', 'sqlite', 'bun'], route: '/architecture' },
  { id: 'privacy', label: 'Privacy & Security', description: 'Self-hosted, zero telemetry, encrypted vault', icon: Zap, keywords: ['privacy', 'security', 'vault', 'encryption', 'self-hosted', 'telemetry'], route: '/architecture' },
  { id: 'faq', label: 'FAQ', description: 'Common questions', icon: HelpCircle, keywords: ['faq', 'question', 'help', 'how'], route: '/faq' },
  { id: 'pricing', label: 'Pricing', description: 'Free & self-hosted', icon: DollarSign, keywords: ['pricing', 'cost', 'free', 'price'], route: '/faq' },
  { id: 'changelog', label: 'Changelog', description: 'Latest releases', icon: GitBranch, keywords: ['changelog', 'release', 'version', 'update', 'history'], route: '/changelog' },
]

const externalLinks: Omit<PaletteItem, 'action'>[] = [
  { id: 'docs', label: 'Documentation', description: 'Full project documentation', icon: HelpCircle, keywords: ['docs', 'documentation', 'guide', 'reference', 'api'] },
  { id: 'github', label: 'GitHub Repository', description: 'Source code & issues', icon: Github, keywords: ['github', 'repo', 'source', 'code', 'issue', 'star'] },
  { id: 'contributing', label: 'Contributing Guide', description: 'How to contribute', icon: ArrowRight, keywords: ['contribute', 'pr', 'pull request'] },
  { id: 'discussions', label: 'Discussions', description: 'Questions, ideas, show & tell', icon: MessageSquare, keywords: ['discussions', 'community', 'forum', 'help', 'support'] },
]

function scrollToSection(id: string) {
  if (id === 'hero') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}

function openExternal(id: string) {
  const urls: Record<string, string> = {
    docs: '/kinbot/docs/',
    github: 'https://github.com/MarlBurroW/kinbot',
    contributing: 'https://github.com/MarlBurroW/kinbot/blob/main/CONTRIBUTING.md',
    discussions: 'https://github.com/MarlBurroW/kinbot/discussions',
  }
  const url = urls[id]
  if (!url) return
  if (url.startsWith('/')) {
    window.location.href = url
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const goToSection = useCallback((s: SectionDef) => {
    if (s.route) {
      navigate(s.route)
      // After navigation, scroll to the section
      setTimeout(() => {
        const el = document.getElementById(s.id)
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } else {
      scrollToSection(s.id)
    }
    setOpen(false)
  }, [navigate])

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  const items = useMemo<PaletteItem[]>(() => {
    const sectionItems: PaletteItem[] = sections.map(s => ({
      ...s,
      action: () => goToSection(s),
    }))
    const extItems: PaletteItem[] = externalLinks.map(s => ({
      ...s,
      action: () => { openExternal(s.id); setOpen(false) },
    }))
    return [...sectionItems, ...extItems]
  }, [goToSection])

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter(item =>
      item.label.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.keywords.some(k => k.includes(q))
    )
  }, [items, query])

  // Reset selection when filter changes
  useEffect(() => {
    setSelected(0)
  }, [filtered.length])

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[selected]) {
      e.preventDefault()
      filtered[selected].action()
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4"
      style={{
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'var(--color-background)',
          border: '1px solid color-mix(in oklch, var(--color-glow-1) 25%, var(--color-border))',
          boxShadow: '0 24px 80px rgba(0,0,0,0.4), 0 0 40px color-mix(in oklch, var(--color-glow-1) 8%, transparent)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <Search size={18} style={{ color: 'var(--color-muted-foreground)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jump to section..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--color-foreground)' }}
            aria-label="Search sections"
          />
          <kbd
            className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{
              background: 'color-mix(in oklch, var(--color-muted-foreground) 10%, transparent)',
              color: 'var(--color-muted-foreground)',
              border: '1px solid var(--color-border)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto py-2"
          role="listbox"
        >
          {filtered.length === 0 && (
            <p
              className="text-sm text-center py-8"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              No results found.
            </p>
          )}
          {filtered.map((item, i) => {
            const isSelected = i === selected
            return (
              <button
                key={item.id}
                onClick={item.action}
                onMouseEnter={() => setSelected(i)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100"
                style={{
                  background: isSelected
                    ? 'color-mix(in oklch, var(--color-glow-1) 10%, transparent)'
                    : 'transparent',
                }}
                role="option"
                aria-selected={isSelected}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: isSelected
                      ? 'color-mix(in oklch, var(--color-glow-1) 18%, transparent)'
                      : 'color-mix(in oklch, var(--color-muted-foreground) 8%, transparent)',
                    color: isSelected ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
                  }}
                >
                  <item.icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: isSelected ? 'var(--color-foreground)' : 'var(--color-foreground)' }}
                  >
                    {item.label}
                  </p>
                  <p
                    className="text-xs truncate"
                    style={{ color: 'var(--color-muted-foreground)' }}
                  >
                    {item.description}
                  </p>
                </div>
                {isSelected && (
                  <ArrowRight size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Footer hint */}
        <div
          className="flex items-center justify-between px-4 py-2 border-t text-[10px]"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-muted-foreground)',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded" style={{ background: 'color-mix(in oklch, var(--color-muted-foreground) 10%, transparent)', border: '1px solid var(--color-border)' }}>↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded" style={{ background: 'color-mix(in oklch, var(--color-muted-foreground) 10%, transparent)', border: '1px solid var(--color-border)' }}>↵</kbd>
              Open
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded" style={{ background: 'color-mix(in oklch, var(--color-muted-foreground) 10%, transparent)', border: '1px solid var(--color-border)' }}>esc</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  )
}

/** Small floating button hint for the command palette (visible on desktop) */
export function CommandPaletteHint() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  const handleClick = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
  }

  if (!visible) return null

  return (
    <button
      onClick={handleClick}
      className="hidden lg:flex fixed bottom-6 right-20 items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 hover:scale-105 z-40"
      style={{
        background: 'var(--color-glass-strong-bg)',
        backdropFilter: 'blur(12px)',
        border: '1px solid color-mix(in oklch, var(--color-glow-1) 20%, transparent)',
        color: 'var(--color-muted-foreground)',
        opacity: 0.8,
      }}
      aria-label="Open command palette (⌘K)"
    >
      <Command size={12} />
      <span>⌘K</span>
    </button>
  )
}
