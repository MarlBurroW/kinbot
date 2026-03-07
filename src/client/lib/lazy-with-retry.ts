import { lazy } from 'react'

/**
 * Wraps React.lazy() with retry logic for failed dynamic imports.
 *
 * When a new build is deployed while users have the old page open,
 * chunk filenames change (e.g. KinFormModal-ZFPF247B.js → KinFormModal-ABC123.js)
 * and the old import fails with "Failed to fetch dynamically imported module".
 *
 * This utility retries once (to handle transient network errors),
 * then forces a page reload so the browser fetches the new HTML with
 * updated chunk references.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return lazy(() =>
    importFn().catch(() => {
      // Retry once after a short delay (transient network error)
      return new Promise<{ default: T }>((resolve, reject) => {
        setTimeout(() => {
          importFn()
            .then(resolve)
            .catch(() => {
              // Still failing — likely a stale build. Reload to get new chunks.
              // Use sessionStorage flag to prevent infinite reload loops.
              const key = 'lazyRetryReload'
              const hasReloaded = sessionStorage.getItem(key)
              if (!hasReloaded) {
                sessionStorage.setItem(key, '1')
                window.location.reload()
              }
              // If we already reloaded and it still fails, surface the error
              sessionStorage.removeItem(key)
              reject(new Error('Failed to load module after retry and reload'))
            })
        }, 1500)
      })
    }),
  )
}
