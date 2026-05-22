import { useMemo } from 'react'
import { useProviders } from '@/client/hooks/useProviders'

/**
 * Reactive lookup: 'is there at least one valid provider for this
 * capability family right now?'.
 *
 * Used by the various capability-aware UI banners (tool rows in
 * KinToolsTab that grey out when their family is unconfigured, the
 * embedding-missing notice in MemoryList, the no-image-provider
 * notice in AvatarPickerModal, etc.). Sits on top of useProviders so
 * it inherits the SSE-driven refresh — newly-added providers light
 * up the corresponding UI without a reload.
 */
export function useHasCapability(family: 'llm' | 'embedding' | 'image' | 'search' | 'tts' | 'stt'): boolean {
  const { allProviders } = useProviders()
  return useMemo(
    () => allProviders.some((p) => p.isValid && p.capabilities.includes(family)),
    [allProviders, family],
  )
}
