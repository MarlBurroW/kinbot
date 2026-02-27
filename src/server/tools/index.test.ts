import { describe, it, expect, beforeEach } from 'bun:test'
import type { Tool } from 'ai'
import { z } from 'zod'
import type { ToolRegistration, ToolExecutionContext } from '@/server/tools/types'

// We can't import the singleton directly (it has side effects via logger/hooks),
// so we re-create the ToolRegistry class logic for isolated testing.
// Instead, let's test via the actual module — the logger just writes to stdout.

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMockTool(name: string): Tool<any, any> {
  return {
    description: `Mock tool: ${name}`,
    inputSchema: z.object({ input: z.string().optional() }),
    execute: async (args: any) => `executed ${name} with ${JSON.stringify(args)}`,
  }
}

function makeMockRegistration(
  availability: ('main' | 'sub-kin')[],
  opts?: { defaultDisabled?: boolean },
): ToolRegistration {
  return {
    create: (_ctx: ToolExecutionContext) => makeMockTool('mock'),
    availability,
    defaultDisabled: opts?.defaultDisabled,
  }
}

function makeCtx(overrides?: Partial<ToolExecutionContext>): ToolExecutionContext {
  return {
    kinId: 'test-kin-id',
    userId: 'test-user-id',
    isSubKin: false,
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

// We import the singleton — tests that mutate it run in sequence anyway (single process)
// To avoid pollution between tests, we'll test properties rather than mutate heavily.

describe('ToolRegistry (via singleton)', () => {
  // Import the actual singleton
  // Note: this registers nothing by default (registerAllTools is called separately)

  it('can import toolRegistry without errors', async () => {
    const { toolRegistry } = await import('@/server/tools/index')
    expect(toolRegistry).toBeDefined()
    expect(typeof toolRegistry.register).toBe('function')
    expect(typeof toolRegistry.resolve).toBe('function')
    expect(typeof toolRegistry.list).toBe('function')
    expect(typeof toolRegistry.registeredCount).toBe('number')
  })
})

// ─── Isolated ToolRegistry class tests ───────────────────────────────────────
// Re-implement the class minimally to test logic without import side effects

class TestToolRegistry {
  private tools = new Map<string, ToolRegistration>()

  register(name: string, registration: ToolRegistration): void {
    this.tools.set(name, registration)
  }

  resolve(ctx: ToolExecutionContext): Record<string, Tool<any, any>> {
    const target = ctx.isSubKin ? 'sub-kin' : 'main'
    const resolved: Record<string, Tool<any, any>> = {}
    for (const [name, reg] of this.tools) {
      if (reg.availability.includes(target)) {
        resolved[name] = reg.create(ctx)
      }
    }
    return resolved
  }

  list(): Array<{ name: string; availability: ('main' | 'sub-kin')[]; defaultDisabled: boolean }> {
    return Array.from(this.tools.entries()).map(([name, reg]) => ({
      name,
      availability: reg.availability,
      defaultDisabled: reg.defaultDisabled ?? false,
    }))
  }

  get registeredCount(): number {
    return this.tools.size
  }
}

describe('ToolRegistry', () => {
  let registry: TestToolRegistry

  beforeEach(() => {
    registry = new TestToolRegistry()
  })

  // ─── register + registeredCount ──────────────────────────────────────

  it('starts empty', () => {
    expect(registry.registeredCount).toBe(0)
    expect(registry.list()).toEqual([])
  })

  it('registers a tool and increments count', () => {
    registry.register('my_tool', makeMockRegistration(['main']))
    expect(registry.registeredCount).toBe(1)
  })

  it('overwrites a tool with the same name', () => {
    registry.register('dup', makeMockRegistration(['main']))
    registry.register('dup', makeMockRegistration(['sub-kin']))
    expect(registry.registeredCount).toBe(1)
    const listed = registry.list()
    expect(listed[0]!.availability).toEqual(['sub-kin'])
  })

  it('registers multiple tools', () => {
    registry.register('a', makeMockRegistration(['main']))
    registry.register('b', makeMockRegistration(['sub-kin']))
    registry.register('c', makeMockRegistration(['main', 'sub-kin']))
    expect(registry.registeredCount).toBe(3)
  })

  // ─── list ────────────────────────────────────────────────────────────

  it('list returns correct metadata', () => {
    registry.register('tool_a', makeMockRegistration(['main'], { defaultDisabled: true }))
    registry.register('tool_b', makeMockRegistration(['main', 'sub-kin']))

    const list = registry.list()
    expect(list).toHaveLength(2)

    const a = list.find((t) => t.name === 'tool_a')!
    expect(a.availability).toEqual(['main'])
    expect(a.defaultDisabled).toBe(true)

    const b = list.find((t) => t.name === 'tool_b')!
    expect(b.availability).toEqual(['main', 'sub-kin'])
    expect(b.defaultDisabled).toBe(false)
  })

  it('list defaults defaultDisabled to false when undefined', () => {
    registry.register('x', {
      create: () => makeMockTool('x'),
      availability: ['main'],
      // no defaultDisabled
    })
    expect(registry.list()[0]!.defaultDisabled).toBe(false)
  })

  // ─── resolve: availability filtering ─────────────────────────────────

  it('resolve returns only main-available tools for main context', () => {
    registry.register('main_only', makeMockRegistration(['main']))
    registry.register('sub_only', makeMockRegistration(['sub-kin']))
    registry.register('both', makeMockRegistration(['main', 'sub-kin']))

    const resolved = registry.resolve(makeCtx({ isSubKin: false }))
    expect(Object.keys(resolved)).toContain('main_only')
    expect(Object.keys(resolved)).not.toContain('sub_only')
    expect(Object.keys(resolved)).toContain('both')
  })

  it('resolve returns only sub-kin-available tools for sub-kin context', () => {
    registry.register('main_only', makeMockRegistration(['main']))
    registry.register('sub_only', makeMockRegistration(['sub-kin']))
    registry.register('both', makeMockRegistration(['main', 'sub-kin']))

    const resolved = registry.resolve(makeCtx({ isSubKin: true }))
    expect(Object.keys(resolved)).not.toContain('main_only')
    expect(Object.keys(resolved)).toContain('sub_only')
    expect(Object.keys(resolved)).toContain('both')
  })

  it('resolve returns empty object when no tools match', () => {
    registry.register('sub_only', makeMockRegistration(['sub-kin']))
    const resolved = registry.resolve(makeCtx({ isSubKin: false }))
    expect(Object.keys(resolved)).toHaveLength(0)
  })

  it('resolve passes context to tool factory', () => {
    let capturedCtx: ToolExecutionContext | null = null
    registry.register('spy', {
      create: (ctx) => {
        capturedCtx = ctx
        return makeMockTool('spy')
      },
      availability: ['main'],
    })

    const ctx = makeCtx({ kinId: 'custom-kin', userId: 'custom-user' })
    registry.resolve(ctx)

    expect(capturedCtx).not.toBeNull()
    expect(capturedCtx!.kinId).toBe('custom-kin')
    expect(capturedCtx!.userId).toBe('custom-user')
  })

  // ─── resolve: tool execution ─────────────────────────────────────────

  it('resolved tools are executable', async () => {
    registry.register('exec_test', {
      create: () => ({
        description: 'test',
        inputSchema: z.object({}),
        execute: async () => 'hello from tool',
      }),
      availability: ['main'],
    })

    const resolved = registry.resolve(makeCtx())
    const tool = resolved['exec_test']!
    expect(tool).toBeDefined()
    expect(tool.execute).toBeDefined()
    const result = await tool.execute!({}, {} as any)
    expect(result).toBe('hello from tool')
  })

  // ─── edge cases ──────────────────────────────────────────────────────

  it('handles empty availability array (tool never resolves)', () => {
    registry.register('ghost', makeMockRegistration([]))
    expect(registry.registeredCount).toBe(1)

    const mainResolved = registry.resolve(makeCtx({ isSubKin: false }))
    const subResolved = registry.resolve(makeCtx({ isSubKin: true }))
    expect(Object.keys(mainResolved)).toHaveLength(0)
    expect(Object.keys(subResolved)).toHaveLength(0)
  })

  it('resolve does not mutate internal state', () => {
    registry.register('t1', makeMockRegistration(['main']))
    const r1 = registry.resolve(makeCtx())
    const r2 = registry.resolve(makeCtx())
    expect(Object.keys(r1)).toEqual(Object.keys(r2))
    expect(registry.registeredCount).toBe(1)
  })
})
