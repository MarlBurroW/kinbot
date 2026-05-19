/**
 * Tool types — re-exports from the SDK. Single source of truth in
 * `packages/sdk/src/index.ts`. Server-side code keeps the existing
 * import path (`@/server/tools/types`) for stability across the ~45
 * native tool files; plugin authors should import directly from
 * `@kinbot-developer/sdk` instead.
 */
export type {
  ToolAvailability,
  ToolExecutionContext,
  ToolFactory,
  ToolRegistration,
} from '@kinbot-developer/sdk'
