/**
 * In-memory ring buffer for mini-app console entries.
 * Console messages are forwarded from the iframe SDK → parent → server via POST.
 * Kins can retrieve them via the get_mini_app_console tool.
 */

export interface ConsoleEntry {
  level: 'log' | 'warn' | 'error'
  args: string[]
  stack: string | null
  timestamp: number
}

const BUFFER_MAX = 50
const buffers = new Map<string, ConsoleEntry[]>()

export function pushConsoleEntry(appId: string, entry: ConsoleEntry): void {
  let buf = buffers.get(appId)
  if (!buf) {
    buf = []
    buffers.set(appId, buf)
  }
  buf.push(entry)
  if (buf.length > BUFFER_MAX) buf.shift()
}

export function getConsoleEntries(appId: string, level?: string): ConsoleEntry[] {
  const buf = buffers.get(appId) ?? []
  if (level) return buf.filter((e) => e.level === level)
  return [...buf]
}

export function clearConsoleEntries(appId: string): void {
  buffers.delete(appId)
}
