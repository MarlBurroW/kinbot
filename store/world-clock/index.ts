import { tool } from 'ai'
import { z } from 'zod'

/**
 * World Clock plugin for KinBot.
 * Check current time in any timezone, convert between zones, and browse world clocks.
 * Uses the built-in Intl API (no external dependencies).
 */

// ─── Common timezone aliases ────────────────────────────────────────────────

const TIMEZONE_ALIASES: Record<string, string> = {
  // Cities
  'paris': 'Europe/Paris',
  'london': 'Europe/London',
  'new york': 'America/New_York',
  'nyc': 'America/New_York',
  'los angeles': 'America/Los_Angeles',
  'la': 'America/Los_Angeles',
  'chicago': 'America/Chicago',
  'denver': 'America/Denver',
  'tokyo': 'Asia/Tokyo',
  'beijing': 'Asia/Shanghai',
  'shanghai': 'Asia/Shanghai',
  'hong kong': 'Asia/Hong_Kong',
  'singapore': 'Asia/Singapore',
  'sydney': 'Australia/Sydney',
  'melbourne': 'Australia/Melbourne',
  'dubai': 'Asia/Dubai',
  'mumbai': 'Asia/Kolkata',
  'delhi': 'Asia/Kolkata',
  'berlin': 'Europe/Berlin',
  'moscow': 'Europe/Moscow',
  'seoul': 'Asia/Seoul',
  'bangkok': 'Asia/Bangkok',
  'toronto': 'America/Toronto',
  'vancouver': 'America/Vancouver',
  'sao paulo': 'America/Sao_Paulo',
  'cairo': 'Africa/Cairo',
  'istanbul': 'Europe/Istanbul',
  'jakarta': 'Asia/Jakarta',
  'nairobi': 'Africa/Nairobi',
  'honolulu': 'Pacific/Honolulu',
  'anchorage': 'America/Anchorage',
  'auckland': 'Pacific/Auckland',
  // Abbreviations
  'est': 'America/New_York',
  'cst': 'America/Chicago',
  'mst': 'America/Denver',
  'pst': 'America/Los_Angeles',
  'gmt': 'Europe/London',
  'cet': 'Europe/Paris',
  'jst': 'Asia/Tokyo',
  'kst': 'Asia/Seoul',
  'ist': 'Asia/Kolkata',
  'aest': 'Australia/Sydney',
  'nzst': 'Pacific/Auckland',
}

const WORLD_CLOCK_ZONES = [
  { label: 'Honolulu', tz: 'Pacific/Honolulu' },
  { label: 'Los Angeles', tz: 'America/Los_Angeles' },
  { label: 'Denver', tz: 'America/Denver' },
  { label: 'Chicago', tz: 'America/Chicago' },
  { label: 'New York', tz: 'America/New_York' },
  { label: 'São Paulo', tz: 'America/Sao_Paulo' },
  { label: 'London', tz: 'Europe/London' },
  { label: 'Paris', tz: 'Europe/Paris' },
  { label: 'Berlin', tz: 'Europe/Berlin' },
  { label: 'Moscow', tz: 'Europe/Moscow' },
  { label: 'Dubai', tz: 'Asia/Dubai' },
  { label: 'Mumbai', tz: 'Asia/Kolkata' },
  { label: 'Bangkok', tz: 'Asia/Bangkok' },
  { label: 'Shanghai', tz: 'Asia/Shanghai' },
  { label: 'Tokyo', tz: 'Asia/Tokyo' },
  { label: 'Sydney', tz: 'Australia/Sydney' },
  { label: 'Auckland', tz: 'Pacific/Auckland' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function resolveTimezone(input: string): string {
  const lower = input.toLowerCase().trim()
  if (TIMEZONE_ALIASES[lower]) return TIMEZONE_ALIASES[lower]

  // Try as-is (IANA format)
  try {
    Intl.DateTimeFormat(undefined, { timeZone: input })
    return input
  } catch {
    // Try with common prefixes
    for (const prefix of ['America/', 'Europe/', 'Asia/', 'Africa/', 'Pacific/', 'Australia/']) {
      const candidate = prefix + input.charAt(0).toUpperCase() + input.slice(1).replace(/ /g, '_')
      try {
        Intl.DateTimeFormat(undefined, { timeZone: candidate })
        return candidate
      } catch { /* continue */ }
    }
    throw new Error(`Unknown timezone: "${input}". Use IANA format (e.g. Europe/Paris) or a city name (e.g. Tokyo).`)
  }
}

function formatTime(date: Date, timezone: string, use24h: boolean): string {
  return date.toLocaleString('en-US', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: !use24h,
    timeZoneName: 'short',
  })
}

function formatTimeShort(date: Date, timezone: string, use24h: boolean): string {
  return date.toLocaleString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: !use24h,
    timeZoneName: 'short',
  })
}

function getUtcOffset(timezone: string): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  })
  const parts = formatter.formatToParts(now)
  const offsetPart = parts.find(p => p.type === 'timeZoneName')
  return offsetPart?.value ?? 'UTC'
}

// ─── Plugin export ──────────────────────────────────────────────────────────

export default function worldClockPlugin(config: Record<string, unknown>) {
  const homeTz = (config.homeTimezone as string) || 'UTC'
  const use24h = config.use24Hour !== false

  return {
    tools: {
      get_current_time: tool({
        description: 'Get the current date and time in a specific timezone. Accepts city names (e.g. "Tokyo", "New York"), abbreviations (e.g. "PST", "CET"), or IANA timezone IDs (e.g. "Europe/Paris").',
        parameters: z.object({
          timezone: z.string().describe('Timezone: city name, abbreviation, or IANA ID'),
        }),
        execute: async ({ timezone }) => {
          try {
            const tz = resolveTimezone(timezone)
            const now = new Date()
            return {
              timezone: tz,
              offset: getUtcOffset(tz),
              datetime: formatTime(now, tz, use24h),
              iso: now.toLocaleString('sv-SE', { timeZone: tz }).replace(' ', 'T'),
            }
          } catch (err) {
            return { error: err instanceof Error ? err.message : String(err) }
          }
        },
      }),

      convert_time: tool({
        description: 'Convert a specific time from one timezone to another. Useful for scheduling across timezones.',
        parameters: z.object({
          time: z.string().describe('Time to convert in HH:MM format (24h) or h:MM AM/PM'),
          from: z.string().describe('Source timezone'),
          to: z.string().describe('Target timezone'),
          date: z.string().optional().describe('Date in YYYY-MM-DD format (defaults to today)'),
        }),
        execute: async ({ time, from, to, date: dateStr }) => {
          try {
            const fromTz = resolveTimezone(from)
            const toTz = resolveTimezone(to)

            // Parse the input time
            const today = dateStr || new Date().toISOString().slice(0, 10)
            let hours: number
            let minutes: number

            const ampmMatch = time.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i)
            if (ampmMatch) {
              hours = parseInt(ampmMatch[1], 10)
              minutes = parseInt(ampmMatch[2], 10)
              if (ampmMatch[3].toLowerCase() === 'pm' && hours !== 12) hours += 12
              if (ampmMatch[3].toLowerCase() === 'am' && hours === 12) hours = 0
            } else {
              const match24 = time.match(/^(\d{1,2}):(\d{2})$/)
              if (!match24) {
                return { error: 'Invalid time format. Use HH:MM (24h) or h:MM AM/PM.' }
              }
              hours = parseInt(match24[1], 10)
              minutes = parseInt(match24[2], 10)
            }

            if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
              return { error: 'Invalid time values.' }
            }

            // Build a date in the source timezone by finding the UTC equivalent
            // Use a reference date and adjust
            const refDate = new Date(`${today}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)

            // Get the offset difference by formatting
            const fromFormatted = formatTime(refDate, fromTz, use24h)
            const toFormatted = formatTime(refDate, toTz, use24h)

            return {
              from: { timezone: fromTz, time: fromFormatted },
              to: { timezone: toTz, time: toFormatted },
              note: 'Conversion uses the same UTC instant. For exact scheduling, consider DST transitions.',
            }
          } catch (err) {
            return { error: err instanceof Error ? err.message : String(err) }
          }
        },
      }),

      world_clocks: tool({
        description: 'Show the current time across major world cities. Great for a quick overview of global times.',
        parameters: z.object({
          includeHome: z.boolean().optional().describe('Include the configured home timezone at the top (default: true)'),
        }),
        execute: async ({ includeHome }) => {
          try {
            const now = new Date()
            const clocks: Array<{ city: string; time: string; offset: string }> = []

            if (includeHome !== false) {
              clocks.push({
                city: `🏠 Home (${homeTz})`,
                time: formatTimeShort(now, homeTz, use24h),
                offset: getUtcOffset(homeTz),
              })
            }

            for (const { label, tz } of WORLD_CLOCK_ZONES) {
              clocks.push({
                city: label,
                time: formatTimeShort(now, tz, use24h),
                offset: getUtcOffset(tz),
              })
            }

            return { clocks }
          } catch (err) {
            return { error: err instanceof Error ? err.message : String(err) }
          }
        },
      }),

      timezone_difference: tool({
        description: 'Calculate the time difference between two timezones.',
        parameters: z.object({
          zone1: z.string().describe('First timezone'),
          zone2: z.string().describe('Second timezone'),
        }),
        execute: async ({ zone1, zone2 }) => {
          try {
            const tz1 = resolveTimezone(zone1)
            const tz2 = resolveTimezone(zone2)
            const now = new Date()

            // Calculate offset difference using formatted output
            const getOffsetMinutes = (tz: string): number => {
              const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                timeZoneName: 'longOffset',
              })
              const parts = formatter.formatToParts(now)
              const offsetStr = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT'
              const match = offsetStr.match(/GMT([+-])(\d{2}):(\d{2})/)
              if (!match) return 0
              const sign = match[1] === '+' ? 1 : -1
              return sign * (parseInt(match[2], 10) * 60 + parseInt(match[3], 10))
            }

            const offset1 = getOffsetMinutes(tz1)
            const offset2 = getOffsetMinutes(tz2)
            const diffMinutes = offset2 - offset1
            const diffHours = diffMinutes / 60

            const diffStr = diffHours >= 0 ? `+${diffHours}` : `${diffHours}`
            const absHours = Math.abs(Math.floor(diffMinutes / 60))
            const absMinutes = Math.abs(diffMinutes % 60)
            const readable = absMinutes > 0
              ? `${absHours}h ${absMinutes}m`
              : `${absHours}h`

            return {
              zone1: { timezone: tz1, currentTime: formatTimeShort(now, tz1, use24h), offset: getUtcOffset(tz1) },
              zone2: { timezone: tz2, currentTime: formatTimeShort(now, tz2, use24h), offset: getUtcOffset(tz2) },
              difference: `${diffStr}h`,
              readable: `${tz2.split('/').pop()?.replace(/_/g, ' ')} is ${readable} ${diffMinutes >= 0 ? 'ahead of' : 'behind'} ${tz1.split('/').pop()?.replace(/_/g, ' ')}`,
            }
          } catch (err) {
            return { error: err instanceof Error ? err.message : String(err) }
          }
        },
      }),
    },
  }
}
