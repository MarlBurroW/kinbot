import { Suspense, lazy } from 'react'
import { Hero } from '../components/Hero'
import { ScrollReveal } from '../components/ScrollReveal'
import { SectionDivider } from '../components/SectionDivider'

const Stats = lazy(() => import('../components/Stats').then(m => ({ default: m.Stats })))
const HowItWorks = lazy(() => import('../components/HowItWorks').then(m => ({ default: m.HowItWorks })))
const WhatIsKin = lazy(() => import('../components/WhatIsKin').then(m => ({ default: m.WhatIsKin })))
const InteractiveDemo = lazy(() => import('../components/InteractiveDemo').then(m => ({ default: m.InteractiveDemo })))
const Comparison = lazy(() => import('../components/Comparison').then(m => ({ default: m.Comparison })))
const Install = lazy(() => import('../components/Install').then(m => ({ default: m.Install })))
const GitHubCTA = lazy(() => import('../components/GitHubCTA').then(m => ({ default: m.GitHubCTA })))

function SectionFallback() {
  return <div className="py-24" />
}

export function HomePage() {
  return (
    <>
      <Hero />
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
      <SectionDivider variant="wave" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><InteractiveDemo /></ScrollReveal>
      </Suspense>
      <SectionDivider variant="glow" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Comparison /></ScrollReveal>
      </Suspense>
      <SectionDivider variant="glow" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Install /></ScrollReveal>
      </Suspense>
      <SectionDivider variant="fade" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><GitHubCTA /></ScrollReveal>
      </Suspense>
    </>
  )
}
