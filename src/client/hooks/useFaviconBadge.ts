import { useEffect, useRef } from 'react'

const BADGE_COLOR = '#ef4444' // red-500
const BADGE_SIZE_RATIO = 0.35 // badge radius relative to icon size
const ICON_SIZE = 64 // canvas resolution

/**
 * Draw a notification badge (colored dot with optional count) on the favicon.
 *
 * When `count` is 0, the original favicon is restored.
 * When `count` > 0, a red dot is overlaid on the bottom-right corner.
 * When `count` > 1, the number is drawn inside the dot.
 */
export function useFaviconBadge(count: number): void {
  const originalHrefRef = useRef<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Capture original favicon href on mount
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (link) {
      originalHrefRef.current = link.href
    }
    return () => {
      // Restore on unmount
      restoreOriginal()
    }
  }, [])

  useEffect(() => {
    if (count <= 0) {
      restoreOriginal()
      return
    }

    const originalHref = originalHrefRef.current
    if (!originalHref) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas')
      }
      const canvas = canvasRef.current
      canvas.width = ICON_SIZE
      canvas.height = ICON_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Draw original favicon
      ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE)
      ctx.drawImage(img, 0, 0, ICON_SIZE, ICON_SIZE)

      // Draw badge circle
      const badgeRadius = ICON_SIZE * BADGE_SIZE_RATIO
      const cx = ICON_SIZE - badgeRadius
      const cy = ICON_SIZE - badgeRadius

      ctx.beginPath()
      ctx.arc(cx, cy, badgeRadius, 0, 2 * Math.PI)
      ctx.fillStyle = BADGE_COLOR
      ctx.fill()

      // White border around badge
      ctx.lineWidth = 2
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()

      // Draw count number if > 1
      if (count > 1) {
        const text = count > 99 ? '99' : String(count)
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${badgeRadius * 1.1}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, cx, cy + 1)
      }

      // Apply to favicon
      const link = getOrCreateFaviconLink()
      link.href = canvas.toDataURL('image/png')
    }
    img.src = originalHref
  }, [count])

  function restoreOriginal() {
    if (originalHrefRef.current) {
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (link) {
        link.href = originalHrefRef.current
      }
    }
  }
}

function getOrCreateFaviconLink(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  return link
}
