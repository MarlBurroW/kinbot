import { useState, useEffect, useRef, memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/client/lib/utils'

/**
 * Polished, continuous animation showing how compaction works.
 *
 * The bar mirrors the real ContextBar layout:
 *   [Tools (blue)] [System prompt (purple)] [Summaries (amber/orange)] [Messages (green)]
 *
 * Tools and system prompt are fixed — they never move.
 * Messages grow smoothly until the threshold is crossed, then oldest messages
 * compress into a summary. Summaries accumulate and eventually merge.
 *
 * Driven by a single progress value (0→1) with keyframe interpolation at 60fps.
 */

const THRESHOLD = 75
const CYCLE_MS = 20000

// Fixed context blocks (always present, never animated)
const TOOLS_WIDTH = 7
const PROMPT_WIDTH = 5
const FIXED_WIDTH = TOOLS_WIDTH + PROMPT_WIDTH // 12%

// ─── Gradient styles ────────────────────────────────────────────────────────

const GRADIENTS = {
  tools: 'linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%)',
  prompt: 'linear-gradient(180deg, #a78bfa 0%, #8b5cf6 100%)',
  messages: 'linear-gradient(180deg, #34d399 0%, #10b981 100%)',
  summary: [
    'linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)',  // depth 0
    'linear-gradient(180deg, #fb923c 0%, #f97316 100%)',  // depth 1 (merged)
    'linear-gradient(180deg, #f87171 0%, #ef4444 100%)',  // depth 2+
  ],
} as const

function summaryGradient(depth: number) {
  return GRADIENTS.summary[Math.min(depth, 2)]
}

// ─── Keyframes ──────────────────────────────────────────────────────────────

interface Frame {
  t: number
  slots: number[]   // summary slot widths
  depths: number[]  // summary depths (0=first-level, 1+=merged)
  msg: number       // message zone width
  op: number        // overall opacity
}

// All msg values account for FIXED_WIDTH: total fill = FIXED + summaries + msg
// prettier-ignore
const FRAMES: Frame[] = [
  { t: 0.00, slots: [0,0,0,0], depths: [0,0,0,0], msg:  0, op: 1 }, // empty
  { t: 0.13, slots: [0,0,0,0], depths: [0,0,0,0], msg: 66, op: 1 }, // filled past threshold
  { t: 0.14, slots: [0,0,0,0], depths: [0,0,0,0], msg: 66, op: 1 }, // flash!
  { t: 0.18, slots: [6,0,0,0], depths: [0,0,0,0], msg: 16, op: 1 }, // compact → summary 1
  { t: 0.30, slots: [6,0,0,0], depths: [0,0,0,0], msg: 58, op: 1 }, // fill again
  { t: 0.31, slots: [6,0,0,0], depths: [0,0,0,0], msg: 58, op: 1 }, // flash!
  { t: 0.35, slots: [6,6,0,0], depths: [0,0,0,0], msg: 16, op: 1 }, // compact → summary 2
  { t: 0.46, slots: [6,6,0,0], depths: [0,0,0,0], msg: 52, op: 1 }, // fill
  { t: 0.47, slots: [6,6,0,0], depths: [0,0,0,0], msg: 52, op: 1 }, // flash!
  { t: 0.51, slots: [6,6,6,0], depths: [0,0,0,0], msg: 16, op: 1 }, // compact → summary 3
  { t: 0.56, slots: [6,6,6,0], depths: [0,0,0,0], msg: 16, op: 1 }, // pause before merge
  { t: 0.62, slots: [4,0,6,0], depths: [1,0,0,0], msg: 16, op: 1 }, // merge 1+2 → depth 1
  { t: 0.74, slots: [4,0,6,0], depths: [1,0,0,0], msg: 54, op: 1 }, // fill
  { t: 0.75, slots: [4,0,6,0], depths: [1,0,0,0], msg: 54, op: 1 }, // flash!
  { t: 0.79, slots: [4,0,6,6], depths: [1,0,0,0], msg: 16, op: 1 }, // compact → summary 4
  { t: 0.87, slots: [4,0,6,6], depths: [1,0,0,0], msg: 16, op: 1 }, // hold
  { t: 0.92, slots: [4,0,6,6], depths: [1,0,0,0], msg: 16, op: 0 }, // fade out
  { t: 0.96, slots: [0,0,0,0], depths: [0,0,0,0], msg:  0, op: 0 }, // reset
  { t: 1.00, slots: [0,0,0,0], depths: [0,0,0,0], msg:  0, op: 1 }, // fade in → loop
]

// ─── Interpolation ──────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

interface AnimState {
  slots: number[]
  depths: number[]
  msg: number
  op: number
}

function interpolate(progress: number): AnimState {
  const p = ((progress % 1) + 1) % 1

  let i = 0
  while (i < FRAMES.length - 1 && FRAMES[i + 1].t <= p) i++
  if (i >= FRAMES.length - 1) {
    const f = FRAMES[FRAMES.length - 1]
    return { slots: [...f.slots], depths: [...f.depths], msg: f.msg, op: f.op }
  }

  const from = FRAMES[i]
  const to = FRAMES[i + 1]
  const segT = easeInOut(Math.min(1, Math.max(0, (p - from.t) / (to.t - from.t))))

  return {
    slots: from.slots.map((v, j) => lerp(v, to.slots[j], segT)),
    depths: from.depths.map((d, j) =>
      to.slots[j] < from.slots[j] ? d : to.depths[j],
    ),
    msg: lerp(from.msg, to.msg, segT),
    op: lerp(from.op, to.op, segT),
  }
}

// ─── Display phase ──────────────────────────────────────────────────────────

type DisplayPhase = 'filling' | 'approaching' | 'compacting' | 'merging' | 'done'

function getDisplayPhase(p: number): DisplayPhase {
  const t = ((p % 1) + 1) % 1
  if ((t >= 0.13 && t < 0.18) || (t >= 0.30 && t < 0.35) ||
      (t >= 0.46 && t < 0.51) || (t >= 0.74 && t < 0.79))
    return 'compacting'
  if (t >= 0.56 && t < 0.62) return 'merging'
  if (t >= 0.87) return 'done'
  if (t >= 0.10 && t < 0.13) return 'approaching'
  if (t >= 0.26 && t < 0.30) return 'approaching'
  if (t >= 0.42 && t < 0.46) return 'approaching'
  if (t >= 0.70 && t < 0.74) return 'approaching'
  return 'filling'
}

// ─── Legend swatch colors (flat, for the small squares) ─────────────────────

const SLOT_BG = ['bg-amber-500', 'bg-orange-500', 'bg-rose-500'] as const

// ─── Component ──────────────────────────────────────────────────────────────

export const CompactingAnimation = memo(function CompactingAnimation() {
  const { t } = useTranslation()

  const [anim, setAnim] = useState<AnimState>(() => interpolate(0))
  const [displayPhase, setDisplayPhase] = useState<DisplayPhase>('filling')
  const rafRef = useRef(0)
  const startRef = useRef(0)
  const lastPhaseRef = useRef<DisplayPhase>('filling')

  useEffect(() => {
    let mounted = true
    startRef.current = performance.now()

    const tick = (now: number) => {
      if (!mounted) return
      const progress = (now - startRef.current) / CYCLE_MS
      setAnim(interpolate(progress))

      const phase = getDisplayPhase(progress)
      if (phase !== lastPhaseRef.current) {
        lastPhaseRef.current = phase
        setDisplayPhase(phase)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { mounted = false; cancelAnimationFrame(rafRef.current) }
  }, [])

  const visibleSummaries = anim.slots.filter((w) => w > 0.3).length
  const summariesWidth = anim.slots.reduce((s, w) => s + w, 0)
  const totalFill = FIXED_WIDTH + summariesWidth + anim.msg
  const isOverThreshold = totalFill > THRESHOLD

  const phaseConfig = useMemo(() => ({
    filling: { text: visibleSummaries > 0
      ? t('kin.compacting.animContinuing', { summaries: visibleSummaries })
      : t('kin.compacting.animFilling'),
      color: 'text-muted-foreground' },
    approaching: { text: t('kin.compacting.animApproaching'), color: 'text-warning' },
    compacting: { text: t('kin.compacting.animCompacting'), color: 'text-primary' },
    merging: { text: t('kin.compacting.animMerging'), color: 'text-orange-500' },
    done: { text: t('kin.compacting.animDone'), color: 'text-muted-foreground' },
  }), [t, visibleSummaries])

  const currentPhase = phaseConfig[displayPhase]

  return (
    <div
      className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-4"
      style={{ opacity: anim.op }}
    >
      {/* Bar */}
      <div className="relative pt-5">
        {/* Threshold label */}
        <div
          className={cn(
            'absolute top-0 text-[9px] font-medium transition-colors duration-300',
            isOverThreshold ? 'text-destructive' : 'text-warning',
          )}
          style={{ left: `${THRESHOLD}%`, transform: 'translateX(-50%)' }}
        >
          {t('kin.compacting.animThreshold')} {THRESHOLD}%
        </div>

        <div className="relative h-7 w-full overflow-hidden rounded-full bg-primary/10">
          {/* ── Fixed blocks (tools + system prompt) ── */}
          <div
            className="absolute inset-y-0 left-0"
            style={{ width: `${TOOLS_WIDTH}%`, background: GRADIENTS.tools }}
          />
          <div
            className="absolute inset-y-0"
            style={{ left: `${TOOLS_WIDTH}%`, width: `${PROMPT_WIDTH}%`, background: GRADIENTS.prompt }}
          />

          {/* ── Summary slots with gradients ── */}
          {anim.slots.map((width, i) => {
            if (width < 0.1) return null
            const left = FIXED_WIDTH + anim.slots.slice(0, i).reduce((s, w) => s + w, 0)
            return (
              <div
                key={`s${i}`}
                className="absolute inset-y-0"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  background: summaryGradient(anim.depths[i]),
                  transition: 'background 300ms',
                }}
              >
                {/* Depth indicator: small lines inside merged summaries */}
                {anim.depths[i] > 0 && width > 2 && (
                  <div className="flex h-full items-center justify-center gap-0.5 opacity-30">
                    {Array.from({ length: Math.min(anim.depths[i] + 1, 3) }, (_, k) => (
                      <div key={k} className="h-3.5 w-px rounded-full bg-white" />
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* ── Messages zone ── */}
          {anim.msg > 0.1 && (
            <div
              className="absolute inset-y-0"
              style={{
                left: `${FIXED_WIDTH + summariesWidth}%`,
                width: `${anim.msg}%`,
                background: GRADIENTS.messages,
              }}
            />
          )}

          {/* ── Threshold line ── */}
          <div
            className={cn(
              'absolute inset-y-0 z-10 w-0.5 transition-colors duration-300',
              isOverThreshold ? 'bg-destructive shadow-[0_0_6px_var(--color-destructive)]' : 'bg-warning shadow-[0_0_4px_var(--color-warning)]',
            )}
            style={{ left: `${THRESHOLD}%` }}
          />

        </div>

        {/* Fill percentage indicator */}
        <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground/60">
          <span>0%</span>
          <span className={cn(
            'font-medium tabular-nums transition-colors duration-300',
            isOverThreshold ? 'text-destructive' : 'text-muted-foreground',
          )}>
            {Math.round(totalFill)}%
          </span>
          <span>100%</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: GRADIENTS.tools }} />
          {t('kin.compacting.animTools')}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: GRADIENTS.prompt }} />
          {t('kin.compacting.animPrompt')}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: GRADIENTS.messages }} />
          {t('kin.compacting.animMessages')}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: GRADIENTS.summary[0] }} />
          {t('kin.compacting.animSummary')}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: GRADIENTS.summary[1] }} />
          {t('kin.compacting.animMerged')}
        </span>
      </div>

      {/* Dynamic status */}
      <p className={cn('text-xs leading-relaxed transition-colors duration-300', currentPhase.color)}>
        {currentPhase.text}
      </p>

      {/* Static explanation */}
      <p className="text-[10px] leading-relaxed text-muted-foreground/70">
        {t('kin.compacting.animExplanation')}
      </p>
    </div>
  )
})
