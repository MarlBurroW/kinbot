import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router'
import { Navbar } from './components/Navbar'
import { Footer } from './components/Footer'
import { BackToTop } from './components/BackToTop'
import { CommandPalette, CommandPaletteHint } from './components/CommandPalette'
import { GitHubDataProvider, useGitHubData } from './components/GitHubDataProvider'
import { ScrollToTop } from './components/ScrollToTop'
import { HomePage } from './pages/HomePage'

/** Inject SoftwareApplication JSON-LD for rich search results. */
function useStructuredData() {
  const { latestVersion } = useGitHubData()

  useEffect(() => {
    const id = 'app-jsonld'
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

const FeaturesPage = lazy(() => import('./pages/FeaturesPage').then(m => ({ default: m.FeaturesPage })))
const ArchitecturePage = lazy(() => import('./pages/ArchitecturePage').then(m => ({ default: m.ArchitecturePage })))
const ChangelogPage = lazy(() => import('./pages/ChangelogPage').then(m => ({ default: m.ChangelogPage })))
const FAQPage = lazy(() => import('./pages/FAQPage').then(m => ({ default: m.FAQPage })))

function PageFallback() {
  return <div className="min-h-screen" />
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
      <ScrollToTop />
      <Navbar dark={dark} onToggleDark={() => setDark(d => !d)} />
      <main id="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/features" element={<Suspense fallback={<PageFallback />}><FeaturesPage /></Suspense>} />
          <Route path="/architecture" element={<Suspense fallback={<PageFallback />}><ArchitecturePage /></Suspense>} />
          <Route path="/changelog" element={<Suspense fallback={<PageFallback />}><ChangelogPage /></Suspense>} />
          <Route path="/faq" element={<Suspense fallback={<PageFallback />}><FAQPage /></Suspense>} />
        </Routes>
      </main>
      <Footer />
      <BackToTop />
      <CommandPalette />
      <CommandPaletteHint />
    </div>
    </GitHubDataProvider>
  )
}
