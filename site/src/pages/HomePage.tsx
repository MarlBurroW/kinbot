import { Suspense, lazy } from 'react'
import { usePageMeta } from '../hooks/usePageMeta'
import { Hero } from '../components/Hero'
import { ScrollReveal } from '../components/ScrollReveal'
import { SectionDivider } from '../components/SectionDivider'
import { SectionCTA } from '../components/SectionCTA'

const Pitch = lazy(() => import('../components/Pitch').then(m => ({ default: m.Pitch })))
const Stats = lazy(() => import('../components/Stats').then(m => ({ default: m.Stats })))
const HowItWorks = lazy(() => import('../components/HowItWorks').then(m => ({ default: m.HowItWorks })))
const WhatIsKin = lazy(() => import('../components/WhatIsKin').then(m => ({ default: m.WhatIsKin })))
const InteractiveDemo = lazy(() => import('../components/InteractiveDemo').then(m => ({ default: m.InteractiveDemo })))
const Install = lazy(() => import('../components/Install').then(m => ({ default: m.Install })))
const GitHubCTA = lazy(() => import('../components/GitHubCTA').then(m => ({ default: m.GitHubCTA })))

function SectionFallback() {
  return <div className="py-24" />
}

export function HomePage() {
  usePageMeta({
    title: 'KinBot',
    description: 'Self-hosted AI agents with persistent memory, multi-agent collaboration, and zero cloud dependency.',
  })

  return (
    <>
      <Hero />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Pitch /></ScrollReveal>
      </Suspense>
      <SectionCTA
        text="Memory, tools, MCP, cron jobs, and more."
        to="/features"
        label="See all features"
      />
      <SectionDivider variant="glow" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Stats /></ScrollReveal>
      </Suspense>
      <SectionDivider variant="glow" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><HowItWorks /></ScrollReveal>
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><WhatIsKin /></ScrollReveal>
      </Suspense>
      <SectionCTA
        text="Hub routing, session compacting, encrypted vault..."
        to="/architecture"
        label="Explore the architecture"
      />
      <SectionDivider variant="wave" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><InteractiveDemo /></ScrollReveal>
      </Suspense>
      <SectionDivider variant="glow" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Install /></ScrollReveal>
      </Suspense>
      <SectionCTA
        text="Common questions about setup, providers, and self-hosting."
        to="/faq"
        label="Read the FAQ"
      />
      <SectionDivider variant="fade" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><GitHubCTA /></ScrollReveal>
      </Suspense>
    </>
  )
}
