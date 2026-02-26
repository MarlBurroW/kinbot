import { Github, ExternalLink, Heart } from 'lucide-react'

const productLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Providers', href: '#providers' },
  { label: 'Architecture', href: '#architecture' },
  { label: 'Install', href: '#install' },
  { label: 'Changelog', href: '#changelog' },
]

const resourceLinks = [
  { label: 'GitHub', href: 'https://github.com/MarlBurroW/kinbot' },
  { label: 'Releases', href: 'https://github.com/MarlBurroW/kinbot/releases' },
  { label: 'Issues', href: 'https://github.com/MarlBurroW/kinbot/issues' },
  { label: 'Contributing', href: 'https://github.com/MarlBurroW/kinbot/blob/main/CONTRIBUTING.md' },
]

const communityLinks = [
  { label: 'Discussions', href: 'https://github.com/MarlBurroW/kinbot/discussions' },
  { label: 'Report a Bug', href: 'https://github.com/MarlBurroW/kinbot/issues/new?template=bug_report.yml' },
  { label: 'Request a Feature', href: 'https://github.com/MarlBurroW/kinbot/issues/new?template=feature_request.yml' },
  { label: 'Request a Provider', href: 'https://github.com/MarlBurroW/kinbot/issues/new?template=provider_request.yml' },
]

function FooterColumn({ title, links, external = false }: { title: string; links: { label: string; href: string }[]; external?: boolean }) {
  return (
    <div>
      <p
        className="text-xs font-semibold uppercase tracking-wider mb-4"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        {title}
      </p>
      <ul className="space-y-2.5">
        {links.map(({ label, href }) => {
          const isExternal = external || href.startsWith('http')
          return (
            <li key={label}>
              <a
                href={href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className="inline-flex items-center gap-1 text-sm transition-colors duration-200"
                style={{ color: 'var(--color-muted-foreground)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-muted-foreground)' }}
              >
                {label}
                {isExternal && <ExternalLink size={11} className="opacity-50" />}
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer
      className="border-t px-6 pt-16 pb-8"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Main grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-10 mb-12">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-1">
            <a href="#" className="inline-flex items-center gap-2.5 mb-3">
              <img src="/kinbot/kinbot.svg" alt="KinBot" width={28} height={28} className="rounded-lg" />
              <span className="text-lg font-extrabold gradient-text">KinBot</span>
            </a>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--color-muted-foreground)' }}>
              Self-hosted AI agents with persistent memory. Your data, your server, your rules.
            </p>
            <a
              href="https://github.com/MarlBurroW/kinbot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium transition-all duration-200 hover:scale-105"
              style={{ color: 'var(--color-muted-foreground)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-muted-foreground)' }}
            >
              <Github size={16} />
              Star on GitHub
            </a>
          </div>

          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Resources" links={resourceLinks} external />
          <FooterColumn title="Community" links={communityLinks} external />
        </div>

        {/* Divider */}
        <div
          className="h-px w-full mb-6"
          style={{ background: 'var(--color-border)' }}
        />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
            © {year} KinBot. Released under{' '}
            <a
              href="https://github.com/MarlBurroW/kinbot/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors duration-200"
              style={{ color: 'var(--color-muted-foreground)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-muted-foreground)' }}
            >
              AGPL-3.0
            </a>
            .
          </p>
          <p
            className="inline-flex items-center gap-1.5 text-xs"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            Made with
            <Heart size={12} style={{ color: 'var(--color-primary)' }} fill="var(--color-primary)" />
            by{' '}
            <a
              href="https://github.com/MarlBurroW"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2 transition-colors duration-200"
              style={{ color: 'var(--color-muted-foreground)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-muted-foreground)' }}
            >
              MarlBurroW
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
