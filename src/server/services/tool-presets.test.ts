import { describe, it, expect } from 'bun:test'
import {
  applyPreset,
  CORE_TOOLS,
  defaultPresetForTask,
  listPresetTools,
  type SubKinPreset,
} from './tool-presets'

function buildSampleToolMap(): Record<string, string> {
  // Stand-in values — the preset filter only cares about keys.
  const names = [
    // Core
    'read_file', 'write_file', 'edit_file', 'multi_edit', 'list_directory', 'grep',
    'run_shell', 'update_task_status', 'request_input', 'report_to_parent',
    'prompt_human', 'notify', 'attach_file', 'think', 'task_todos',
    // Code preset extras
    'get_project', 'list_tickets', 'get_ticket', 'update_ticket', 'web_search', 'browse_url',
    'recall', 'list_memories',
    // Research-only extras
    'memorize', 'search_history', 'screenshot_url',
    // Ops-only extras
    'http_request', 'get_secret',
    // Tools that no preset whitelists
    'create_mini_app', 'execute_sql', 'add_mcp_server', 'create_channel',
  ]
  const map: Record<string, string> = {}
  for (const n of names) map[n] = `tool:${n}`
  return map
}

describe('CORE_TOOLS', () => {
  it('includes the protocol minimum that the runner assumes', () => {
    for (const required of [
      'read_file', 'edit_file', 'multi_edit', 'run_shell', 'grep', 'list_directory',
      'update_task_status', 'request_input', 'prompt_human',
    ]) {
      expect(CORE_TOOLS).toContain(required)
    }
  })
})

describe('applyPreset', () => {
  it('returns the input unchanged when no preset is given', () => {
    const all = buildSampleToolMap()
    expect(applyPreset(all, undefined)).toBe(all)
  })

  it("returns the input unchanged when preset is 'all'", () => {
    const all = buildSampleToolMap()
    expect(applyPreset(all, 'all')).toBe(all)
  })

  it("keeps core tools regardless of the chosen preset", () => {
    const all = buildSampleToolMap()
    for (const preset of ['code', 'research', 'ops'] as const) {
      const filtered = applyPreset(all, preset)
      for (const core of CORE_TOOLS) {
        expect(filtered).toHaveProperty(core)
      }
    }
  })

  it("'code' keeps ticket + project tools and basic web, drops mini-apps / mcp / channels", () => {
    const filtered = applyPreset(buildSampleToolMap(), 'code')
    expect(filtered).toHaveProperty('get_ticket')
    expect(filtered).toHaveProperty('update_ticket')
    expect(filtered).toHaveProperty('web_search')
    expect(filtered).not.toHaveProperty('create_mini_app')
    expect(filtered).not.toHaveProperty('add_mcp_server')
    expect(filtered).not.toHaveProperty('create_channel')
    expect(filtered).not.toHaveProperty('execute_sql')
  })

  it("'research' keeps history + memorize + screenshot, drops project write tools", () => {
    const filtered = applyPreset(buildSampleToolMap(), 'research')
    expect(filtered).toHaveProperty('search_history')
    expect(filtered).toHaveProperty('memorize')
    expect(filtered).toHaveProperty('screenshot_url')
    expect(filtered).not.toHaveProperty('update_ticket')
  })

  it("'ops' keeps secrets + http_request, drops web research toys", () => {
    const filtered = applyPreset(buildSampleToolMap(), 'ops')
    expect(filtered).toHaveProperty('get_secret')
    expect(filtered).toHaveProperty('http_request')
    expect(filtered).not.toHaveProperty('screenshot_url')
    expect(filtered).not.toHaveProperty('update_ticket')
  })

  it("'code' surface is materially smaller than the unfiltered map", () => {
    const all = buildSampleToolMap()
    const filtered = applyPreset(all, 'code')
    expect(Object.keys(filtered).length).toBeLessThan(Object.keys(all).length)
  })

  it('ignores tools that are not present in the input map (no-op)', () => {
    // The preset whitelist references many tools that may not be in the
    // input map (because of Kin tool_config, MCP filtering, etc.). The
    // filter must tolerate that without throwing.
    const partial: Record<string, string> = { read_file: 't', run_shell: 't' }
    const filtered = applyPreset(partial, 'code')
    expect(filtered).toEqual(partial)
  })
})

describe('listPresetTools', () => {
  it("returns just CORE for 'all'", () => {
    expect(listPresetTools('all')).toEqual(CORE_TOOLS)
  })

  it('returns core + extras for named presets', () => {
    for (const preset of ['code', 'research', 'ops'] as SubKinPreset[]) {
      const tools = listPresetTools(preset)
      for (const core of CORE_TOOLS) expect(tools).toContain(core)
      expect(tools.length).toBeGreaterThan(CORE_TOOLS.length)
    }
  })
})

describe('defaultPresetForTask', () => {
  it("picks 'code' on ticket tasks", () => {
    expect(defaultPresetForTask({ ticketId: 'ticket-1', cronId: null })).toBe('code')
  })

  it('returns undefined for non-ticket / non-cron tasks', () => {
    expect(defaultPresetForTask({ ticketId: null, cronId: null })).toBeUndefined()
  })

  it("returns undefined for cron tasks (kept on full surface for now)", () => {
    expect(defaultPresetForTask({ ticketId: null, cronId: 'cron-1' })).toBeUndefined()
  })

  it('ticket wins over cron when both are set', () => {
    expect(defaultPresetForTask({ ticketId: 'ticket-1', cronId: 'cron-1' })).toBe('code')
  })
})
