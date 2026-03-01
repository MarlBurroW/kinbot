import { useState, useEffect } from 'react'
import { Moon, Sun, Github, Menu, X } from 'lucide-react'

interface NavbarProps {
  dark: boolean
  onToggleDark: () => void
}

const NAV_LINKS = [
  { label: 'Demo', href: '#demo' },
  { label: 'Features', href: '#features' },
  { label: 'Use Cases', href: '#use-cases' },
  { label: 'Compare', href: '#comparison' },
  { label: 'Install', href: '#install' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Changelog', href: '#changelog' },
]

function useActiveSection() {
  const [active, setActive] = useState('')

  useEffect(() => {
    const ids = NAV_LINKS.map(l => l.href.slice(1))
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActive(visible[0].target.id)
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    )

    ids.forEach(id => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  return active
}

export function Navbar({ dark, onToggleDark }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const activeSection = useActiveSection()

  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    const handler = () => {
      setScrolled(window.scrollY > 20)
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      setScrollProgress(docHeight > 0 ? Math.min(window.scrollY / docHeight, 1) : 0)
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const handleNavClick = () => setMobileOpen(false)

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      style={{
        background: scrolled || mobileOpen ? 'var(--color-glass-strong-bg)' : 'transparent',
        backdropFilter: scrolled || mobileOpen ? 'blur(20px) saturate(200%)' : 'none',
        WebkitBackdropFilter: scrolled || mobileOpen ? 'blur(20px) saturate(200%)' : 'none',
        borderBottom: scrolled ? '1px solid color-mix(in oklch, var(--color-glow-1) 15%, transparent)' : '1px solid transparent',
      }}
    >
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between" aria-label="Main navigation">
        <a href="#" className="flex items-center gap-2.5">
          <img src="/kinbot/kinbot.svg" alt="KinBot" width={32} height={32} className="rounded-lg" />
          <span className="text-xl font-extrabold gradient-text">KinBot</span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ label, href }) => {
            const isActive = activeSection === href.slice(1)
            return (
              <a
                key={label}
                href={href}
                aria-current={isActive ? 'true' : undefined}
                className="relative text-sm font-medium px-3 py-1.5 rounded-lg transition-all duration-200"
                style={{
                  color: isActive ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
                  background: isActive ? 'color-mix(in oklch, var(--color-glow-1) 8%, transparent)' : 'transparent',
                }}
              >
                {label}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
                    style={{ background: 'var(--color-primary)' }}
                  />
                )}
              </a>
            )
          })}
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
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105"
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-primary-foreground)',
            }}
          >
            <Github size={15} />
            GitHub
          </a>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center transition-all glass"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-menu"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {/* Scroll progress bar */}
      <div
        className="absolute bottom-0 left-0 h-[2px] transition-opacity duration-300"
        style={{
          width: `${scrollProgress * 100}%`,
          background: 'linear-gradient(90deg, var(--color-glow-1), var(--color-glow-2))',
          opacity: scrolled ? 1 : 0,
        }}
      />

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          id="mobile-nav-menu"
          role="navigation"
          aria-label="Mobile navigation"
          className="md:hidden border-t px-6 pb-6 pt-2"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-glass-strong-bg)',
            backdropFilter: 'blur(20px) saturate(200%)',
            WebkitBackdropFilter: 'blur(20px) saturate(200%)',
          }}
        >
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map(({ label, href }) => {
              const isActive = activeSection === href.slice(1)
              return (
                <a
                  key={label}
                  href={href}
                  onClick={handleNavClick}
                  aria-current={isActive ? 'true' : undefined}
                  className="text-base font-medium px-3 py-2.5 rounded-lg transition-all duration-200"
                  style={{
                    color: isActive ? 'var(--color-primary)' : 'var(--color-foreground)',
                    background: isActive ? 'color-mix(in oklch, var(--color-glow-1) 8%, transparent)' : 'transparent',
                  }}
                >
                  {label}
                </a>
              )
            })}
          </div>
          <a
            href="https://github.com/MarlBurroW/kinbot"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 mt-4 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-primary-foreground)',
            }}
          >
            <Github size={15} />
            View on GitHub
          </a>
        </div>
      )}
    </header>
  )
}
