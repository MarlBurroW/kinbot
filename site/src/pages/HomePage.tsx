import { Suspense, lazy } from 'react'
import { Hero } from '../components/Hero'
import { ScrollReveal } from '../components/ScrollReveal'
import { SectionDivider } from '../components/SectionDivider'

const Stats = lazy(() => import('../components/Stats').then(m => ({ default: m.Stats })))
const HowItWorks = lazy(() => import('../components/HowItWorks').then(m => ({ default: m.HowItWorks })))
const WhatIsKin = lazy(() => import('../components/WhatIsKin').then(m => ({ default: m.WhatIsKin })))
const InteractiveDemo = lazy(() => import('../components/InteractiveDemo').then(m => ({ default: m.InteractiveDemo })))
const Features = lazy(() => import('../components/Features').then(m => ({ default: m.Features })))
const Tools = lazy(() => import('../components/Tools').then(m => ({ default: m.Tools })))
const Memory = lazy(() => import('../components/Memory').then(m => ({ default: m.Memory })))
const MiniApps = lazy(() => import('../components/MiniApps').then(m => ({ default: m.MiniApps })))
const UseCases = lazy(() => import('../components/UseCases').then(m => ({ default: m.UseCases })))
const Plugins = lazy(() => import('../components/Plugins').then(m => ({ default: m.Plugins })))
const Privacy = lazy(() => import('../components/Privacy').then(m => ({ default: m.Privacy })))
const Comparison = lazy(() => import('../components/Comparison').then(m => ({ default: m.Comparison })))
const Providers = lazy(() => import('../components/Providers').then(m => ({ default: m.Providers })))
const Channels = lazy(() => import('../components/Channels').then(m => ({ default: m.Channels })))
const Architecture = lazy(() => import('../components/Architecture').then(m => ({ default: m.Architecture })))
const TechStack = lazy(() => import('../components/TechStack').then(m => ({ default: m.TechStack })))
const Install = lazy(() => import('../components/Install').then(m => ({ default: m.Install })))
const Pricing = lazy(() => import('../components/Pricing').then(m => ({ default: m.Pricing })))
const FAQ = lazy(() => import('../components/FAQ').then(m => ({ default: m.FAQ })))
const Changelog = lazy(() => import('../components/Changelog').then(m => ({ default: m.Changelog })))
const EarlyAccess = lazy(() => import('../components/EarlyAccess').then(m => ({ default: m.EarlyAccess })))
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
        <ScrollReveal><Features /></ScrollReveal>
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Tools /></ScrollReveal>
      </Suspense>
      <SectionDivider variant="wave" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Memory /></ScrollReveal>
      </Suspense>
      <SectionDivider variant="glow" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><MiniApps /></ScrollReveal>
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><UseCases /></ScrollReveal>
      </Suspense>
      <SectionDivider variant="glow" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Plugins /></ScrollReveal>
      </Suspense>
      <SectionDivider variant="fade" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Privacy /></ScrollReveal>
      </Suspense>
      <SectionDivider variant="glow" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Comparison /></ScrollReveal>
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Providers /></ScrollReveal>
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Channels /></ScrollReveal>
      </Suspense>
      <SectionDivider variant="fade" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Architecture /></ScrollReveal>
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><TechStack /></ScrollReveal>
      </Suspense>
      <SectionDivider variant="glow" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Install /></ScrollReveal>
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Pricing /></ScrollReveal>
      </Suspense>
      <SectionDivider variant="wave" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><FAQ /></ScrollReveal>
      </Suspense>
      <SectionDivider variant="glow" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Changelog /></ScrollReveal>
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><EarlyAccess /></ScrollReveal>
      </Suspense>
      <SectionDivider variant="fade" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><GitHubCTA /></ScrollReveal>
      </Suspense>
    </>
  )
}
