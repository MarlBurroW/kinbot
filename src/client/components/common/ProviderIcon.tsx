import type { ComponentType, SVGProps } from 'react'
import { Cpu } from 'lucide-react'
import Claude from '@lobehub/icons/es/Claude'
import OpenAI from '@lobehub/icons/es/OpenAI'
import Gemini from '@lobehub/icons/es/Gemini'
import Voyage from '@lobehub/icons/es/Voyage'
import Mistral from '@lobehub/icons/es/Mistral'
import Groq from '@lobehub/icons/es/Groq'
import Together from '@lobehub/icons/es/Together'
import Fireworks from '@lobehub/icons/es/Fireworks'
import DeepSeek from '@lobehub/icons/es/DeepSeek'
import Ollama from '@lobehub/icons/es/Ollama'
import OpenRouter from '@lobehub/icons/es/OpenRouter'
import Cohere from '@lobehub/icons/es/Cohere'
import XAI from '@lobehub/icons/es/XAI'
import Tavily from '@lobehub/icons/es/Tavily'
import Jina from '@lobehub/icons/es/Jina'

type SvgIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

/** Mono icons (use currentColor) */
const PROVIDER_MONO: Record<string, SvgIcon> = {
  anthropic: Claude,
  'anthropic-oauth': Claude,
  openai: OpenAI,
  gemini: Gemini,
  voyage: Voyage,
  mistral: Mistral,
  groq: Groq,
  together: Together,
  fireworks: Fireworks,
  deepseek: DeepSeek,
  ollama: Ollama,
  openrouter: OpenRouter,
  cohere: Cohere,
  xai: XAI,
  tavily: Tavily,
  jina: Jina,
}

/** Color icons — use .Color variant where available */
const PROVIDER_COLOR: Record<string, SvgIcon> = {
  anthropic: Claude.Color,
  'anthropic-oauth': Claude.Color,
  openai: OpenAI,
  gemini: Gemini.Color,
  voyage: Voyage.Color,
  mistral: Mistral.Color,
  together: Together.Color,
  fireworks: Fireworks.Color,
  deepseek: DeepSeek.Color,
  cohere: Cohere.Color,
  tavily: Tavily.Color,
  // Mono-only icons — brand color applied via PROVIDER_BRAND_COLORS
  groq: Groq,
  openrouter: OpenRouter,
  ollama: Ollama,
  xai: XAI,
  jina: Jina,
}

/** Brand colors for providers that only have Mono icons */
const PROVIDER_BRAND_COLORS: Record<string, string> = {
  groq: '#F55036',
  openrouter: '#6566F1',
}

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
