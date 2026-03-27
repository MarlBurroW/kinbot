/**
 * Built-in tool preview renderers.
 * Each function returns a short string shown inline when a tool call is collapsed,
 * or null to show no preview.
 */
import { registerPreviewRenderer } from '@/client/lib/tool-renderers'

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

// --- Shell / system ---

registerPreviewRenderer('run_shell', ({ args }) => {
  const cmd = args.command as string | undefined
  return cmd ? truncate(cmd, 60) : null
})

registerPreviewRenderer('execute_sql', ({ args }) => {
  return (args.sql as string) ? truncate(args.sql as string, 50) : null
})

// --- File operations ---

registerPreviewRenderer('read_file', ({ args }) => {
  return (args.path as string) || null
})

registerPreviewRenderer('write_file', ({ args }) => {
  return (args.path as string) || null
})

registerPreviewRenderer('edit_file', ({ args }) => {
  return (args.path as string) || null
})

registerPreviewRenderer('multi_edit', ({ args }) => {
  const path = args.path as string
  const count = Array.isArray(args.edits) ? args.edits.length : undefined
  return path ? `${path}${count ? ` (${count} edits)` : ''}` : null
})

registerPreviewRenderer('list_directory', ({ args }) => {
  return (args.path as string) || '.'
})

registerPreviewRenderer('grep', ({ args }) => {
  const pattern = args.pattern as string
  const glob = args.glob as string | undefined
  return pattern ? `"${truncate(pattern, 30)}"${glob ? ` in ${glob}` : ''}` : null
})

// --- Web ---

registerPreviewRenderer('web_search', ({ args }) => {
  return (args.query as string) ? `"${truncate(args.query as string, 50)}"` : null
})

registerPreviewRenderer('browse_url', ({ args }) => {
  const url = args.url as string
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.hostname + parsed.pathname
  } catch {
    return truncate(url, 50)
  }
})

registerPreviewRenderer('http_request', ({ args }) => {
  const method = args.method as string | undefined
  const url = args.url as string | undefined
  if (!url) return null
  try {
    const parsed = new URL(url)
    const short = parsed.hostname + parsed.pathname
    return method ? `${method} ${short}` : short
  } catch {
    return method ? `${method} ${truncate(url, 45)}` : truncate(url, 50)
  }
})

// --- Memory ---

registerPreviewRenderer('memorize', ({ args }) => {
  return (args.content as string) ? truncate(args.content as string, 50) : null
})

registerPreviewRenderer('recall', ({ args }) => {
  return (args.query as string) ? `"${truncate(args.query as string, 40)}"` : null
})

// --- Contacts ---

registerPreviewRenderer('search_contacts', ({ args }) => {
  return (args.query as string) ? `"${truncate(args.query as string, 40)}"` : null
})

// --- Image ---

registerPreviewRenderer('generate_image', ({ args }) => {
  return (args.prompt as string) ? truncate(args.prompt as string, 50) : null
})

// --- Tasks ---

registerPreviewRenderer('spawn_self', ({ args }) => {
  return (args.title as string) || null
})

registerPreviewRenderer('spawn_kin', ({ args }) => {
  return (args.title as string) || null
})

// --- Screenshot ---

registerPreviewRenderer('screenshot_url', ({ args }) => {
  const url = args.url as string
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.hostname + parsed.pathname
  } catch {
    return truncate(url, 50)
  }
})

// --- Knowledge ---

registerPreviewRenderer('search_knowledge', ({ args }) => {
  return (args.query as string) ? `"${truncate(args.query as string, 40)}"` : null
})

// --- Notify ---

registerPreviewRenderer('notify', ({ args }) => {
  return (args.title as string) ? truncate(args.title as string, 50) : null
})

// --- Send message ---

registerPreviewRenderer('send_message', ({ args }) => {
  const slug = args.slug as string | undefined
  return slug || null
})

// --- Store file ---

registerPreviewRenderer('store_file', ({ args }) => {
  return (args.name as string) || null
})

// --- History ---

registerPreviewRenderer('search_history', ({ args }) => {
  return (args.query as string) ? `"${truncate(args.query as string, 40)}"` : null
})

registerPreviewRenderer('browse_history', ({ args }) => {
  const start = args.startDate as string | undefined
  const end = args.endDate as string | undefined
  return start && end ? `${start} → ${end}` : null
})

// --- Links ---

registerPreviewRenderer('extract_links', ({ args }) => {
  const url = args.url as string
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.hostname + parsed.pathname
  } catch {
    return truncate(url, 50)
  }
})

// --- Webhooks ---

registerPreviewRenderer('create_webhook', ({ args }) => {
  return (args.name as string) ? truncate(args.name as string, 50) : null
})
