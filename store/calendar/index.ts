import { tool } from 'ai'
import { z } from 'zod'

/**
 * Calendar plugin for KinBot.
 * Manage events and reminders with scheduling, recurrence, and search.
 */

interface CalendarEvent {
  id: string
  title: string
  description: string
  startTime: number // unix ms
  endTime: number | null // unix ms, null for all-day/point events
  allDay: boolean
  location: string
  tags: string[]
  reminderMinutes: number | null
  recurrence: string | null // 'daily' | 'weekly' | 'monthly' | 'yearly' | null
  createdAt: number
  updatedAt: number
}

interface CalendarState {
  events: Map<string, CalendarEvent>
  nextId: number
}

const states = new Map<string, CalendarState>()

function getState(id: string): CalendarState {
  if (!states.has(id)) {
    states.set(id, { events: new Map(), nextId: 1 })
  }
  return states.get(id)!
}

function generateId(state: CalendarState): string {
  return `evt-${state.nextId++}`
}

function parseTime(input: string): number {
  const ms = Date.parse(input)
  if (isNaN(ms)) throw new Error(`Invalid date/time: ${input}`)
  return ms
}

function formatEvent(e: CalendarEvent): object {
  return {
    id: e.id,
    title: e.title,
    description: e.description || undefined,
    start: new Date(e.startTime).toISOString(),
    end: e.endTime ? new Date(e.endTime).toISOString() : undefined,
    allDay: e.allDay,
    location: e.location || undefined,
    tags: e.tags.length > 0 ? e.tags : undefined,
    reminder: e.reminderMinutes != null ? `${e.reminderMinutes}min before` : undefined,
    recurrence: e.recurrence || undefined,
  }
}

function getEventsInRange(
  state: CalendarState,
  startMs: number,
  endMs: number,
): CalendarEvent[] {
  return Array.from(state.events.values())
    .filter((e) => {
      const eEnd = e.endTime ?? e.startTime
      return e.startTime < endMs && eEnd >= startMs
    })
    .sort((a, b) => a.startTime - b.startTime)
}

function enforceMaxEvents(state: CalendarState, max: number): void {
  if (state.events.size <= max) return
  const sorted = Array.from(state.events.values()).sort(
    (a, b) => a.createdAt - b.createdAt,
  )
  while (state.events.size > max) {
    const oldest = sorted.shift()
    if (oldest) state.events.delete(oldest.id)
  }
}

export default function calendarPlugin(ctx: {
  config: Record<string, any>
  log?: { info: (...args: any[]) => void }
  manifest?: { name: string }
  [key: string]: any
}) {
  const maxEvents = parseInt(ctx.config.maxEvents || '500', 10)
  const defaultReminder = parseInt(ctx.config.defaultReminderMinutes || '15', 10)
  const stateId = ctx.manifest?.name || ctx.pluginId || 'calendar'
  const state = getState(stateId)

  return {
    tools: {
      create_event: tool({
        description:
          'Create a calendar event. Provide a title and start time. Optionally add end time, location, tags, reminder, and recurrence.',
        parameters: z.object({
          title: z.string().describe('Event title'),
          start: z
            .string()
            .describe('Start date/time in ISO 8601 format (e.g. "2025-03-15T14:00:00")'),
          end: z
            .string()
            .optional()
            .describe('End date/time in ISO 8601 format'),
          allDay: z
            .boolean()
            .optional()
            .describe('Whether this is an all-day event (default: false)'),
          description: z.string().optional().describe('Event description'),
          location: z.string().optional().describe('Event location'),
          tags: z
            .array(z.string())
            .optional()
            .describe('Tags for categorization'),
          reminderMinutes: z
            .number()
            .optional()
            .describe(
              'Minutes before event to trigger reminder (null to disable)',
            ),
          recurrence: z
            .enum(['daily', 'weekly', 'monthly', 'yearly'])
            .optional()
            .describe('Recurrence pattern'),
        }),
        execute: async (params) => {
          const now = Date.now()
          const startTime = parseTime(params.start)
          const endTime = params.end ? parseTime(params.end) : null

          if (endTime && endTime <= startTime) {
            return { error: 'End time must be after start time' }
          }

          const id = generateId(state)
          const event: CalendarEvent = {
            id,
            title: params.title,
            description: params.description || '',
            startTime,
            endTime,
            allDay: params.allDay ?? false,
            location: params.location || '',
            tags: params.tags || [],
            reminderMinutes:
              params.reminderMinutes !== undefined
                ? params.reminderMinutes
                : defaultReminder,
            recurrence: params.recurrence || null,
            createdAt: now,
            updatedAt: now,
          }

          state.events.set(id, event)
          enforceMaxEvents(state, maxEvents)

          return {
            created: formatEvent(event),
            total: state.events.size,
          }
        },
      }),

      list_events: tool({
        description:
          'List calendar events within a date range. Defaults to today if no range specified.',
        parameters: z.object({
          from: z
            .string()
            .optional()
            .describe(
              'Start of range in ISO 8601 (default: start of today UTC)',
            ),
          to: z
            .string()
            .optional()
            .describe(
              'End of range in ISO 8601 (default: end of today UTC)',
            ),
          tag: z.string().optional().describe('Filter by tag'),
          limit: z
            .number()
            .optional()
            .describe('Max events to return (default: 20)'),
        }),
        execute: async (params) => {
          const now = new Date()
          const todayStart = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          ).getTime()
          const todayEnd = todayStart + 86400000

          const fromMs = params.from ? parseTime(params.from) : todayStart
          const toMs = params.to ? parseTime(params.to) : todayEnd
          const limit = params.limit ?? 20

          let events = getEventsInRange(state, fromMs, toMs)
          if (params.tag) {
            const tag = params.tag.toLowerCase()
            events = events.filter((e) =>
              e.tags.some((t) => t.toLowerCase() === tag),
            )
          }

          return {
            events: events.slice(0, limit).map(formatEvent),
            total: events.length,
            range: {
              from: new Date(fromMs).toISOString(),
              to: new Date(toMs).toISOString(),
            },
          }
        },
      }),

      get_event: tool({
        description: 'Get details of a specific calendar event by ID.',
        parameters: z.object({
          id: z.string().describe('Event ID'),
        }),
        execute: async ({ id }) => {
          const event = state.events.get(id)
          if (!event) return { error: `Event ${id} not found` }
          return { event: formatEvent(event) }
        },
      }),

      update_event: tool({
        description: 'Update an existing calendar event.',
        parameters: z.object({
          id: z.string().describe('Event ID to update'),
          title: z.string().optional(),
          start: z.string().optional(),
          end: z.string().optional(),
          description: z.string().optional(),
          location: z.string().optional(),
          tags: z.array(z.string()).optional(),
          allDay: z.boolean().optional(),
          reminderMinutes: z.number().optional(),
          recurrence: z
            .enum(['daily', 'weekly', 'monthly', 'yearly'])
            .nullable()
            .optional(),
        }),
        execute: async (params) => {
          const event = state.events.get(params.id)
          if (!event) return { error: `Event ${params.id} not found` }

          if (params.title !== undefined) event.title = params.title
          if (params.start !== undefined) event.startTime = parseTime(params.start)
          if (params.end !== undefined) event.endTime = parseTime(params.end)
          if (params.description !== undefined) event.description = params.description
          if (params.location !== undefined) event.location = params.location
          if (params.tags !== undefined) event.tags = params.tags
          if (params.allDay !== undefined) event.allDay = params.allDay
          if (params.reminderMinutes !== undefined)
            event.reminderMinutes = params.reminderMinutes
          if (params.recurrence !== undefined) event.recurrence = params.recurrence
          event.updatedAt = Date.now()

          return { updated: formatEvent(event) }
        },
      }),

      delete_event: tool({
        description: 'Delete a calendar event by ID.',
        parameters: z.object({
          id: z.string().describe('Event ID to delete'),
        }),
        execute: async ({ id }) => {
          const event = state.events.get(id)
          if (!event) return { error: `Event ${id} not found` }
          state.events.delete(id)
          return {
            deleted: formatEvent(event),
            remaining: state.events.size,
          }
        },
      }),

      upcoming_events: tool({
        description:
          'Get upcoming events from now. Useful for "what do I have next?" queries.',
        parameters: z.object({
          hours: z
            .number()
            .optional()
            .describe('Look-ahead window in hours (default: 24)'),
          limit: z
            .number()
            .optional()
            .describe('Max events to return (default: 10)'),
        }),
        execute: async (params) => {
          const now = Date.now()
          const windowMs = (params.hours ?? 24) * 3600000
          const events = getEventsInRange(state, now, now + windowMs)
          const limit = params.limit ?? 10

          return {
            events: events.slice(0, limit).map(formatEvent),
            total: events.length,
            window: `Next ${params.hours ?? 24} hours`,
          }
        },
      }),

      search_events: tool({
        description:
          'Search calendar events by keyword across title, description, location, and tags.',
        parameters: z.object({
          query: z.string().describe('Search query'),
          limit: z
            .number()
            .optional()
            .describe('Max results (default: 10)'),
        }),
        execute: async ({ query, limit }) => {
          const q = query.toLowerCase()
          const max = limit ?? 10
          const matches = Array.from(state.events.values())
            .filter(
              (e) =>
                e.title.toLowerCase().includes(q) ||
                e.description.toLowerCase().includes(q) ||
                e.location.toLowerCase().includes(q) ||
                e.tags.some((t) => t.toLowerCase().includes(q)),
            )
            .sort((a, b) => a.startTime - b.startTime)
            .slice(0, max)

          return {
            results: matches.map(formatEvent),
            total: matches.length,
          }
        },
      }),
    },
  }
}
