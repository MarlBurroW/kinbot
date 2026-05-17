import type { Tool } from 'ai'
import type { KinToolConfig } from '@/shared/types'

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
  /** Cron ID when executing a cron-triggered task */
  cronId?: string
  /** Ticket ID when executing a ticket-linked task (Phase 26, projects.md § 13.1) */
  ticketId?: string
  /** Parsed per-Kin tool authorization config for tools with runtime options. */
  toolConfig?: KinToolConfig | null
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
  /** Whether this tool reads state without mutating anything.
   *  Defaults to false (conservative). Informational and complementary
   *  to concurrencySafe: a read-only tool that may still hold internal
   *  state could legitimately set readOnly without concurrencySafe. */
  readOnly?: boolean

  /** Whether this tool is safe to run concurrently with other tools
   *  in the same step. Default false (conservative). Set true for tools
   *  whose only side effect is fetching/reading and that do not depend
   *  on other tools' results within the same step. Most read-only tools
   *  should also be concurrency-safe; some writes can be too (independent
   *  log emits, idempotent registrations). */
  concurrencySafe?: boolean

  /** Whether this tool performs irreversible operations (delete, overwrite,
   *  send external message). Default false. Reserved for UX (confirmation
   *  prompts) and protected-tools logic. */
  destructive?: boolean

  /** Optional gating predicate evaluated at resolve time, in addition to
   *  `availability`. Return false to omit the tool from the resolved toolset.
   *  Useful for tools that should only be exposed conditionally — e.g.
   *  ticket tools available to sub-Kins only when `ctx.ticketId` is set. */
  condition?: (ctx: ToolExecutionContext) => boolean
}
