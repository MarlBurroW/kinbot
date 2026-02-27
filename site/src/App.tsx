import { useState, useEffect, lazy, Suspense } from 'react'
import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { ScrollReveal } from './components/ScrollReveal'
import { Footer } from './components/Footer'
import { BackToTop } from './components/BackToTop'

// Lazy-load below-the-fold sections for faster initial paint
const Stats = lazy(() => import('./components/Stats').then(m => ({ default: m.Stats })))
const HowItWorks = lazy(() => import('./components/HowItWorks').then(m => ({ default: m.HowItWorks })))
const WhatIsKin = lazy(() => import('./components/WhatIsKin').then(m => ({ default: m.WhatIsKin })))
const Features = lazy(() => import('./components/Features').then(m => ({ default: m.Features })))
const UseCases = lazy(() => import('./components/UseCases').then(m => ({ default: m.UseCases })))
const Screenshots = lazy(() => import('./components/Screenshots').then(m => ({ default: m.Screenshots })))
const Comparison = lazy(() => import('./components/Comparison').then(m => ({ default: m.Comparison })))
const Providers = lazy(() => import('./components/Providers').then(m => ({ default: m.Providers })))
const Channels = lazy(() => import('./components/Channels').then(m => ({ default: m.Channels })))
const Architecture = lazy(() => import('./components/Architecture').then(m => ({ default: m.Architecture })))
const Install = lazy(() => import('./components/Install').then(m => ({ default: m.Install })))
const FAQ = lazy(() => import('./components/FAQ').then(m => ({ default: m.FAQ })))
const Changelog = lazy(() => import('./components/Changelog').then(m => ({ default: m.Changelog })))
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

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('kinbot-site-theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
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
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <Features />
          </ScrollReveal>
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <UseCases />
          </ScrollReveal>
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <Screenshots />
          </ScrollReveal>
        </Suspense>
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
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <Architecture />
          </ScrollReveal>
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <Install />
          </ScrollReveal>
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <FAQ />
          </ScrollReveal>
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <Changelog />
          </ScrollReveal>
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <ScrollReveal>
            <GitHubCTA />
          </ScrollReveal>
        </Suspense>
      </main>
      <Footer />
      <BackToTop />
    </div>
  )
}
