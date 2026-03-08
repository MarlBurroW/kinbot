import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'

interface SectionCTAProps {
  text: string
  to: string
  label: string
}

export function SectionCTA({ text, to, label }: SectionCTAProps) {
  return (
    <div className="text-center py-8">
      <p className="text-sm mb-3" style={{ color: 'var(--color-muted-foreground)' }}>
        {text}
      </p>
      <Link
        to={to}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
        style={{
          background: 'color-mix(in oklch, var(--color-glow-1) 12%, transparent)',
          color: 'var(--color-primary)',
          border: '1px solid color-mix(in oklch, var(--color-glow-1) 25%, transparent)',
        }}
      >
        {label}
        <ArrowRight size={15} />
      </Link>
    </div>
  )
}
