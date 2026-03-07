import { Suspense, lazy } from 'react'
import { ScrollReveal } from '../components/ScrollReveal'
import { SectionDivider } from '../components/SectionDivider'

const FAQ = lazy(() => import('../components/FAQ').then(m => ({ default: m.FAQ })))
const Pricing = lazy(() => import('../components/Pricing').then(m => ({ default: m.Pricing })))

function SectionFallback() {
  return <div className="py-24" />
}

export function FAQPage() {
  return (
    <div className="pt-24">
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><FAQ /></ScrollReveal>
      </Suspense>
      <SectionDivider variant="glow" />
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Pricing /></ScrollReveal>
      </Suspense>
    </div>
  )
}
