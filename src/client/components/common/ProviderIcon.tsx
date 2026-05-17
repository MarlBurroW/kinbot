import { type ComponentType, type SVGProps, useState, useEffect, memo } from 'react'
import { Cpu } from 'lucide-react'

type SvgIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

/** Lazy icon loaders — each provider's icons are only fetched when first rendered */
const ICON_LOADERS: Record<string, () => Promise<{ default: SvgIcon & { Color?: SvgIcon } }>> = {
  anthropic: () => import('@lobehub/icons/es/Claude') as any,
  'anthropic-oauth': () => import('@lobehub/icons/es/Claude') as any,
  openai: () => import('@lobehub/icons/es/OpenAI') as any,
  'openai-codex': () => import('@lobehub/icons/es/OpenAI') as any,
}

/** Providers that have a .Color variant */
const HAS_COLOR_VARIANT = new Set([
  'anthropic', 'anthropic-oauth',
])

/** Cache resolved icon modules to avoid re-importing */
const iconCache = new Map<string, SvgIcon & { Color?: SvgIcon }>()

interface ProviderIconProps {
  providerType: string
  className?: string
  /** 'mono' uses currentColor (default), 'color' uses brand colors / native Color variants */
  variant?: 'mono' | 'color'
}

export const ProviderIcon = memo(function ProviderIcon({ providerType, className, variant = 'mono' }: ProviderIconProps) {
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
  const Icon = icon
  return <Icon className={className} />
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
