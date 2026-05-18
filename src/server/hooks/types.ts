/**
 * Hook types — the SDK is the source of truth.
 *
 * Internal modules import from this file rather than `@kinbot-developer/sdk`
 * directly so the existing import paths keep working. The SDK is the
 * single source of truth — see `packages/sdk/src/index.ts` for the
 * authoritative definitions.
 */
export type { HookName, HookHandler, HookPayloadMap } from '@kinbot-developer/sdk'
