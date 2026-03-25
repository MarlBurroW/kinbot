import type { Tool } from 'ai'

// ─── Sequential Lock ─────────────────────────────────────────────────────────

/**
 * Creates a simple sequential lock (mutex/queue) that ensures only one
 * async operation runs at a time. Each call to `run()` waits for the
 * previous one to finish before starting.
 */
export function createSequentialLock() {
  let queue: Promise<void> = Promise.resolve()

  return {
    run<T>(fn: () => Promise<T>): Promise<T> {
      // Chain onto the queue — run even if previous rejected
      const p = queue.then(fn, fn)
      // Swallow errors so the queue chain itself never rejects
      queue = p.then(
        () => {},
        () => {},
      )
      return p
    },
  }
}

// ─── Tool Wrapping ───────────────────────────────────────────────────────────

/**
 * Wrap all tools in a record so that their `execute` functions run
 * **sequentially** instead of in parallel.
 *
 * The Vercel AI SDK calls all tool executes concurrently when multiple
 * tool calls appear in the same step. This wrapper serializes them via
 * a shared per-call lock, preventing race conditions and ensuring each
 * tool sees the results of previously executed tools.
 *
 * A fresh lock is created per invocation so that separate `streamText()`
 * calls do not block each other.
 */
export function wrapToolsSequential(
  tools: Record<string, Tool<any, any>>,
): Record<string, Tool<any, any>> {
  const lock = createSequentialLock()
  const wrapped: Record<string, Tool<any, any>> = {}

  for (const [name, tool] of Object.entries(tools)) {
    if (!('execute' in tool) || typeof tool.execute !== 'function') {
      wrapped[name] = tool
      continue
    }

    const originalExecute = tool.execute
    wrapped[name] = {
      ...tool,
      execute: async (args: unknown, options: unknown) => {
        return lock.run(() => (originalExecute as Function)(args, options))
      },
    }
  }

  return wrapped
}
