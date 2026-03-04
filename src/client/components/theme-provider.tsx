import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'
import type { PaletteId } from '@/shared/types'

const STORAGE_KEY = 'kinbot-palette'
const CONTRAST_STORAGE_KEY = 'kinbot-contrast'
const DEFAULT_PALETTE: PaletteId = 'aurora'

export type ContrastMode = 'normal' | 'soft'

export interface PaletteInfo {
  id: PaletteId
  name: string
  description: string
  colors: [string, string, string] // glow-1, glow-2, glow-3 preview
}

export const PALETTES: PaletteInfo[] = [
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Purple \u2192 Pink \u2192 Peach',
    colors: ['oklch(0.52 0.24 300)', 'oklch(0.62 0.26 340)', 'oklch(0.72 0.16 15)'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Blue \u2192 Teal \u2192 Cyan',
    colors: ['oklch(0.50 0.18 240)', 'oklch(0.55 0.16 195)', 'oklch(0.60 0.14 180)'],
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Emerald \u2192 Lime \u2192 Gold',
    colors: ['oklch(0.52 0.18 155)', 'oklch(0.58 0.16 130)', 'oklch(0.68 0.14 85)'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Crimson \u2192 Orange \u2192 Amber',
    colors: ['oklch(0.55 0.22 25)', 'oklch(0.65 0.20 50)', 'oklch(0.75 0.16 75)'],
  },
  {
    id: 'monochrome',
    name: 'Mono',
    description: 'Neutral elegance',
    colors: ['oklch(0.35 0 0)', 'oklch(0.55 0 0)', 'oklch(0.75 0 0)'],
  },
  {
    id: 'sakura',
    name: 'Sakura',
    description: 'Rose \u2192 Blush \u2192 Petal',
    colors: ['oklch(0.62 0.20 350)', 'oklch(0.72 0.14 10)', 'oklch(0.82 0.08 30)'],
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Cyan \u2192 Magenta \u2192 Yellow',
    colors: ['oklch(0.70 0.20 195)', 'oklch(0.60 0.26 320)', 'oklch(0.85 0.18 95)'],
  },
  {
    id: 'lavender',
    name: 'Lavender',
    description: 'Violet \u2192 Periwinkle \u2192 Mauve',
    colors: ['oklch(0.55 0.18 280)', 'oklch(0.62 0.14 265)', 'oklch(0.72 0.10 310)'],
  },
]

interface PaletteContextValue {
  palette: PaletteId
  setPalette: (p: PaletteId) => void
  palettes: PaletteInfo[]
  contrastMode: ContrastMode
  setContrastMode: (mode: ContrastMode) => void
}

const PaletteContext = createContext<PaletteContextValue>({
  palette: DEFAULT_PALETTE,
  setPalette: () => {},
  palettes: PALETTES,
  contrastMode: 'normal',
  setContrastMode: () => {},
})

export function usePalette() {
  return useContext(PaletteContext)
}

export { useTheme }

function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = useState<PaletteId>(() => {
    if (typeof window === 'undefined') return DEFAULT_PALETTE
    const stored = localStorage.getItem(STORAGE_KEY) as PaletteId | null
    return stored && PALETTES.some(p => p.id === stored) ? stored : DEFAULT_PALETTE
  })

  const [contrastMode, setContrastModeState] = useState<ContrastMode>(() => {
    if (typeof window === 'undefined') return 'normal'
    const stored = localStorage.getItem(CONTRAST_STORAGE_KEY) as ContrastMode | null
    return stored === 'soft' ? 'soft' : 'normal'
  })

  const setPalette = useCallback((p: PaletteId) => {
    setPaletteState(p)
    localStorage.setItem(STORAGE_KEY, p)
    // Apply to <html> immediately
    const html = document.documentElement
    if (p === DEFAULT_PALETTE) {
      html.removeAttribute('data-palette')
    } else {
      html.setAttribute('data-palette', p)
    }
  }, [])

  const setContrastMode = useCallback((mode: ContrastMode) => {
    setContrastModeState(mode)
    localStorage.setItem(CONTRAST_STORAGE_KEY, mode)
    const html = document.documentElement
    if (mode === 'soft') {
      html.setAttribute('data-contrast', 'soft')
    } else {
      html.removeAttribute('data-contrast')
    }
  }, [])

  // Sync attributes on mount
  useEffect(() => {
    if (palette !== DEFAULT_PALETTE) {
      document.documentElement.setAttribute('data-palette', palette)
    }
    if (contrastMode === 'soft') {
      document.documentElement.setAttribute('data-contrast', 'soft')
    }
  }, [palette, contrastMode])

  return (
    <PaletteContext.Provider value={{ palette, setPalette, palettes: PALETTES, contrastMode, setContrastMode }}>
      {children}
    </PaletteContext.Provider>
  )
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <PaletteProvider>{children}</PaletteProvider>
    </NextThemesProvider>
  )
}
