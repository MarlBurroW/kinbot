import { useState, useEffect, lazy, Suspense } from 'react'
import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { ScrollReveal } from './components/ScrollReveal'
import { SectionDivider } from './components/SectionDivider'
import { Footer } from './components/Footer'
import { BackToTop } from './components/BackToTop'
import { CommandPalette, CommandPaletteHint } from './components/CommandPalette'
import { GitHubDataProvider, useGitHubData } from './components/GitHubDataProvider'

/** Inject SoftwareApplication JSON-LD for rich search results.
 *  Uses the shared GitHub data provider instead of fetching separately. */
function useStructuredData() {
  const { latestVersion } = useGitHubData()

  useEffect(() => {
    const id = 'app-jsonld'

    // Remove stale script if it exists (e.g. version update)
    document.getElementById(id)?.remove()

    const script = document.createElement('script')
    script.id = id
    script.type = 'application/ld+json'
    const appData: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'KinBot',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Linux, macOS, Docker',
      description:
        'Self-hosted AI agent platform with persistent identity, continuous memory, and multi-agent collaboration. 90+ built-in tools, 23+ providers, 6 chat channels, zero cloud dependency.',
      url: 'https://marlburrow.github.io/kinbot/',
      downloadUrl: 'https://github.com/MarlBurroW/kinbot',
      license: 'https://spdx.org/licenses/AGPL-3.0-only.html',
      isAccessibleForFree: true,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      author: {
        '@type': 'Person',
        name: 'MarlBurroW',
        url: 'https://github.com/MarlBurroW',
      },
      codeRepository: 'https://github.com/MarlBurroW/kinbot',
      programmingLanguage: ['TypeScript', 'React'],
      runtimePlatform: 'Bun',
      screenshot: 'https://marlburrow.github.io/kinbot/og-image.png',
      featureList: [
        'Persistent agent identity and personality',
        'Long-term vector and full-text memory',
        'Multi-agent collaboration and delegation',
        'Cron jobs and webhooks for autonomy',
        '23+ AI providers including Ollama',
        '6 messaging channels (Telegram, Discord, Slack, WhatsApp, Signal, Matrix)',
        'MCP tool server support',
        'Custom tools created by agents at runtime',
        'Mini Apps (agent-built UIs)',
        'Encrypted secrets vault (AES-256-GCM)',
        'Session compacting with smart summarization',
        'Zero infrastructure (SQLite only)',
      ],
    }
    if (latestVersion) appData.softwareVersion = latestVersion
    script.textContent = JSON.stringify([
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'KinBot',
        url: 'https://marlburrow.github.io/kinbot/',
        description:
          'Self-hosted AI agent platform with persistent memory and multi-agent collaboration.',
      },
      appData,
    ])
    document.head.appendChild(script)

    return () => {
      document.getElementById(id)?.remove()
    }
  }, [latestVersion])
}

// Lazy-load below-the-fold sections for faster initial paint
const Stats = lazy(() => import('./components/Stats').then(m => ({ default: m.Stats })))
const HowItWorks = lazy(() => import('./components/HowItWorks').then(m => ({ default: m.HowItWorks })))
const WhatIsKin = lazy(() => import('./components/WhatIsKin').then(m => ({ default: m.WhatIsKin })))
const InteractiveDemo = lazy(() => import('./components/InteractiveDemo').then(m => ({ default: m.InteractiveDemo })))
const Features = lazy(() => import('./components/Features').then(m => ({ default: m.Features })))
const Memory = lazy(() => import('./components/Memory').then(m => ({ default: m.Memory })))
const UseCases = lazy(() => import('./components/UseCases').then(m => ({ default: m.UseCases })))
const Privacy = lazy(() => import('./components/Privacy').then(m => ({ default: m.Privacy })))
const Screenshots = lazy(() => import('./components/Screenshots').then(m => ({ default: m.Screenshots })))
const Comparison = lazy(() => import('./components/Comparison').then(m => ({ default: m.Comparison })))
const Providers = lazy(() => import('./components/Providers').then(m => ({ default: m.Providers })))
const Channels = lazy(() => import('./components/Channels').then(m => ({ default: m.Channels })))
const Architecture = lazy(() => import('./components/Architecture').then(m => ({ default: m.Architecture })))
const Install = lazy(() => import('./components/Install').then(m => ({ default: m.Install })))
const Pricing = lazy(() => import('./components/Pricing').then(m => ({ default: m.Pricing })))
const FAQ = lazy(() => import('./components/FAQ').then(m => ({ default: m.FAQ })))
const Changelog = lazy(() => import('./components/Changelog').then(m => ({ default: m.Changelog })))
const EarlyAccess = lazy(() => import('./components/EarlyAccess').then(m => ({ default: m.EarlyAccess })))
const GitHubCTA = lazy(() => import('./components/GitHubCTA').then(m => ({ default: m.GitHubCTA })))

function SectionFallback() {
  return <div className="py-24" />
}

export default function App() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('kinbot-site-theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useStructuredData()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('kinbot-site-theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <GitHubDataProvider>
    <div className="surface-base min-h-screen">
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>
      <Navbar dark={dark} onToggleDark={() => setDark(d => !d)} />
      <main id="main-content">
        <Hero />
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <Stats />
          </ScrollReveal>
        </Suspense>
        <SectionDivider variant="glow" />
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <HowItWorks />
          </ScrollReveal>
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <WhatIsKin />
          </ScrollReveal>
        </Suspense>
        <SectionDivider variant="wave" />
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <InteractiveDemo />
          </ScrollReveal>
        </Suspense>
        <SectionDivider variant="glow" />
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <Features />
          </ScrollReveal>
        </Suspense>
        <SectionDivider variant="wave" />
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <Memory />
          </ScrollReveal>
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <UseCases />
          </ScrollReveal>
        </Suspense>
        <SectionDivider variant="fade" />
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <Privacy />
          </ScrollReveal>
        </Suspense>
        <SectionDivider variant="wave" flip />
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <Screenshots />
          </ScrollReveal>
        </Suspense>
        <SectionDivider variant="glow" />
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <Comparison />
          </ScrollReveal>
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <Providers />
          </ScrollReveal>
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <Channels />
          </ScrollReveal>
        </Suspense>
        <SectionDivider variant="fade" />
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <Architecture />
          </ScrollReveal>
        </Suspense>
        <SectionDivider variant="glow" />
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <Install />
          </ScrollReveal>
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <Pricing />
          </ScrollReveal>
        </Suspense>
        <SectionDivider variant="wave" />
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <FAQ />
          </ScrollReveal>
        </Suspense>
        <SectionDivider variant="glow" />
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <Changelog />
          </ScrollReveal>
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <EarlyAccess />
          </ScrollReveal>
        </Suspense>
        <SectionDivider variant="fade" />
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <GitHubCTA />
          </ScrollReveal>
        </Suspense>
      </main>
      <Footer />
      <BackToTop />
      <CommandPalette />
      <CommandPaletteHint />
    </div>
    </GitHubDataProvider>
  )
}
