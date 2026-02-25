import { useState, useEffect } from 'react'
import { Moon, Sun, Github } from 'lucide-react'

interface NavbarProps {
  dark: boolean
  onToggleDark: () => void
}

export function Navbar({ dark, onToggleDark }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'var(--color-glass-strong-bg)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px) saturate(200%)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(200%)' : 'none',
        borderBottom: scrolled ? '1px solid color-mix(in oklch, var(--color-glow-1) 15%, transparent)' : '1px solid transparent',
      }}
    >
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2">
          <span className="text-xl font-extrabold gradient-text">KinBot</span>
        </a>

        <div className="hidden sm:flex items-center gap-6">
          {[
            { label: 'Features', href: '#features' },
            { label: 'Architecture', href: '#architecture' },
            { label: 'Install', href: '#install' },
            { label: 'FAQ', href: '#faq' },
            { label: 'Changelog', href: '#changelog' },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onToggleDark}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:scale-110 glass"
            aria-label="Toggle dark mode"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <a
            href="https://github.com/MarlBurroW/kinbot"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105"
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-primary-foreground)',
            }}
          >
            <Github size={15} />
            GitHub
          </a>
        </div>
      </nav>
    </header>
  )
}
