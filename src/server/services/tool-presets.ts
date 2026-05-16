/**
 * Tool presets for sub-Kin tasks.
 *
 * KinBot registers ~120 native tools. A sub-Kin spawned to "implement
 * feature X" inherits the parent Kin's full toolset by default, which means
 * the model has to scan a long list of irrelevant tools (mini-apps,
 * channels, vaults, kin management, MCP admin, etc.) before picking the one
 * it actually needs. That hurts both first-call latency and the quality of
 * tool selection.
 *
 * A **preset** is a small, named allow-list applied on top of a mandatory
 * **core** floor. The core is always present so the system protocol keeps
 * working (file ops, shell, the sub-Kin reply protocol, human-prompt,
 * notify). MCP tools and Kin-specific custom tools are NOT filtered by the
 * preset — they are per-Kin extensions that the parent already curated.
 */

export type SubKinPreset = 'code' | 'research' | 'ops' | 'all'

interface PresetConfig {
  /** Native tools enabled on top of the core floor when this preset wins. */
  extras: readonly string[]
}

/**
 * Mandatory floor. These tools are present in every sub-Kin toolset
 * regardless of preset, because the system protocol assumes them. Removing
 * any of these would break execution, status reporting, or the human-prompt
 * loop.
 */
export const CORE_TOOLS: readonly string[] = [
  // Filesystem (read + write paths). multi_edit is non-optional for
  // efficient single-file refactors.
  'read_file',
  'write_file',
  'edit_file',
  'multi_edit',
  'list_directory',
  'grep',

  // Shell (with the wrapper-refusal gate already in place).
  'run_shell',

  // Sub-Kin protocol — strictly required by the runner.
  'update_task_status',
  'request_input',
  'report_to_parent',

  // Human in the loop.
  'prompt_human',
  'notify',

  // File attachments (sub-Kins often need to surface screenshots / files
  // back to the user without going through write_file + a separate channel
  // call).
  'attach_file',

  // Reasoning aid (no-op tool that logs a thought). Cheap, no side effects,
  // available to every sub-Kin regardless of preset so it can be leaned on
  // for planning before committing to concrete tool calls.
  'think',

  // Structured planning (TodoWrite-equivalent). Sub-Kins use it to lay out
  // a plan up-front on multi-step work and surface progress to the user.
  'task_todos',
]

const PRESETS: Record<Exclude<SubKinPreset, 'all'>, PresetConfig> = {
  code: {
    extras: [
      // Project & ticket tools — the sub-Kin is acting on a ticket, it needs
      // to read its own ticket, update it, and look around the project.
      'list_projects',
      'get_project',
      'list_project_tags',
      'list_tickets',
      'get_ticket',
      'update_ticket',
      'create_ticket',
      'add_ticket_tag',
      'remove_ticket_tag',
      'set_active_project',

      // Web (docs lookup is a common dependency of code work).
      'web_search',
      'browse_url',
      'extract_links',

      // Memory — read-only access lets the Kin reuse prior decisions,
      // without exposing the full write side that is mostly useful on
      // research tasks.
      'recall',
      'list_memories',
    ],
  },
  research: {
    extras: [
      'web_search',
      'browse_url',
      'extract_links',
      'screenshot_url',
      'search_history',
      'browse_history',
      'list_summaries',
      'read_summary',
      'recall',
      'memorize',
      'update_memory',
      'forget',
      'list_memories',
      'review_memories',
    ],
  },
  ops: {
    extras: [
      'recall',
      'memorize',
      'list_memories',
      'get_secret',
      'search_secrets',
      'redact_message',
      'http_request',
      'get_system_info',
    ],
  },
}

/** Names available in core + a given preset, for inspection / debugging. */
export function listPresetTools(preset: SubKinPreset): readonly string[] {
  if (preset === 'all') return CORE_TOOLS
  return [...CORE_TOOLS, ...PRESETS[preset].extras]
}

/**
 * Filter a native-tool map down to the names allowed by `preset`. When
 * `preset` is undefined or `'all'`, the map is returned unchanged so
 * existing spawn paths keep their full surface (backward-compatible).
 *
 * MCP and custom tools are intentionally not filtered here — callers
 * compose them with the result of this function. Those are per-Kin
 * extensions, not native infrastructure, and the parent has already vetted
 * them.
 */
export function applyPreset<T>(
  nativeTools: Record<string, T>,
  preset: SubKinPreset | undefined,
): Record<string, T> {
  if (!preset || preset === 'all') return nativeTools

  const config = PRESETS[preset]
  const allowed = new Set<string>([...CORE_TOOLS, ...config.extras])
  const filtered: Record<string, T> = {}
  for (const [name, value] of Object.entries(nativeTools)) {
    if (allowed.has(name)) filtered[name] = value
  }
  return filtered
}

/**
 * Auto-pick a preset based on task context. Conservative defaults: only
 * apply a preset when the context strongly suggests one — otherwise return
 * `undefined` so the caller keeps the full surface and we avoid surprising
 * existing workflows.
 */
export function defaultPresetForTask(opts: {
  ticketId: string | null
  cronId: string | null
}): SubKinPreset | undefined {
  if (opts.ticketId) return 'code'
  return undefined
}
