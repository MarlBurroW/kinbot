import { Suspense, lazy } from 'react'
import { ScrollReveal } from '../components/ScrollReveal'
import { SectionDivider } from '../components/SectionDivider'

const Features = lazy(() => import('../components/Features').then(m => ({ default: m.Features })))
const Tools = lazy(() => import('../components/Tools').then(m => ({ default: m.Tools })))
const Memory = lazy(() => import('../components/Memory').then(m => ({ default: m.Memory })))
const MiniApps = lazy(() => import('../components/MiniApps').then(m => ({ default: m.MiniApps })))
const Plugins = lazy(() => import('../components/Plugins').then(m => ({ default: m.Plugins })))
const Providers = lazy(() => import('../components/Providers').then(m => ({ default: m.Providers })))
const Channels = lazy(() => import('../components/Channels').then(m => ({ default: m.Channels })))
const UseCases = lazy(() => import('../components/UseCases').then(m => ({ default: m.UseCases })))

function SectionFallback() {
  return <div className="py-24" />
}

export function FeaturesPage() {
  return (
    <div className="pt-24">
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
      <SectionDivider variant="glow" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Plugins /></ScrollReveal>
      </Suspense>
      <SectionDivider variant="fade" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Providers /></ScrollReveal>
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Channels /></ScrollReveal>
      </Suspense>
      <SectionDivider variant="glow" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><UseCases /></ScrollReveal>
      </Suspense>
    </div>
  )
}
