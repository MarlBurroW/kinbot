import type { Tool } from 'ai'
import type { ToolRegistration, ToolExecutionContext, ToolAvailability } from '@/server/tools/types'
import { hookRegistry } from '@/server/hooks/index'
import { createLogger } from '@/server/logger'

const log = createLogger('tools')

class ToolRegistry {
  private tools = new Map<string, ToolRegistration>()

  register(name: string, registration: ToolRegistration): void {
    this.tools.set(name, registration)
    log.debug({ toolName: name }, 'Tool registered')
  }

  unregister(name: string): boolean {
    const deleted = this.tools.delete(name)
    if (deleted) log.debug({ toolName: name }, 'Tool unregistered')
    return deleted
  }

  /**
   * Resolve all tools available for a given execution context.
   * Wraps each tool's execute function with beforeToolCall/afterToolCall hooks.
   */
  resolve(ctx: ToolExecutionContext): Record<string, Tool<any, any>> {
    const target: ToolAvailability = ctx.isSubKin ? 'sub-kin' : 'main'
    const resolved: Record<string, Tool<any, any>> = {}

    for (const [name, reg] of this.tools) {
      if (reg.availability.includes(target)) {
        const baseTool = reg.create(ctx)
        resolved[name] = this.wrapWithHooks(name, baseTool, ctx)
      }
    }

    log.debug({ kinId: ctx.kinId, resolvedCount: Object.keys(resolved).length }, 'Tools resolved for Kin')

    return resolved
  }

  /** Wrap a tool's execute with beforeToolCall / afterToolCall hooks */
  private wrapWithHooks(
    name: string,
    baseTool: Tool<any, any>,
    ctx: ToolExecutionContext,
  ): Tool<any, any> {
    if (!('execute' in baseTool) || typeof baseTool.execute !== 'function') {
      return baseTool
    }

    const originalExecute = baseTool.execute

    return {
      ...baseTool,
      execute: async (args: unknown, options: unknown) => {
        // beforeToolCall hook — allows inspection / modification
        await hookRegistry.execute('beforeToolCall', {
          ...ctx,
          toolName: name,
          toolArgs: args,
        })

        const result = await (originalExecute as Function)(args, options)

        // afterToolCall hook — allows logging / side-effects
        await hookRegistry.execute('afterToolCall', {
          ...ctx,
          toolName: name,
          toolArgs: args,
          toolResult: result,
        })

        return result
      },
    }
  }

  /** List all registered tool names with their availability (for API/UI). */
  list(): Array<{ name: string; availability: ToolAvailability[]; defaultDisabled: boolean }> {
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

export const toolRegistry = new ToolRegistry()
