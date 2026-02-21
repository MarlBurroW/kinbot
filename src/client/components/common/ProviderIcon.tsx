import type { ComponentType, SVGProps } from 'react'
import { Cpu } from 'lucide-react'
import Claude from '@lobehub/icons/es/Claude'
import OpenAI from '@lobehub/icons/es/OpenAI'
import Gemini from '@lobehub/icons/es/Gemini'
import Voyage from '@lobehub/icons/es/Voyage'

type SvgIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

/** Mono icons (use currentColor) */
const PROVIDER_MONO: Record<string, SvgIcon> = {
  anthropic: Claude,
  'anthropic-oauth': Claude,
  openai: OpenAI,
  gemini: Gemini,
  voyage: Voyage,
}

/** Color icons — use .Color variant where available */
const PROVIDER_COLOR: Record<string, SvgIcon> = {
  anthropic: Claude.Color,
  'anthropic-oauth': Claude.Color,
  openai: OpenAI,
  gemini: Gemini.Color,
  voyage: Voyage.Color,
}

/** Brand colors for providers that only have Mono icons */
const PROVIDER_BRAND_COLORS: Record<string, string> = {}

interface ProviderIconProps {
  providerType: string
  className?: string
  /** 'mono' uses currentColor (default), 'color' uses brand colors / native Color variants */
  variant?: 'mono' | 'color'
}

export function ProviderIcon({ providerType, className, variant = 'mono' }: ProviderIconProps) {
  if (variant === 'color') {
    const Icon = PROVIDER_COLOR[providerType]
    if (!Icon) return <Cpu className={className} />
    const brandColor = PROVIDER_BRAND_COLORS[providerType]
    return <Icon className={className} {...(brandColor ? { color: brandColor } : {})} />
  }

  const Icon = PROVIDER_MONO[providerType]
  if (!Icon) return <Cpu className={className} />
  return <Icon className={className} />
}
