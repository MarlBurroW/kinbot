import { Suspense, lazy } from 'react'
import { ScrollReveal } from '../components/ScrollReveal'
import { SectionDivider } from '../components/SectionDivider'

const Architecture = lazy(() => import('../components/Architecture').then(m => ({ default: m.Architecture })))
const TechStack = lazy(() => import('../components/TechStack').then(m => ({ default: m.TechStack })))
const Privacy = lazy(() => import('../components/Privacy').then(m => ({ default: m.Privacy })))

function SectionFallback() {
  return <div className="py-24" />
}

export function ArchitecturePage() {
  return (
    <div className="pt-24">
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Architecture /></ScrollReveal>
      </Suspense>
      <SectionDivider variant="glow" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><TechStack /></ScrollReveal>
      </Suspense>
      <SectionDivider variant="fade" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Privacy /></ScrollReveal>
      </Suspense>
    </div>
  )
}
