import { type ComponentType, type SVGProps, useState, useEffect, memo } from 'react'
import { Cpu, Search } from 'lucide-react'

type SvgIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

/** Lazy icon loaders — each provider's icons are only fetched when first rendered */
const ICON_LOADERS: Record<string, () => Promise<{ default: SvgIcon & { Color?: SvgIcon } }>> = {
  anthropic: () => import('@lobehub/icons/es/Claude') as any,
  'anthropic-oauth': () => import('@lobehub/icons/es/Claude') as any,
  openai: () => import('@lobehub/icons/es/OpenAI') as any,
  gemini: () => import('@lobehub/icons/es/Gemini') as any,
  voyage: () => import('@lobehub/icons/es/Voyage') as any,
  mistral: () => import('@lobehub/icons/es/Mistral') as any,
  groq: () => import('@lobehub/icons/es/Groq') as any,
  together: () => import('@lobehub/icons/es/Together') as any,
  fireworks: () => import('@lobehub/icons/es/Fireworks') as any,
  deepseek: () => import('@lobehub/icons/es/DeepSeek') as any,
  ollama: () => import('@lobehub/icons/es/Ollama') as any,
  openrouter: () => import('@lobehub/icons/es/OpenRouter') as any,
  cohere: () => import('@lobehub/icons/es/Cohere') as any,
  xai: () => import('@lobehub/icons/es/XAI') as any,
  tavily: () => import('@lobehub/icons/es/Tavily') as any,
  jina: () => import('@lobehub/icons/es/Jina') as any,
  replicate: () => import('@lobehub/icons/es/Replicate') as any,
  stability: () => import('@lobehub/icons/es/Stability') as any,
  fal: () => import('@lobehub/icons/es/Fal') as any,
}

/** Providers that have a .Color variant */
const HAS_COLOR_VARIANT = new Set([
  'anthropic', 'anthropic-oauth', 'gemini', 'voyage', 'mistral',
  'together', 'fireworks', 'deepseek', 'cohere', 'tavily',
])

/** Brand colors for providers that only have Mono icons */
const PROVIDER_BRAND_COLORS: Record<string, string> = {
  groq: '#F55036',
  openrouter: '#6566F1',
  serper: '#48BB78',
}

/** Image fallbacks for providers not in @lobehub/icons */
const PROVIDER_IMG_FALLBACKS: Record<string, string> = {
  'brave-search': 'https://cdn.simpleicons.org/brave/fb542b',
  nomic: 'https://nomic.ai/favicon.ico',
}

/** Cache resolved icon modules to avoid re-importing */
const iconCache = new Map<string, SvgIcon & { Color?: SvgIcon }>()

interface ProviderIconProps {
  providerType: string
  className?: string
  /** 'mono' uses currentColor (default), 'color' uses brand colors / native Color variants */
  variant?: 'mono' | 'color'
}

export const ProviderIcon = memo(function ProviderIcon({ providerType, className, variant = 'mono' }: ProviderIconProps) {
  // Image fallback (providers not covered by @lobehub/icons)
  const imgSrc = PROVIDER_IMG_FALLBACKS[providerType]
  if (imgSrc) {
    return <img src={imgSrc} alt={providerType} className={className} style={{ objectFit: 'contain' }} />
  }

  // Serper uses lucide Search icon — no lazy load needed
  if (providerType === 'serper') {
    const brandColor = PROVIDER_BRAND_COLORS.serper
    return <Search className={className} {...(variant === 'color' && brandColor ? { color: brandColor } : {})} />
  }

  const loader = ICON_LOADERS[providerType]
  if (!loader) return <Cpu className={className} />

  // Check cache first (synchronous render if already loaded)
  const cached = iconCache.get(providerType)
  if (cached) {
    return <ResolvedIcon icon={cached} providerType={providerType} variant={variant} className={className} />
  }

  return <LazyIcon providerType={providerType} loader={loader} variant={variant} className={className} />
})

/** Renders an already-resolved icon */
function ResolvedIcon({ icon, providerType, variant, className }: {
  icon: SvgIcon & { Color?: SvgIcon }
  providerType: string
  variant: 'mono' | 'color'
  className?: string
}) {
  if (variant === 'color' && HAS_COLOR_VARIANT.has(providerType) && icon.Color) {
    const Icon = icon.Color
    return <Icon className={className} />
  }
  const brandColor = variant === 'color' ? PROVIDER_BRAND_COLORS[providerType] : undefined
  const Icon = icon
  return <Icon className={className} {...(brandColor ? { color: brandColor } : {})} />
}

/** Lazy-loads an icon on mount, then renders it */
function LazyIcon({ providerType, loader, variant, className }: {
  providerType: string
  loader: () => Promise<{ default: SvgIcon & { Color?: SvgIcon } }>
  variant: 'mono' | 'color'
  className?: string
}) {
  const [icon, setIcon] = useState<(SvgIcon & { Color?: SvgIcon }) | null>(null)

  useEffect(() => {
    let cancelled = false
    loader().then((mod) => {
      iconCache.set(providerType, mod.default)
      if (!cancelled) setIcon(mod.default)
    })
    return () => { cancelled = true }
  }, [providerType, loader])

  if (!icon) {
    // Placeholder with same dimensions to avoid layout shift
    return <Cpu className={className} style={{ opacity: 0.3 }} />
  }

  return <ResolvedIcon icon={icon} providerType={providerType} variant={variant} className={className} />
}
