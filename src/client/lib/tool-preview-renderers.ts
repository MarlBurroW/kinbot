/**
 * Built-in tool preview renderers.
 * Each function returns a short string shown inline when a tool call is collapsed,
 * or null to show no preview.
 */
import { registerPreviewRenderer } from '@/client/lib/tool-registry'

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

// --- Contacts ---

registerPreviewRenderer('create_contact', ({ args }) => {
  const name = args.name as string | undefined
  const type = args.type as string | undefined
  return name ? `${name}${type ? ` (${type})` : ''}` : null
})

// --- Crons ---

registerPreviewRenderer('create_cron', ({ args }) => {
  const name = args.name as string | undefined
  const schedule = args.schedule as string | undefined
  return name ? `${truncate(name, 35)}${schedule ? ` — ${schedule}` : ''}` : null
})

// --- Wakeups ---

registerPreviewRenderer('wake_me_in', ({ args }) => {
  const seconds = args.seconds as number | undefined
  if (!seconds) return null
  if (seconds >= 3600) return `${Math.round(seconds / 3600)}h`
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`
  return `${seconds}s`
})

// --- Mini apps ---

registerPreviewRenderer('write_mini_app_file', ({ args }) => {
  return (args.path as string) || null
})

registerPreviewRenderer('create_mini_app', ({ args }) => {
  const name = args.name as string | undefined
  const slug = args.slug as string | undefined
  return name ? `${truncate(name, 40)}${slug ? ` (${slug})` : ''}` : null
})

// --- Plugins ---

registerPreviewRenderer('install_plugin', ({ args }) => {
  const name = args.name as string | undefined
  const source = args.source as string | undefined
  return name ? `${source ? `${source}: ` : ''}${truncate(name, 45)}` : null
})

// --- Channels ---

registerPreviewRenderer('send_channel_message', ({ args }) => {
  const message = args.message as string | undefined
  return message ? truncate(message, 50) : null
})

// --- Vault ---

registerPreviewRenderer('create_secret', ({ args }) => {
  return (args.key as string) || null
})

// --- Vault entries ---

registerPreviewRenderer('create_vault_entry', ({ args }) => {
  const key = args.key as string | undefined
  const entryType = args.entry_type as string | undefined
  return key ? `${truncate(key, 40)}${entryType ? ` (${entryType})` : ''}` : null
})

// --- Contact notes ---

registerPreviewRenderer('set_contact_note', ({ args }) => {
  const scope = args.scope as string | undefined
  const content = args.content as string | undefined
  return content ? `${scope ? `${scope}: ` : ''}${truncate(content, 45)}` : null
})

// --- Custom tools ---

registerPreviewRenderer('run_custom_tool', ({ args }) => {
  return (args.tool_name as string) ? truncate(args.tool_name as string, 50) : null
})

// --- Plugin config ---

registerPreviewRenderer('configure_plugin', ({ args }) => {
  return (args.name as string) ? truncate(args.name as string, 50) : null
})

// --- Plugin details ---

registerPreviewRenderer('get_plugin_details', ({ args }) => {
  return (args.name as string) ? truncate(args.name as string, 50) : null
})

// --- Mini app rollback ---

registerPreviewRenderer('rollback_mini_app', ({ args }) => {
  const appId = args.app_id as string | undefined
  const version = args.version as number | undefined
  return appId ? `${truncate(appId, 40)}${version != null ? ` → v${version}` : ''}` : null
})

// --- Human prompt ---

registerPreviewRenderer('prompt_human', ({ args }) => {
  return (args.question as string) ? truncate(args.question as string, 50) : null
})

// --- Invitations ---

registerPreviewRenderer('create_invitation', ({ args }) => {
  const label = args.label as string | undefined
  return label ? `for ${truncate(label, 50)}` : null
})

// --- Webhook updates ---

registerPreviewRenderer('update_webhook', ({ args }) => {
  const name = args.name as string | undefined
  const id = args.webhook_id as string | undefined
  return name ? truncate(name, 50) : id ? truncate(id, 50) : null
})

// --- Kin creation ---

registerPreviewRenderer('create_kin', ({ args }) => {
  return (args.name as string) ? truncate(args.name as string, 50) : null
})

// --- Contact updates ---

registerPreviewRenderer('update_contact', ({ args }) => {
  const name = args.name as string | undefined
  const id = args.contact_id as string | undefined
  return name ? truncate(name, 50) : id ? truncate(id, 50) : null
})

// --- Secret search ---

registerPreviewRenderer('search_secrets', ({ args }) => {
  return (args.query as string) ? truncate(args.query as string, 50) : null
})

// --- Recurring wakeups ---

registerPreviewRenderer('wake_me_every', ({ args }) => {
  const interval = args.interval_seconds as number | undefined
  if (!interval) return null
  const label = interval >= 3600 ? `${Math.round(interval / 3600)}h` : interval >= 60 ? `${Math.round(interval / 60)}m` : `${interval}s`
  const reason = args.reason as string | undefined
  return reason ? `every ${label} — ${truncate(reason, 35)}` : `every ${label}`
})

// --- Cron updates ---

registerPreviewRenderer('update_cron', ({ args }) => {
  const name = args.name as string | undefined
  const id = args.cron_id as string | undefined
  return name ? truncate(name, 50) : id ? truncate(id, 50) : null
})

// --- MCP servers ---

registerPreviewRenderer('add_mcp_server', ({ args }) => {
  const name = args.name as string | undefined
  const command = args.command as string | undefined
  return name ? `${truncate(name, 35)}${command ? ` (${truncate(command, 15)})` : ''}` : null
})

// --- Contact lookup ---

registerPreviewRenderer('find_contact_by_identifier', ({ args }) => {
  const label = args.label as string | undefined
  const value = args.value as string | undefined
  return label && value ? `${label}: ${truncate(value, 45)}` : null
})
