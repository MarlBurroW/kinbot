/**
 * Pure utility functions for the memory service.
 * Extracted to avoid heavy dependency chains in tests.
 */

/**
 * Apply a multiplicative boost to very recent memories.
 * This complements temporal decay (which penalizes old memories) by giving
 * an explicit advantage to memories updated in the last few days.
 */
export function recencyBoost(
  updatedAt: Date | null,
  recencyBoostEnabled: boolean,
): number {
  if (!recencyBoostEnabled || !updatedAt) return 1
  const daysSince =
    (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)

  if (daysSince <= 1) return 1.5 // Today: strong boost
  if (daysSince <= 7) return 1.25 // This week: moderate boost
  if (daysSince <= 30) return 1.1 // This month: mild boost
  return 1.0 // Older: no boost (decay still applies)
}
