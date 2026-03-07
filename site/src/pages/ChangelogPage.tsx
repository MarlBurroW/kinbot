import { Suspense, lazy } from 'react'
import { ScrollReveal } from '../components/ScrollReveal'

const Changelog = lazy(() => import('../components/Changelog').then(m => ({ default: m.Changelog })))

function SectionFallback() {
  return <div className="py-24" />
}

export function ChangelogPage() {
  return (
    <div className="pt-24">
      <Suspense fallback={<SectionFallback />}>
        <ScrollReveal><Changelog /></ScrollReveal>
      </Suspense>
    </div>
  )
}
