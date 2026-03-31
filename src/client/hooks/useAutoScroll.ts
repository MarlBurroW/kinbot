import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Provides auto-scroll behavior with a user toggle for scroll containers.
 *
 * - Watches DOM mutations (new messages, streaming tokens) via MutationObserver
 * - Detects when the user scrolls away from the bottom and pauses auto-scroll
 * - Exposes a toggle to manually enable/disable auto-scroll
 * - No localStorage persistence — designed for modals / transient panels
 *
 * @param deps  Extra values that, when changed, should trigger a scroll check
 *              (e.g. isProcessing, pendingPrompts.length)
 */
export function useAutoScroll(deps: unknown[] = []) {
  const [autoScroll, setAutoScroll] = useState(true)
  const autoScrollRef = useRef(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)

  // Keep ref in sync with state
  useEffect(() => {
    autoScrollRef.current = autoScroll
  }, [autoScroll])

  const toggleAutoScroll = useCallback(() => {
    setAutoScroll((prev) => !prev)
  }, [])

  // Detect whether the user is near the bottom of the scroll container
  const checkNearBottom = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 100
  }, [])

  // Listen for scroll events on the container
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('scroll', checkNearBottom)
    return () => el.removeEventListener('scroll', checkNearBottom)
  }, [checkNearBottom])

  // MutationObserver — auto-scroll when content grows
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let rafId: number | null = null

    const observer = new MutationObserver(() => {
      const nearNow = isNearBottomRef.current
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (!autoScrollRef.current) return
        if (!nearNow) return
        el.scrollTop = el.scrollHeight
        isNearBottomRef.current = true
      })
    })
    observer.observe(el, { childList: true, subtree: true, characterData: true })

    return () => {
      observer.disconnect()
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, []) // stable — reads refs only

  // Fallback scroll for dependency changes that may not mutate DOM
  useEffect(() => {
    if (autoScroll && isNearBottomRef.current) {
      requestAnimationFrame(() => {
        const el = containerRef.current
        if (el) {
          el.scrollTop = el.scrollHeight
          isNearBottomRef.current = true
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { autoScroll, toggleAutoScroll, containerRef, bottomRef }
}
