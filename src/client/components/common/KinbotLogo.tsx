import { useId } from 'react'

export interface KinbotLogoProps extends Omit<React.SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Pixel size (width = height). Default 32. */
  size?: number | string
  /**
   * 'gradient' (default) paints the head with the active palette's aurora gradient,
   * so the logo automatically follows the current theme. 'mono' renders a flat
   * silhouette in `currentColor` (eyes knocked out), for single-color contexts.
   */
  variant?: 'gradient' | 'mono'
  /** Accessible title. Pass null to mark the SVG decorative (aria-hidden). */
  title?: string | null
}

/**
 * KinBot logomark — a friendly Kin head.
 *
 * Theme-aware: in `gradient` mode the head is filled with the palette gradient
 * tokens (`--color-gradient-start` / `--color-gradient-mid` / `--color-gradient-end`),
 * which are redefined per palette in globals.css — so the logo recolors with the
 * theme out of the box. Hardcoded aurora values are used as a fallback.
 */
export function KinbotLogo({
  size = 32,
  variant = 'gradient',
  title = 'KinBot',
  ...props
}: KinbotLogoProps) {
  const uid = useId()
  const gradId = `kinbot-grad-${uid}`
  const maskId = `kinbot-mask-${uid}`
  const a11y =
    title == null
      ? { 'aria-hidden': true as const }
      : { role: 'img' as const, 'aria-label': title }

  const headFill = variant === 'mono' ? 'currentColor' : `url(#${gradId})`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...a11y}
      {...props}
    >
      {variant === 'gradient' && (
        <defs>
          <linearGradient id={gradId} x1="7" y1="6" x2="41" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--color-gradient-start, #7C4DFF)" />
            <stop offset="0.52" stopColor="var(--color-gradient-mid, #E158C8)" />
            <stop offset="1" stopColor="var(--color-gradient-end, #FF9E6D)" />
          </linearGradient>
        </defs>
      )}

      {variant === 'mono' ? (
        <>
          {/* silhouette with knocked-out eyes — works on any background */}
          <mask id={maskId}>
            <rect x="0" y="0" width="48" height="48" fill="#fff" />
            <circle cx="19.4" cy="26.4" r="3.2" fill="#000" />
            <circle cx="28.6" cy="26.4" r="3.2" fill="#000" />
          </mask>
          <g fill="currentColor" mask={`url(#${maskId})`}>
            <circle cx="24" cy="4.4" r="2.7" />
            <rect x="22.6" y="6.4" width="2.8" height="5.4" rx="1.4" />
            <rect x="5" y="10" width="38" height="33" rx="12" />
          </g>
        </>
      ) : (
        <>
          {/* antenna */}
          <circle cx="24" cy="4.4" r="2.7" fill={headFill} />
          <rect x="22.6" y="6.4" width="2.8" height="5.4" rx="1.4" fill={headFill} />
          {/* head */}
          <rect x="5" y="10" width="38" height="33" rx="12" fill={headFill} />
          {/* face screen */}
          <rect x="11" y="16.5" width="26" height="20" rx="8" fill="#160E2B" />
          {/* eyes */}
          <circle cx="19.4" cy="26.4" r="3.2" fill="#FDFCFF" />
          <circle cx="28.6" cy="26.4" r="3.2" fill="#FDFCFF" />
          <circle cx="20.3" cy="27.1" r="1.25" fill="#160E2B" />
          <circle cx="29.5" cy="27.1" r="1.25" fill="#160E2B" />
        </>
      )}
    </svg>
  )
}

export default KinbotLogo
