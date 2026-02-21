import type { Tool } from 'ai'

/** Execution context: main Kin agent or sub-Kin (task) */
export type ToolAvailability = 'main' | 'sub-kin'

/** Runtime context passed to each tool when the engine resolves it */
export interface ToolExecutionContext {
  kinId: string
  userId?: string
  taskId?: string
  isSubKin: boolean
}

/** Factory function that creates an AI SDK Tool bound to an execution context */
export type ToolFactory = (ctx: ToolExecutionContext) => Tool<any, any>

/** A registered tool with its factory and availability metadata */
export interface ToolRegistration {
  /** Factory that creates the AI SDK tool bound to an execution context */
  create: ToolFactory
  /** Which agent contexts this tool is available in */
  availability: ToolAvailability[]
}
