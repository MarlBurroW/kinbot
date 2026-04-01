import type { Tool } from 'ai'

/** Execution context: main Kin agent or sub-Kin (task) */
export type ToolAvailability = 'main' | 'sub-kin'

/** Runtime context passed to each tool when the engine resolves it */
export interface ToolExecutionContext {
  kinId: string
  userId?: string
  taskId?: string
  /** Current task depth (1-based). Present only when executing inside a task. */
  taskDepth?: number
  isSubKin: boolean
  /** ID of the originating channel queue item (causal chain tracking) */
  channelOriginId?: string
}

/** Factory function that creates an AI SDK Tool bound to an execution context */
export type ToolFactory = (ctx: ToolExecutionContext) => Tool<any, any>

/** A registered tool with its factory and availability metadata */
export interface ToolRegistration {
  /** Factory that creates the AI SDK tool bound to an execution context */
  create: ToolFactory
  /** Which agent contexts this tool is available in */
  availability: ToolAvailability[]
  /** If true, tool is DISABLED by default — requires explicit opt-in via enabledOptInTools */
  defaultDisabled?: boolean
  /** Whether this tool only reads data and has no side effects.
   *  Read-only tools may be executed concurrently when a step
   *  contains only read-only tool calls. Defaults to false. */
  readOnly?: boolean
}
